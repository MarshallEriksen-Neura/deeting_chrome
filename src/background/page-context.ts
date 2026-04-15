import type { BridgeConnectionManager } from "./bridge"
import type { BrowserTabEventData, EventMessage } from "../shared/protocol"

type TabsPort = Pick<
  typeof chrome.tabs,
  "query" | "get" | "onActivated" | "onUpdated" | "onRemoved"
>

function asSupportedTab(
  tab: chrome.tabs.Tab | undefined | null
): BrowserTabEventData | null {
  const tabId = typeof tab?.id === "number" ? tab.id : null
  const url = typeof tab?.url === "string" ? tab.url.trim() : ""
  if (tabId == null || !url) return null

  let host = ""
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }
    host = parsed.host
  } catch {
    return null
  }

  return {
    tabId,
    url,
    title: typeof tab?.title === "string" ? tab.title : "",
    host,
  }
}

async function resolveActiveSupportedTab(
  tabs: Pick<typeof chrome.tabs, "query">
): Promise<BrowserTabEventData | null> {
  const [tab] = await tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  return asSupportedTab(tab)
}

export function registerBridgePageContextSignals(
  bridge: Pick<BridgeConnectionManager, "onConnected" | "sendEvent">,
  tabs: TabsPort = chrome.tabs
) {
  let lastActiveTabId: number | null = null
  let lastFingerprint = ""

  const emit = (message: EventMessage) => {
    bridge.sendEvent(message)
  }

  const emitClosed = (tabId: number) => {
    emit({
      type: "event",
      event: "tab_closed",
      data: { tabId },
    })
  }

  const emitUpdated = (data: BrowserTabEventData) => {
    emit({
      type: "event",
      event: "tab_updated",
      data,
    })
  }

  const syncActivePage = async () => {
    const activeTab = await resolveActiveSupportedTab(tabs)
    if (!activeTab) {
      if (lastActiveTabId != null) {
        emitClosed(lastActiveTabId)
      }
      lastActiveTabId = null
      lastFingerprint = ""
      return
    }

    const nextFingerprint = `${activeTab.tabId}:${activeTab.url}:${activeTab.title ?? ""}`
    if (lastActiveTabId != null && lastActiveTabId !== activeTab.tabId) {
      emitClosed(lastActiveTabId)
    }
    if (nextFingerprint !== lastFingerprint) {
      emitUpdated(activeTab)
    }
    lastActiveTabId = activeTab.tabId
    lastFingerprint = nextFingerprint
  }

  bridge.onConnected(() => {
    void syncActivePage()
  })

  tabs.onActivated.addListener(() => {
    void syncActivePage()
  })

  tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (
      tabId !== lastActiveTabId &&
      !changeInfo.url &&
      !changeInfo.title &&
      changeInfo.status !== "complete"
    ) {
      return
    }
    void syncActivePage()
  })

  tabs.onRemoved.addListener((tabId) => {
    if (tabId !== lastActiveTabId) return
    emitClosed(tabId)
    lastActiveTabId = null
    lastFingerprint = ""
  })
}

