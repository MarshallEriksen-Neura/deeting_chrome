import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE,
  createBridgeConnectionManager,
  registerBridgeLifecycleWakeHandlers,
  registerBridgeConnectionWakeHandler,
} from "./bridge"
import { SUPPORTED_BROWSER_ACTIONS } from "../shared/actions"
import type { BridgeConnectionState } from "./store"

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  sentMessages: string[] = []

  constructor(readonly url: string) {}

  send(message: string) {
    this.sentMessages.push(message)
  }
}

interface ScheduledTask {
  id: number
  callback: () => void
  delayMs: number
}

describe("bridge connection manager", () => {
  const stateWrites: Array<Omit<BridgeConnectionState, "updatedAt">> = []
  const sockets: FakeWebSocket[] = []
  const scheduledReconnects: ScheduledTask[] = []
  const scheduledKeepalives: ScheduledTask[] = []
  let nextTimerId = 1

  function createManager() {
    return createBridgeConnectionManager({
      loadSettings: async () => ({
        bridgeUrl: "ws://127.0.0.1:31937/bridge",
        allowedDomains: [],
        autoApproveLowRisk: true,
      }),
      saveBridgeConnectionState: async (state) => {
        stateWrites.push(state)
      },
      createWebSocket: (url) => {
        const socket = new FakeWebSocket(url)
        sockets.push(socket)
        return socket as unknown as WebSocket
      },
      createSessionId: () => "session-1",
      getExtensionVersion: () => "0.1.0",
      scheduleReconnect: (callback, delayMs) => {
        const task = { id: nextTimerId++, callback, delayMs }
        scheduledReconnects.push(task)
        return task.id
      },
      cancelReconnect: (timerId) => {
        const index = scheduledReconnects.findIndex((task) => task.id === timerId)
        if (index >= 0) {
          scheduledReconnects.splice(index, 1)
        }
      },
      scheduleKeepalive: (callback, delayMs) => {
        const task = { id: nextTimerId++, callback, delayMs }
        scheduledKeepalives.push(task)
        return task.id
      },
      cancelKeepalive: (timerId) => {
        const index = scheduledKeepalives.findIndex((task) => task.id === timerId)
        if (index >= 0) {
          scheduledKeepalives.splice(index, 1)
        }
      },
    })
  }

  function runNextReconnect() {
    const task = scheduledReconnects.shift()
    expect(task).toBeDefined()
    task?.callback()
  }

  function runKeepalive(id: number) {
    const task = scheduledKeepalives.find((entry) => entry.id === id)
    expect(task).toBeDefined()
    task?.callback()
  }

  beforeEach(() => {
    stateWrites.length = 0
    sockets.length = 0
    scheduledReconnects.length = 0
    scheduledKeepalives.length = 0
    nextTimerId = 1
  })

  it("writes connecting and connected once and does not create duplicate sockets", async () => {
    const manager = createManager()
    const connectedListener = mock(() => undefined)
    manager.onConnected(connectedListener)

    await manager.ensureConnected()
    await manager.ensureConnected()

    expect(sockets).toHaveLength(1)
    expect(stateWrites).toEqual([{ status: "connecting" }])

    sockets[0]?.onopen?.({} as Event)

    expect(stateWrites).toEqual([{ status: "connecting" }, { status: "connected" }])
    expect(sockets[0]?.sentMessages).toHaveLength(1)
    expect(connectedListener).toHaveBeenCalledTimes(1)
  })

  it("writes idle on close and reconnects through the scheduled retry without duplicating timers", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onclose?.({} as CloseEvent)

    expect(stateWrites).toEqual([{ status: "connecting" }, { status: "idle" }])
    expect(scheduledReconnects).toHaveLength(1)
    expect(scheduledReconnects[0]?.delayMs).toBe(1500)

    await manager.ensureConnected()

    expect(sockets).toHaveLength(2)
    expect(scheduledReconnects).toHaveLength(0)
    expect(stateWrites).toEqual([
      { status: "connecting" },
      { status: "idle" },
      { status: "connecting" },
    ])

    sockets[1]?.onclose?.({} as CloseEvent)
    expect(scheduledReconnects).toHaveLength(1)

    runNextReconnect()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(sockets).toHaveLength(3)
    expect(stateWrites.at(-1)).toEqual({ status: "connecting" })
  })

  it("writes an error state when the socket cannot reach the bridge", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onerror?.({} as Event)

    expect(stateWrites).toEqual([
      { status: "connecting" },
      {
        status: "error",
        lastError: "Failed to reach ws://127.0.0.1:31937/bridge",
      },
    ])
  })

  it("starts keepalive messages after the websocket opens and stops them after close", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onopen?.({} as Event)

    expect(scheduledKeepalives).toHaveLength(1)
    expect(scheduledKeepalives[0]?.delayMs).toBe(20_000)

    const keepaliveTaskId = scheduledKeepalives[0]!.id
    runKeepalive(keepaliveTaskId)

    expect(sockets[0]?.sentMessages).toEqual([
      JSON.stringify({
        type: "hello",
        role: "extension",
        sessionId: "session-1",
        extensionVersion: "0.1.0",
        schemaVersion: "2026-05-03",
        supportedActions: SUPPORTED_BROWSER_ACTIONS,
      }),
      "keepalive",
    ])

    sockets[0]?.onclose?.({} as CloseEvent)

    expect(scheduledKeepalives).toHaveLength(0)
  })

  it("sends bridge events through the active websocket", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onopen?.({} as Event)

    manager.sendEvent({
      type: "event",
      event: "tab_updated",
      data: {
        tabId: 42,
        url: "https://example.com/docs",
        title: "Example Docs",
        host: "example.com",
      },
    })

    expect(sockets[0]?.sentMessages.at(-1)).toBe(
      JSON.stringify({
        type: "event",
        event: "tab_updated",
        data: {
          tabId: 42,
          url: "https://example.com/docs",
          title: "Example Docs",
          host: "example.com",
        },
      })
    )
  })

  it("resolves pending query results returned from the desktop bridge", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onopen?.({} as Event)

    const responsePromise = manager.sendQuery({
      type: "query",
      queryId: "query-1",
      method: "search_wiki",
      params: {
        pageContext: {
          tabId: 42,
          title: "Example Docs",
          url: "https://example.com/docs",
          host: "example.com",
          headingsSummary: ["Example Docs"],
          mainTextSnippet: "Main content",
          visibleTextSnippet: "Visible content",
        },
      },
    })

    sockets[0]?.onmessage?.({
      data: JSON.stringify({
        type: "query_result",
        queryId: "query-1",
        ok: true,
        data: {
          resultCount: 3,
        },
      }),
    } as MessageEvent)

    await expect(responsePromise).resolves.toEqual({
      type: "query_result",
      queryId: "query-1",
      ok: true,
      data: {
        resultCount: 3,
      },
    })
  })
})

