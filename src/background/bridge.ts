import type {
  BridgeMessage,
  CommandMessage,
  EventMessage,
  HelloMessage,
  QueryMessage,
  QueryResultMessage,
  ResultMessage,
} from "../shared/protocol"
import type { BrowserAgentSettings, BridgeConnectionState } from "./store"
import { loadSettings, saveBridgeConnectionState } from "./store"
import { SUPPORTED_BROWSER_ACTIONS } from "../shared/actions"

type CommandListener = (message: CommandMessage) => Promise<void> | void
type ConnectedListener = () => Promise<void> | void

type RuntimePort = Pick<typeof chrome.runtime, "onMessage" | "onStartup" | "onInstalled">
type AlarmPort = Pick<typeof chrome.alarms, "create" | "onAlarm">

interface BridgeSocket {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  send(message: string): void
}

interface BridgeConnectionManagerDeps {
  loadSettings: () => Promise<BrowserAgentSettings>
  saveBridgeConnectionState: (
    state: Omit<BridgeConnectionState, "updatedAt">
  ) => Promise<void>
  createWebSocket: (url: string) => BridgeSocket
  createSessionId: () => string
  getExtensionVersion: () => string
  scheduleReconnect: (callback: () => void, delayMs: number) => number
  cancelReconnect: (timerId: number) => void
  scheduleKeepalive: (callback: () => void, delayMs: number) => number
  cancelKeepalive: (timerId: number) => void
}

interface PendingBridgeQuery {
  resolve: (message: QueryResultMessage) => void
  reject: (error: Error) => void
}

export interface BridgeConnectionManager {
  ensureConnected(): Promise<void>
  onCommand(listener: CommandListener): void
  onConnected(listener: ConnectedListener): void
  sendResult(message: ResultMessage): void
  sendEvent(message: EventMessage): void
  sendQuery(message: QueryMessage): Promise<QueryResultMessage>
}

const RECONNECT_DELAY_MS = 1500
const KEEPALIVE_INTERVAL_MS = 20_000

export const BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE = "bridge.ensureConnected"
export const BRIDGE_RECONNECT_ALARM_NAME = "browser-agent-reconnect"

