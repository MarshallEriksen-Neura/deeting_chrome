import { beforeEach, describe, expect, it, mock } from "bun:test"

import { registerBridgePageContextSignals } from "./page-context"

describe("registerBridgePageContextSignals", () => {
  let connectedListener: (() => void | Promise<void>) | null
  let activatedListener: (() => void) | null
  let updatedListener:
    | ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => void)
    | null
  let removedListener: ((tabId: number) => void) | null
  const sentEvents: unknown[] = []

  const tabs = {
    query: mock(async () => [
      {
        id: 42,
        title: "Example Docs",
        url: "https://example.com/docs",
      },
    ]),
    get: mock(async () => ({
      id: 42,
      title: "Example Docs",
      url: "https://example.com/docs",
    })),
    onActivated: {
      addListener: mock((listener) => {
        activatedListener = listener
      }),
    },
    onUpdated: {
      addListener: mock((listener) => {
        updatedListener = listener
      }),
    },
    onRemoved: {
      addListener: mock((listener) => {
        removedListener = listener
      }),
    },
  } as unknown as typeof chrome.tabs

  beforeEach(() => {
    connectedListener = null
    activatedListener = null
    updatedListener = null
    removedListener = null
    sentEvents.length = 0
  })

  async function flushTasks() {
    await Promise.resolve()
    await Promise.resolve()
  }

  it("emits the active tab context when the bridge connects", async () => {
    registerBridgePageContextSignals(
      {
        onConnected(listener) {
          connectedListener = listener
        },
        sendEvent(message) {
          sentEvents.push(message)
        },
      },
      tabs
    )

    connectedListener?.()
    await flushTasks()

    expect(sentEvents).toEqual([
      {
        type: "event",
        event: "tab_updated",
        data: {
          tabId: 42,
          title: "Example Docs",
          url: "https://example.com/docs",
          host: "example.com",
        },
      },
    ])
  })

  it("clears the active page when the active tab is removed", async () => {
    registerBridgePageContextSignals(
      {
        onConnected(listener) {
          connectedListener = listener
        },
        sendEvent(message) {
          sentEvents.push(message)
        },
      },
      tabs
    )

    connectedListener?.()
    await flushTasks()
    removedListener?.(42)

    expect(sentEvents.at(-1)).toEqual({
      type: "event",
      event: "tab_closed",
      data: { tabId: 42 },
    })
  })
})
