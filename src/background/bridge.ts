import type { CommandMessage, HelloMessage, ResultMessage } from "../shared/protocol"
import type { BrowserAgentSettings, BridgeConnectionState } from "./store"
import { loadSettings, saveBridgeConnectionState } from "./store"

type CommandListener = (message: CommandMessage) => Promise<void> | void

type RuntimePort = Pick<typeof chrome.runtime, "onMessage">

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
}

export interface BridgeConnectionManager {
  ensureConnected(): Promise<void>
  onCommand(listener: CommandListener): void
  sendResult(message: ResultMessage): void
}

const RECONNECT_DELAY_MS = 1500

export const BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE = "bridge.ensureConnected"

export function createBridgeConnectionManager(
  deps: BridgeConnectionManagerDeps
): BridgeConnectionManager {
  let socket: BridgeSocket | null = null
  let reconnectTimerId: number | null = null
  let status: BridgeConnectionState["status"] = "idle"
  const listeners = new Set<CommandListener>()

  const clearReconnectTimer = () => {
    if (reconnectTimerId === null) return
    deps.cancelReconnect(reconnectTimerId)
    reconnectTimerId = null
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
        }

        void writeState({ status: "connected" })
        nextSocket.send(JSON.stringify(hello))
      }

      nextSocket.onmessage = async (event) => {
        if (socket !== nextSocket) return

        const payload = JSON.parse(String(event.data)) as CommandMessage
        if (payload.type !== "command") return

        for (const listener of listeners) {
          await listener(payload)
        }
      }

      nextSocket.onerror = () => {
        if (socket !== nextSocket) return

        void writeState({
          status: "error",
          lastError: `Failed to reach ${settings.bridgeUrl}`,
        })
      }

      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          socket = null
        }

        void writeState({ status: "idle" })
        scheduleReconnect()
      }
    },

    onCommand(listener: CommandListener) {
      listeners.add(listener)
    },

    sendResult(message: ResultMessage) {
      socket?.send(JSON.stringify(message))
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
