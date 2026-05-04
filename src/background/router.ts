import { applyPolicy } from "./policy"
import type { CommandMessage, ResultMessage } from "../shared/protocol"
import type { BrowserAction } from "../shared/actions"

async function dispatchToTab<T>(tabId: number, message: BrowserAction): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function openTab(url: string): Promise<{ tabId?: number; url: string }> {
  const tab = await chrome.tabs.create({ url })
  return { tabId: tab.id, url }
}

async function navigateTab(tabId: number, url: string): Promise<{ tabId: number; url: string }> {
  await chrome.tabs.update(tabId, { url })
  return { tabId, url }
}

async function getActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return {
      ok: false,
      error: { code: "NO_ACTIVE_TAB", message: "No active browser tab is available" },
    }
  }
  return {
    ok: true,
    tabId: tab.id,
    url: tab.url ?? "",
    title: tab.title ?? "",
    documentReadyState: tabReadyState(tab),
  }
}

async function manageTabs(action: Extract<BrowserAction, { kind: "tabs" }>) {
  switch (action.action) {
    case "list": {
      const tabs = await chrome.tabs.query({})
      return {
        ok: true,
        tabs: tabs.map((tab) => ({
          tabId: tab.id,
          active: tab.active,
          url: tab.url ?? "",
          title: tab.title ?? "",
          status: tabReadyState(tab),
        })),
      }
    }
    case "switch": {
      if (!action.tabId) {
        return { ok: false, error: { code: "NO_ACTIVE_TAB", message: "tabs switch requires tabId" } }
      }
      await chrome.tabs.update(action.tabId, { active: true })
      return { ok: true, tabId: action.tabId }
    }
    case "create": {
      if (!action.url) {
        return { ok: false, error: { code: "INVALID_ARGUMENT", message: "tabs create requires url" } }
      }
      return openTab(action.url)
    }
    case "close": {
      if (!action.tabId) {
        return { ok: false, error: { code: "NO_ACTIVE_TAB", message: "tabs close requires tabId" } }
      }
      await chrome.tabs.remove(action.tabId)
      return { ok: true, tabId: action.tabId }
    }
  }
}

async function captureVisible(tabId: number) {
  const tab = await chrome.tabs.get(tabId)
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })
  return {
    ok: true,
    tabId,
    url: tab.url ?? "",
    title: tab.title ?? "",
    image: dataUrl,
    format: "png",
  }
}

async function captureRegion(action: Extract<BrowserAction, { kind: "region_screenshot" }>) {
  const region = await dispatchToTab<{ ok: boolean; region?: unknown; error?: unknown }>(
    action.tabId,
    action
  )
  if (!region.ok) return region
  return {
    ...(await captureVisible(action.tabId)),
    region: region.region,
    note: "Captured the visible viewport and returned the requested region metadata.",
  }
}

async function listDownloads(action: Extract<BrowserAction, { kind: "downloads" }>) {
  if (!chrome.downloads?.search) {
    return {
      ok: false,
      error: { code: "UNSUPPORTED_ACTION", message: "chrome.downloads API is unavailable" },
    }
  }
  const startedAt = Date.now()
  const timeoutMs = action.timeoutMs ?? 10_000
  while (true) {
    const items = await chrome.downloads.search({
      orderBy: ["-startTime"],
      limit: action.limit ?? 20,
    })
    const filtered = action.filenameContains
      ? items.filter((item) =>
          (item.filename || item.url || "").toLowerCase().includes(action.filenameContains!.toLowerCase())
        )
      : items
    if (action.action !== "wait" || filtered.some((item) => item.state === "complete")) {
      return {
        ok: true,
        downloads: filtered.map((item) => ({
          id: item.id,
          filename: item.filename,
          url: item.url,
          mime: item.mime,
          fileSize: item.fileSize,
          totalBytes: item.totalBytes,
          state: item.state,
          danger: item.danger,
          startTime: item.startTime,
          endTime: item.endTime,
        })),
      }
    }
    if (Date.now() - startedAt > timeoutMs) {
      return { ok: false, error: { code: "DOWNLOAD_NOT_FOUND", message: "Download did not complete before timeout" } }
    }
    await wait(250)
  }
}

function tabReadyState(tab: chrome.tabs.Tab): DocumentReadyState {
  return tab.status === "complete" ? "complete" : "loading"
}

async function waitForNavigation(action: Extract<BrowserAction, { kind: "wait_for_navigation" }>) {
  const initialTab = await chrome.tabs.get(action.tabId)
  return waitForNavigationFromBaseline(action, initialTab)
}

