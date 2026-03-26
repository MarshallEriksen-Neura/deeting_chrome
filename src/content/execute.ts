import type { BrowserAction, ElementLocator } from "../shared/actions"
import { isVisible, resolveElement } from "./locate"

export function executeAction(action: Exclude<BrowserAction, { kind: "open_tab" | "navigate_tab" }>) {
  switch (action.kind) {
    case "click": {
      const element = resolveElement(action.target)
      if (!element) {
        return { ok: false, error: { code: "ELEMENT_NOT_FOUND", message: "click target not found" } }
      }
      element.click()
      return { ok: true }
    }
    case "type": {
      const element = resolveElement(action.target)
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        return { ok: false, error: { code: "ELEMENT_NOT_FOUND", message: "type target not found" } }
      }
      element.focus()
      element.value = action.text
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      return { ok: true }
    }
    case "scroll": {
      const amount = action.amount ?? 600
      const top = action.direction === "down" ? amount : -amount
      window.scrollBy({ top, behavior: "smooth" })
      return { ok: true }
    }
    case "scroll_into_view": {
      const element = resolveElement(action.target)
      if (!element) {
        return {
          ok: false,
          error: { code: "ELEMENT_NOT_FOUND", message: "scroll target not found" },
        }
      }
      element.scrollIntoView({
        block:
          action.align === "start" ||
          action.align === "center" ||
          action.align === "end"
            ? action.align
            : "nearest",
        inline: "nearest",
      })
      return { ok: true, visible: isVisible(element) }
    }
    case "query_dom": {
      const matches = action.selector
        ? [...document.querySelectorAll(action.selector)].slice(0, 20)
        : []
      return {
        ok: true,
        data: matches.map((node) => ({
          text: node.textContent?.trim() ?? "",
          html: node instanceof HTMLElement ? node.outerHTML.slice(0, 500) : "",
        })),
      }
    }
    case "get_page_snapshot":
      return { ok: false, error: { code: "INVALID_ROUTING", message: "snapshot action should be handled separately" } }
    case "wait_for_element":
      return {
        ok: false,
        error: { code: "INVALID_ROUTING", message: "wait action should be handled separately" },
      }
  }
}
