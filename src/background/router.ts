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

export async function handleCommand(message: CommandMessage): Promise<ResultMessage> {
  const gate = await applyPolicy(message.action)
  if (!gate.ok) {
    return {
      type: "result",
      requestId: message.requestId,
      ok: false,
      error: gate.error,
    }
  }

  try {
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
