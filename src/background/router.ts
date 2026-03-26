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
    default: {
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
      case "wait_for_navigation":
        data = await waitForNavigationFromBaseline(
          message.action,
          baselineTab ?? (await chrome.tabs.get(message.action.tabId))
        )
        break
      default:
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