async function waitForNavigationFromBaseline(
  action: Extract<BrowserAction, { kind: "wait_for_navigation" }>,
  initialTab: chrome.tabs.Tab
) {
  const initialUrl = initialTab.url ?? ""
  const initialTitle = initialTab.title ?? ""
  const initialReadyState = tabReadyState(initialTab)
  const startedAt = Date.now()

  while (Date.now() - startedAt <= action.timeoutMs) {
    const currentTab = await chrome.tabs.get(action.tabId)
    const url = currentTab.url ?? ""
    const title = currentTab.title ?? ""
    const documentReadyState = tabReadyState(currentTab)
    const changed =
      url !== initialUrl || title !== initialTitle || documentReadyState !== initialReadyState

    const urlMatches = action.expectedUrlContains
      ? url.includes(action.expectedUrlContains)
      : changed
    const titleMatches = action.expectedTitleContains
      ? title.includes(action.expectedTitleContains)
      : true
    const readyStateMatches = action.waitForReadyState
      ? documentReadyState === action.waitForReadyState
      : true

    if (urlMatches && titleMatches && readyStateMatches) {
      return {
        ok: true,
        url,
        title,
        documentReadyState,
        changed,
      }
    }

    await wait(100)
  }

  const finalTab = await chrome.tabs.get(action.tabId)
  return {
    ok: false,
    url: finalTab.url ?? "",
    title: finalTab.title ?? "",
    documentReadyState: tabReadyState(finalTab),
    changed:
      (finalTab.url ?? "") !== initialUrl ||
      (finalTab.title ?? "") !== initialTitle ||
      tabReadyState(finalTab) !== initialReadyState,
  }
}

async function resolveTargetUrl(action: BrowserAction): Promise<string | undefined> {
  switch (action.kind) {
    case "open_tab":
      return action.url
    case "navigate_tab":
      return action.url
    case "get_active_page":
    case "tabs":
    case "downloads":
      return undefined
    default: {
      if (!("tabId" in action) || typeof action.tabId !== "number") return undefined
      const tab = await chrome.tabs.get(action.tabId)
      return tab.url
    }
  }
}

export async function handleCommand(message: CommandMessage): Promise<ResultMessage> {
  try {
    const baselineTab =
      message.action.kind === "wait_for_navigation"
        ? await chrome.tabs.get(message.action.tabId)
        : null
    const targetUrl =
      message.action.kind === "wait_for_navigation"
        ? baselineTab?.url
        : await resolveTargetUrl(message.action)
    const gate = await applyPolicy(message.action, { targetUrl })
    if (!gate.ok) {
      return {
        type: "result",
        requestId: message.requestId,
        ok: false,
        error: gate.error,
      }
    }

    let data: unknown
    switch (message.action.kind) {
      case "open_tab":
        data = await openTab(message.action.url)
        break
      case "navigate_tab":
        data = await navigateTab(message.action.tabId, message.action.url)
        break
      case "get_active_page":
        data = await getActivePage()
        break
      case "tabs":
        data = await manageTabs(message.action)
        break
      case "full_page_screenshot":
        data = await captureVisible(message.action.tabId)
        break
      case "region_screenshot":
        data = await captureRegion(message.action)
        break
      case "downloads":
        data = await listDownloads(message.action)
        break
      case "wait_for_navigation":
        data = await waitForNavigationFromBaseline(
          message.action,
          baselineTab ?? (await chrome.tabs.get(message.action.tabId))
        )
        break
      case "wait":
        if (
          message.action.mode === "url" ||
          message.action.mode === "title" ||
          message.action.mode === "readyState"
        ) {
          data = await waitForNavigationFromBaseline(
            {
              kind: "wait_for_navigation",
              tabId: message.action.tabId ?? 0,
              timeoutMs: message.action.timeoutMs ?? 10_000,
              expectedUrlContains: message.action.url,
              expectedTitleContains: message.action.title,
              waitForReadyState: message.action.waitForReadyState,
            },
            await chrome.tabs.get(message.action.tabId ?? 0)
          )
        } else {
          data = await dispatchToTab(message.action.tabId ?? 0, message.action)
        }
        break
      default:
        if (!("tabId" in message.action) || typeof message.action.tabId !== "number") {
          data = {
            ok: false,
            error: {
              code: "INVALID_ARGUMENT",
              message: `${message.action.kind} requires tabId`,
            },
          }
          break
        }
        data = await dispatchToTab(message.action.tabId, message.action)
        break
    }

    return {
      type: "result",
      requestId: message.requestId,
      ok: true,
      data,
    }
  } catch (error) {
    return {
      type: "result",
      requestId: message.requestId,
      ok: false,
      error: {
        code: "ACTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown background error",
      },
    }
  }
}
