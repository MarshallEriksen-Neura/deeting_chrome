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

  if (message.kind === "open_tab" || message.kind === "navigate_tab") {
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
