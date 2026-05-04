import type { BrowserAction, ElementLocator } from "../shared/actions"
import { extractPageContent } from "./extract"
import { describeElement, getElementBounds, isVisible, resolveElement } from "./locate"

function error(code: string, message: string) {
  return { ok: false, error: { code, message } }
}

function resolveTarget(target: ElementLocator | undefined, actionName: string) {
  if (!target) return null
  const element = resolveElement(target)
  if (!element) {
    return null
  }
  return element
}

function dispatchInputEvents(element: HTMLElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function setElementValue(element: HTMLElement, value: string) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus()
    element.value = value
    dispatchInputEvents(element)
    return true
  }
  if (element.isContentEditable) {
    element.focus()
    element.textContent = value
    dispatchInputEvents(element)
    return true
  }
  return false
}

function executeKey(action: Extract<BrowserAction, { kind: "key" }>) {
  const target = resolveTarget(action.target, "key") ?? document.activeElement
  if (!(target instanceof HTMLElement)) {
    return error("ELEMENT_NOT_FOUND", "key target not found")
  }
  target.focus()
  const eventInit = { key: action.key, bubbles: true, cancelable: true }
  target.dispatchEvent(new KeyboardEvent("keydown", eventInit))
  target.dispatchEvent(new KeyboardEvent("keyup", eventInit))
  return { ok: true, key: action.key }
}

function executeSelect(action: Extract<BrowserAction, { kind: "select" }>) {
  const element = resolveTarget(action.target, "select")
  if (!element) return error("ELEMENT_NOT_FOUND", "select target not found")

  if (element instanceof HTMLSelectElement) {
    const values = Array.isArray(action.value) ? action.value.map(String) : [String(action.value ?? "")]
    for (const option of element.options) {
      option.selected = values.includes(option.value) || values.includes(option.text)
    }
    dispatchInputEvents(element)
    return { ok: true, value: element.multiple ? values : element.value }
  }

  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    element.checked = typeof action.checked === "boolean" ? action.checked : Boolean(action.value ?? true)
    dispatchInputEvents(element)
    return { ok: true, checked: element.checked }
  }

  if (element instanceof HTMLInputElement) {
    element.value = String(action.value ?? "")
    dispatchInputEvents(element)
    return { ok: true, value: element.value }
  }

  return error("ELEMENT_NOT_SELECTABLE", "select target is not selectable")
}

function readStorage(area: "localStorage" | "sessionStorage", key?: string) {
  const storage = area === "sessionStorage" ? window.sessionStorage : window.localStorage
  if (key) {
    return { area, key, value: storage.getItem(key) }
  }
  return {
    area,
    entries: Object.keys(storage)
      .slice(0, 200)
      .map((entryKey) => ({ key: entryKey, value: storage.getItem(entryKey) })),
  }
}

function writeStorage(area: "localStorage" | "sessionStorage", key: string, value: unknown) {
  const storage = area === "sessionStorage" ? window.sessionStorage : window.localStorage
  storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
  return { ok: true, area, key }
}

function runAccessibilityAudit() {
  const controls = [...document.querySelectorAll("button,input,textarea,select,a[href]")]
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .slice(0, 300)
  const issues = controls
    .map((element) => {
      const snapshot = describeElement(element)
      const missingName =
        !snapshot.accessibleName &&
        ["button", "input", "textarea", "select", "a"].includes(snapshot.tagName)
      if (!missingName) return null
      return {
        code: "MISSING_ACCESSIBLE_NAME",
        element: snapshot,
      }
    })
    .filter(Boolean)

  return {
    ok: true,
    checked: controls.length,
    issues,
  }
}