export function createBridgeConnectionManager(
  deps: BridgeConnectionManagerDeps
): BridgeConnectionManager {
  let socket: BridgeSocket | null = null
  let reconnectTimerId: number | null = null
  let keepaliveTimerId: number | null = null
  let status: BridgeConnectionState["status"] = "idle"
  const listeners = new Set<CommandListener>()
  const connectedListeners = new Set<ConnectedListener>()
  const pendingQueries = new Map<string, PendingBridgeQuery>()

  const clearReconnectTimer = () => {
    if (reconnectTimerId === null) return
    deps.cancelReconnect(reconnectTimerId)
    reconnectTimerId = null
  }

  const clearKeepaliveTimer = () => {
    if (keepaliveTimerId === null) return
    deps.cancelKeepalive(keepaliveTimerId)
    keepaliveTimerId = null
  }

  const writeState = async (nextState: Omit<BridgeConnectionState, "updatedAt">) => {
    status = nextState.status
    await deps.saveBridgeConnectionState(nextState)
  }

  const scheduleReconnect = () => {
    if (reconnectTimerId !== null) return
    reconnectTimerId = deps.scheduleReconnect(() => {
      reconnectTimerId = null
      void manager.ensureConnected()
    }, RECONNECT_DELAY_MS)
  }

  const startKeepalive = (targetSocket: BridgeSocket) => {
    clearKeepaliveTimer()
    keepaliveTimerId = deps.scheduleKeepalive(() => {
      if (socket !== targetSocket) {
        clearKeepaliveTimer()
        return
      }

      try {
        targetSocket.send("keepalive")
      } catch {
        clearKeepaliveTimer()
      }
    }, KEEPALIVE_INTERVAL_MS)
  }

  const manager: BridgeConnectionManager = {
    async ensureConnected() {
      if (status === "connecting" || status === "connected") {
        return
      }

      clearReconnectTimer()

      const settings = await deps.loadSettings()
      await writeState({ status: "connecting" })
      const nextSocket = deps.createWebSocket(settings.bridgeUrl)
      socket = nextSocket

      nextSocket.onopen = () => {
        if (socket !== nextSocket) return

        const hello: HelloMessage = {
          type: "hello",
          role: "extension",
          sessionId: deps.createSessionId(),
          extensionVersion: deps.getExtensionVersion(),
          schemaVersion: "2026-05-03",
          supportedActions: SUPPORTED_BROWSER_ACTIONS,
        }

        void writeState({ status: "connected" })
        nextSocket.send(JSON.stringify(hello))
        startKeepalive(nextSocket)
        for (const listener of connectedListeners) {
          void listener()
        }
      }

      nextSocket.onmessage = async (event) => {
        if (socket !== nextSocket) return

        const payload = JSON.parse(String(event.data)) as BridgeMessage
        if (payload.type === "command") {
          for (const listener of listeners) {
            await listener(payload)
          }
          return
        }
        if (payload.type === "query_result") {
          const pending = pendingQueries.get(payload.queryId)
          if (!pending) return
          pendingQueries.delete(payload.queryId)
          pending.resolve(payload)
        }
      }

      nextSocket.onerror = () => {
        if (socket !== nextSocket) return

        clearKeepaliveTimer()
        for (const pending of pendingQueries.values()) {
          pending.reject(new Error(`Failed to reach ${settings.bridgeUrl}`))
        }
        pendingQueries.clear()
        void writeState({
          status: "error",
          lastError: `Failed to reach ${settings.bridgeUrl}`,
        })
      }

      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          socket = null
        }

        clearKeepaliveTimer()
        for (const pending of pendingQueries.values()) {
          pending.reject(new Error("Bridge connection closed"))
        }
        pendingQueries.clear()
        void writeState({ status: "idle" })
        scheduleReconnect()
      }
    },

    onCommand(listener: CommandListener) {
      listeners.add(listener)
    },

    onConnected(listener: ConnectedListener) {
      connectedListeners.add(listener)
    },

    sendResult(message: ResultMessage) {
      socket?.send(JSON.stringify(message))
    },

    sendEvent(message: EventMessage) {
      socket?.send(JSON.stringify(message))
    },

    sendQuery(message: QueryMessage) {
      if (!socket || status !== "connected") {
        return Promise.reject(new Error("Bridge is not connected"))
      }

      const activeSocket = socket

      return new Promise<QueryResultMessage>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingQueries.delete(message.queryId)
          reject(new Error("Bridge query timed out"))
        }, 15_000)
        pendingQueries.set(message.queryId, {
          resolve: (response) => {
            clearTimeout(timeoutId)
            resolve(response)
          },
          reject: (error) => {
            clearTimeout(timeoutId)
            reject(error)
          },
        })
        try {
          activeSocket.send(JSON.stringify(message))
        } catch (error) {
          pendingQueries.delete(message.queryId)
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    },
  }

  return manager
}

export function connectBridge(): BridgeConnectionManager {
  return createBridgeConnectionManager({
    loadSettings,
    saveBridgeConnectionState,
    createWebSocket: (url) => new WebSocket(url),
    createSessionId: () => crypto.randomUUID(),
    getExtensionVersion: () => chrome.runtime.getManifest().version,
    scheduleReconnect: (callback, delayMs) => setTimeout(callback, delayMs) as unknown as number,
    cancelReconnect: (timerId) => clearTimeout(timerId),
    scheduleKeepalive: (callback, delayMs) =>
      setInterval(callback, delayMs) as unknown as number,
    cancelKeepalive: (timerId) => clearInterval(timerId),
  })
}

export function registerBridgeConnectionWakeHandler(
  bridge: Pick<BridgeConnectionManager, "ensureConnected">,
  runtime: RuntimePort = chrome.runtime
) {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object" ||
      (message as { type?: string }).type !== BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE
    ) {
      return
    }

    void bridge
      .ensureConnected()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      })

    return true
  })
}

export function registerBridgeLifecycleWakeHandlers(
  bridge: Pick<BridgeConnectionManager, "ensureConnected">,
  runtime: Pick<typeof chrome.runtime, "onStartup" | "onInstalled"> = chrome.runtime,
  alarms: AlarmPort = chrome.alarms
) {
  const triggerReconnect = () => {
    void bridge.ensureConnected()
  }

  alarms.create(BRIDGE_RECONNECT_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 1,
  })

  runtime.onStartup.addListener(() => {
    triggerReconnect()
  })

  runtime.onInstalled.addListener(() => {
    triggerReconnect()
  })

  alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== BRIDGE_RECONNECT_ALARM_NAME) return
    triggerReconnect()
  })
}
