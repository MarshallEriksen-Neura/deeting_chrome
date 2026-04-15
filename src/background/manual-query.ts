import type { BridgeConnectionManager } from "./bridge"
import { applyPolicy } from "./policy"
import type { BrowserAction } from "../shared/actions"
import type {
  BrowserManualQueryRequest,
  BrowserManualQueryResponse,
} from "../shared/manual-query"
import { BROWSER_MANUAL_QUERY_MESSAGE_TYPE } from "../shared/manual-query"
import type {
  BrowserLookupPageContext,
  QueryMessage,
} from "../shared/protocol"

type TabsPort = Pick<typeof chrome.tabs, "query" | "sendMessage">

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function clipText(value: string, maxChars: number) {
  const normalized = normalizeText(value)
  if (normalized.length <= maxChars) {
    return normalized
  }
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`
}

async function resolveActivePageContext(
  tabs: TabsPort = chrome.tabs
): Promise<BrowserLookupPageContext> {
  const [tab] = await tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  if (!tab || typeof tab.id !== "number" || typeof tab.url !== "string") {
    throw new Error("No active browser page is available")
  }

  const targetUrl = tab.url
  const gate = await applyPolicy(
    {
      kind: "get_page_snapshot",
      tabId: tab.id,
    } as Extract<BrowserAction, { kind: "get_page_snapshot" }>,
    { targetUrl }
  )
  if (!gate.ok) {
    throw new Error(gate.error?.message ?? "Current page is not allowed")
  }

  const response = (await tabs.sendMessage(tab.id, {
    kind: "get_page_snapshot",
    tabId: tab.id,
  } satisfies Extract<BrowserAction, { kind: "get_page_snapshot" }>)) as {
    ok?: boolean
    data?: {
      url?: string
      title?: string
      mainText?: string
      visibleText?: string
      headings?: Array<{ text?: string }>
    }
    error?: { message?: string }
  }

  if (!response?.ok || !response.data) {
    throw new Error(response?.error?.message ?? "Failed to read the current page")
  }

  const parsedUrl = new URL(response.data.url ?? tab.url)
  const headingsSummary = Array.from(
    new Set(
      (response.data.headings ?? [])
        .map((heading) => normalizeText(heading.text ?? ""))
        .filter((heading) => heading.length > 0)
    )
  ).slice(0, 6)

  return {
    tabId: tab.id,
    title: normalizeText(response.data.title ?? tab.title ?? ""),
    url: response.data.url ?? tab.url,
    host: parsedUrl.host,
    headingsSummary,
    mainTextSnippet: clipText(response.data.mainText ?? "", 1400),
    visibleTextSnippet: clipText(response.data.visibleText ?? "", 700),
  }
}

export function registerManualBrowserQueryHandler(
  bridge: Pick<BridgeConnectionManager, "ensureConnected" | "sendQuery">,
  runtime: Pick<typeof chrome.runtime, "onMessage"> = chrome.runtime,
  tabs: TabsPort = chrome.tabs
) {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object" ||
      (message as { type?: string }).type !== BROWSER_MANUAL_QUERY_MESSAGE_TYPE
    ) {
      return
    }

    const request = message as BrowserManualQueryRequest

    void bridge
      .ensureConnected()
      .then(() => resolveActivePageContext(tabs))
      .then((pageContext) =>
        bridge.sendQuery({
          type: "query",
          queryId: crypto.randomUUID(),
          method: request.method,
          params: { pageContext },
        } satisfies QueryMessage)
      )
      .then((result) => {
        sendResponse({
          ok: result.ok,
          data:
            result.data && typeof result.data === "object"
              ? (result.data as BrowserManualQueryResponse["data"])
              : undefined,
          error: result.error?.message,
        } satisfies BrowserManualQueryResponse)
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies BrowserManualQueryResponse)
      })

    return true
  })
}
