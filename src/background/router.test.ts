import { beforeEach, describe, expect, it, mock } from "bun:test"

import { handleCommand } from "./router"

const createMock = mock(async ({ url }: { url: string }) => ({ id: 11, url }))
const updateMock = mock(async (tabId: number, update: { url?: string }) => ({
  id: tabId,
  url: update.url,
}))
const sendMessageMock = mock(async (_tabId: number, _message: unknown) => ({
  ok: true,
  data: {
    title: "Example Page",
  },
}))
const getMock = mock(async (tabId: number) => ({
  id: tabId,
  url: "https://example.com/docs",
}))

beforeEach(() => {
  createMock.mockClear()
  updateMock.mockClear()
  sendMessageMock.mockClear()
  getMock.mockClear()

  Reflect.set(globalThis, "chrome", {
    tabs: {
      create: createMock,
      update: updateMock,
      sendMessage: sendMessageMock,
      get: getMock,
    },
    storage: {
      local: {
        get: mock(async () => ({
          "browser-agent-settings": {
            bridgeUrl: "ws://127.0.0.1:31937/bridge",
            allowedDomains: ["example.com"],
            autoApproveLowRisk: true,
          },
        })),
        set: mock(async () => undefined),
      },
      session: {
        set: mock(async () => undefined),
      },
    },
    runtime: {
      getManifest: () => ({ version: "0.1.0" }),
    },
  } as unknown as typeof chrome)
})

describe("handleCommand", () => {
  it("opens a new tab for open_tab actions", async () => {
    const result = await handleCommand({
      type: "command",
      requestId: "req-open",
      action: { kind: "open_tab", url: "https://example.com/docs" },
    })

    expect(result.ok).toBe(true)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledTimes(0)
  })

  it("routes page actions to the content script when the tab domain is allowed", async () => {
    const result = await handleCommand({
      type: "command",
      requestId: "req-snapshot",
      action: { kind: "get_page_snapshot", tabId: 7 },
    })

    expect(result.ok).toBe(true)
    expect(getMock).toHaveBeenCalledWith(7)
    expect(sendMessageMock).toHaveBeenCalledWith(7, { kind: "get_page_snapshot", tabId: 7 })
  })

  it("blocks page actions when the tab domain is not allowlisted", async () => {
    getMock.mockImplementationOnce(async (tabId: number) => ({
      id: tabId,
      url: "https://blocked.dev/admin",
    }))

    const result = await handleCommand({
      type: "command",
      requestId: "req-blocked",
      action: { kind: "get_page_snapshot", tabId: 8 },
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("DOMAIN_NOT_ALLOWED")
    expect(sendMessageMock).toHaveBeenCalledTimes(0)
  })
})
