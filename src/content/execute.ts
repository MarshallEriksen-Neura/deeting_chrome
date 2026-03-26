import type { BrowserAction, ElementLocator } from "../shared/actions"

function resolveElement(locator: ElementLocator): HTMLElement | null {
  if (locator.selector) {
    const selected = document.querySelector(locator.selector)
    if (selected instanceof HTMLElement) return selected
  }

  if (locator.text) {
    const candidates = [...document.querySelectorAll("button,a,input,label,div,span")]
    const found = candidates.find((node) => node.textContent?.trim() === locator.text)
    if (found instanceof HTMLElement) return found
  }

  return null
}

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
  }
}