describe("registerBridgeConnectionWakeHandler", () => {
  it("wakes the manager for ensureConnected messages", async () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void)
      | undefined
    const addListener = mock((value) => {
      listener = value
    })
    const ensureConnected = mock(async () => undefined)
    const sendResponse = mock(() => undefined)

    registerBridgeConnectionWakeHandler(
      { ensureConnected },
      {
        onMessage: {
          addListener,
        },
      } as unknown as typeof chrome.runtime
    )

    const handled = listener?.(
      { type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE, source: "popup" },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    expect(addListener).toHaveBeenCalledTimes(1)
    expect(handled).toBe(true)
    await Promise.resolve()
    expect(ensureConnected).toHaveBeenCalledTimes(1)
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })
})

describe("registerBridgeLifecycleWakeHandlers", () => {
  it("reconnects on startup, install, and matching alarm events", async () => {
    let startupListener: (() => void) | undefined
    let installedListener: (() => void) | undefined
    let alarmListener: ((alarm: { name: string }) => void) | undefined
    const runtime = {
      onStartup: {
        addListener: mock((listener) => {
          startupListener = listener
        }),
      },
      onInstalled: {
        addListener: mock((listener) => {
          installedListener = listener
        }),
      },
    } as unknown as typeof chrome.runtime
    const alarms = {
      create: mock(() => undefined),
      onAlarm: {
        addListener: mock((listener) => {
          alarmListener = listener
        }),
      },
    } as unknown as typeof chrome.alarms
    const ensureConnected = mock(async () => undefined)

    registerBridgeLifecycleWakeHandlers({ ensureConnected }, runtime, alarms)

    expect(alarms.create).toHaveBeenCalledWith("browser-agent-reconnect", {
      delayInMinutes: 1,
      periodInMinutes: 1,
    })

    startupListener?.()
    installedListener?.()
    alarmListener?.({ name: "browser-agent-reconnect" })
    alarmListener?.({ name: "different-alarm" })

    await Promise.resolve()

    expect(ensureConnected).toHaveBeenCalledTimes(3)
  })
})