export function executeAction(action: BrowserAction) {
  switch (action.kind) {
    case "click": {
      const element = resolveElement(action.target)
      if (!element) {
        return error("ELEMENT_NOT_FOUND", "click target not found")
      }
      element.click()
      return { ok: true }
    }
    case "type": {
      const element = resolveTarget(action.target, "type")
      if (!element || !setElementValue(element, action.text)) {
        return error("ELEMENT_NOT_FOUND", "type target not found")
      }
      return { ok: true }
    }
    case "fill": {
      const element = resolveTarget(action.target, "fill")
      if (!element || !setElementValue(element, action.text)) {
        return error("ELEMENT_NOT_FOUND", "fill target not found")
      }
      if (action.submitAfter) {
        element.closest("form")?.requestSubmit()
      }
      return { ok: true }
    }
    case "key":
      return executeKey(action)
    case "select":
      return executeSelect(action)
    case "scroll": {
      const amount = action.amount ?? 600
      const top = action.direction === "down" ? amount : -amount
      window.scrollBy({ top, behavior: "smooth" })
      return { ok: true }
    }
    case "scroll_into_view": {
      const element = resolveElement(action.target)
      if (!element) {
        return error("ELEMENT_NOT_FOUND", "scroll target not found")
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
    case "find_element": {
      const element = resolveElement(action.target)
      if (!element) return error("ELEMENT_NOT_FOUND", "find_element target not found")
      return { ok: true, element: describeElement(element) }
    }
    case "extract":
      return extractPageContent(action)
    case "region_screenshot": {
      const element = action.target ? resolveElement(action.target) : null
      if (action.target && !element) return error("ELEMENT_NOT_FOUND", "screenshot target not found")
      return {
        ok: true,
        region: element ? getElementBounds(element) : action.region,
        devicePixelRatio: window.devicePixelRatio,
      }
    }
    case "highlight": {
      const element = resolveElement(action.target)
      if (!element) return error("ELEMENT_NOT_FOUND", "highlight target not found")
      const previousOutline = element.style.outline
      const previousOutlineOffset = element.style.outlineOffset
      element.style.outline = "3px solid #f59e0b"
      element.style.outlineOffset = "2px"
      setTimeout(() => {
        element.style.outline = previousOutline
        element.style.outlineOffset = previousOutlineOffset
      }, action.durationMs ?? 1800)
      element.scrollIntoView({ block: "center", inline: "nearest" })
      return { ok: true, element: describeElement(element) }
    }
    case "storage_read":
      return { ok: true, ...readStorage(action.area, action.key) }
    case "storage_write":
      return writeStorage(action.area, action.key, action.value)
    case "eval": {
      if (action.mode && action.mode !== "read") {
        return error("EVAL_BLOCKED", "write eval is blocked in the extension content surface")
      }
      const result = Function(`"use strict"; return (${action.code});`)()
      return { ok: true, result: typeof result === "undefined" ? null : result }
    }
    case "accessibility_audit":
      return runAccessibilityAudit()
    case "console_log":
      return {
        ok: true,
        logs: [],
        warning: "Console history is not available from the content script after page load.",
      }
    case "network_log": {
      const entries = performance
        .getEntriesByType("resource")
        .slice(-Math.max(1, action.limit ?? 100))
        .map((entry) => ({
          name: entry.name,
          initiatorType: (entry as PerformanceResourceTiming).initiatorType,
          duration: entry.duration,
          startTime: entry.startTime,
        }))
      return { ok: true, entries }
    }
    case "upload_file":
      return error(
        "PERMISSION_DENIED",
        "Chrome extensions cannot attach arbitrary local files from a path inside a content script"
      )
    case "dialog":
      return error("DIALOG_NOT_PRESENT", "No controllable dialog is present in the content script")
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
      return error("INVALID_ROUTING", "snapshot action should be handled separately")
    case "wait_for_element":
    case "wait":
      return {
        ok: false,
        error: { code: "INVALID_ROUTING", message: "wait action should be handled separately" },
      }
    case "open_tab":
    case "navigate_tab":
    case "full_page_screenshot":
    case "get_active_page":
    case "tabs":
    case "downloads":
    case "wait_for_navigation":
      return error("INVALID_ROUTING", `${action.kind} action should be handled by background`)
  }
}
