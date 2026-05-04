import { getPageSnapshot } from "./extract"
import { executeAction } from "./execute"
import { waitForElement } from "./wait"
import type { BrowserAction } from "../shared/actions"

chrome.runtime.onMessage.addListener((
  message: BrowserAction,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  if (message.kind === "get_page_snapshot") {
    sendResponse({ ok: true, data: getPageSnapshot() })
    return true
  }

  if (message.kind === "wait_for_element") {
    void waitForElement(message.target, message.timeoutMs, message.pollIntervalMs).then(
      (result) => {
        sendResponse(result)
      }
    )
    return true
  }

  if (message.kind === "wait") {
    const timeoutMs = message.timeoutMs ?? 10_000
    const pollIntervalMs = message.pollIntervalMs ?? 100
    if (message.mode === "element" && message.target) {
      void waitForElement(message.target, timeoutMs, pollIntervalMs).then((result) => {
        sendResponse(result)
      })
      return true
    }
    if (message.mode === "text" && message.text) {
      void waitForElement({ text: message.text }, timeoutMs, pollIntervalMs).then((result) => {
        sendResponse(result)
      })
      return true
    }
  }

  if (
    message.kind === "open_tab" ||
    message.kind === "navigate_tab" ||
    message.kind === "get_active_page" ||
    message.kind === "tabs" ||
    message.kind === "downloads" ||
    message.kind === "full_page_screenshot" ||
    message.kind === "wait_for_navigation"
  ) {
    sendResponse({
      ok: false,
      error: {
        code: "INVALID_ROUTING",
        message: `${message.kind} must be handled by background`,
      },
    })
    return true
  }

  sendResponse(executeAction(message))
  return true
})
