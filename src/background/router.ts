import { applyPolicy } from "./policy"
import type { CommandMessage, ResultMessage } from "../shared/protocol"
import type { BrowserAction } from "../shared/actions"

async function dispatchToTab<T>(tabId: number, message: BrowserAction): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>
}

async function openTab(url: string): Promise<{ tabId?: number; url: string }> {
  const tab = await chrome.tabs.create({ url })
  return { tabId: tab.id, url }
}

async function navigateTab(tabId: number, url: string): Promise<{ tabId: number; url: string }> {
  await chrome.tabs.update(tabId, { url })
  return { tabId, url }
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
    const targetUrl = await resolveTargetUrl(message.action)
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
