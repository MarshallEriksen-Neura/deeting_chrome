import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE,
  createBridgeConnectionManager,
  registerBridgeConnectionWakeHandler,
} from "./bridge"
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
  const scheduledTasks: ScheduledTask[] = []
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
        scheduledTasks.push(task)
        return task.id
      },
      cancelReconnect: (timerId) => {
        const index = scheduledTasks.findIndex((task) => task.id === timerId)
        if (index >= 0) {
          scheduledTasks.splice(index, 1)
        }
      },
    })
  }

  function runNextReconnect() {
    const task = scheduledTasks.shift()
    expect(task).toBeDefined()
    task?.callback()
  }

  beforeEach(() => {
    stateWrites.length = 0
    sockets.length = 0
    scheduledTasks.length = 0
    nextTimerId = 1
  })

  it("writes connecting and connected once and does not create duplicate sockets", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    await manager.ensureConnected()

    expect(sockets).toHaveLength(1)
    expect(stateWrites).toEqual([{ status: "connecting" }])

    sockets[0]?.onopen?.({} as Event)

    expect(stateWrites).toEqual([{ status: "connecting" }, { status: "connected" }])
    expect(sockets[0]?.sentMessages).toHaveLength(1)
  })

  it("writes idle on close and reconnects through the scheduled retry without duplicating timers", async () => {
    const manager = createManager()

    await manager.ensureConnected()
    sockets[0]?.onclose?.({} as CloseEvent)

    expect(stateWrites).toEqual([{ status: "connecting" }, { status: "idle" }])
    expect(scheduledTasks).toHaveLength(1)
    expect(scheduledTasks[0]?.delayMs).toBe(1500)

    await manager.ensureConnected()

    expect(sockets).toHaveLength(2)
    expect(scheduledTasks).toHaveLength(0)
    expect(stateWrites).toEqual([
      { status: "connecting" },
      { status: "idle" },
      { status: "connecting" },
    ])

    sockets[1]?.onclose?.({} as CloseEvent)
    expect(scheduledTasks).toHaveLength(1)

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
