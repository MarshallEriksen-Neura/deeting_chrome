import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  registerManualBrowserQueryHandler,
} from "./manual-query"
import { BROWSER_MANUAL_QUERY_MESSAGE_TYPE } from "../shared/manual-query"

describe("registerManualBrowserQueryHandler", () => {
  let listener:
    | ((
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => boolean | void)
    | undefined

  const ensureConnected = mock(async () => undefined)
  const sendQuery = mock(async () => ({
    type: "query_result" as const,
    queryId: "query-1",
    ok: true,
    data: {
      lookupId: "lookup-1",
      resultCount: 2,
      kind: "search_wiki",
    },
  }))
  const sendResponse = mock(() => undefined)
  const queryTabs = mock(async () => [
    {
      id: 42,
      title: "Example Docs",
      url: "https://example.com/docs",
    },
  ])
  const sendMessage = mock(async () => ({
    ok: true,
    data: {
      url: "https://example.com/docs",
      title: "Example Docs",
      mainText: "Main content",
      visibleText: "Visible content",
      headings: [{ text: "Example Docs" }],
    },
  }))

  beforeEach(() => {
    ensureConnected.mockClear()
    sendQuery.mockClear()
    sendResponse.mockClear()
    queryTabs.mockClear()
    sendMessage.mockClear()
    Reflect.set(globalThis, "chrome", {
      runtime: {
        onMessage: {
          addListener: mock((value) => {
            listener = value
          }),
        },
      },
      tabs: {
        query: queryTabs,
        sendMessage,
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
        },
      },
    } as unknown as typeof chrome)
  })

  it("collects the active page context and sends a browser lookup query", async () => {
    registerManualBrowserQueryHandler(
      { ensureConnected, sendQuery },
      chrome.runtime,
      chrome.tabs
    )

    const handled = listener?.(
      {
        type: BROWSER_MANUAL_QUERY_MESSAGE_TYPE,
        method: "search_wiki",
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    expect(handled).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(ensureConnected).toHaveBeenCalledTimes(1)
    expect(queryTabs).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(42, {
      kind: "get_page_snapshot",
      tabId: 42,
    })
    expect(sendQuery).toHaveBeenCalledTimes(1)
    expect(sendQuery.mock.calls[0]?.[0]).toMatchObject({
      type: "query",
      method: "search_wiki",
      params: {
        pageContext: {
          tabId: 42,
          title: "Example Docs",
          host: "example.com",
        },
      },
    })
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      data: {
        lookupId: "lookup-1",
        resultCount: 2,
        kind: "search_wiki",
      },
      error: undefined,
    })
  })

  it("supports ask_current_page requests through the same bridge query lane", async () => {
    registerManualBrowserQueryHandler(
      { ensureConnected, sendQuery },
      chrome.runtime,
      chrome.tabs
    )

    listener?.(
      {
        type: BROWSER_MANUAL_QUERY_MESSAGE_TYPE,
        method: "ask_current_page",
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      type: "query",
      method: "ask_current_page",
    })
  })
})
