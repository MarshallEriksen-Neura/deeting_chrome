import type { ElementLocator } from "../shared/actions"

function elementText(element: Element): string {
  if (element instanceof HTMLInputElement) {
    return element.value?.trim() ?? ""
  }
  return element.textContent?.trim() ?? ""
}

function elementPlaceholder(element: Element): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.placeholder?.trim() ?? ""
  }
  return ""
}

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden") {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function resolveElement(locator: ElementLocator): HTMLElement | null {
  let candidates: HTMLElement[] = locator.selector
    ? [...document.querySelectorAll(locator.selector)].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    : [...document.querySelectorAll("*")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )

  if (locator.text) {
    candidates = candidates.filter((node) => elementText(node) === locator.text)
  }

  if (locator.role) {
    candidates = candidates.filter((node) => node.getAttribute("role") === locator.role)
  }

  if (locator.tagName) {
    const normalizedTag = locator.tagName.trim().toLowerCase()
    candidates = candidates.filter((node) => node.tagName.toLowerCase() === normalizedTag)
  }

  if (locator.placeholder) {
    candidates = candidates.filter(
      (node) => elementPlaceholder(node) === locator.placeholder
    )
  }

  if (typeof locator.index === "number" && Number.isFinite(locator.index)) {
    return candidates[locator.index] ?? null
  }

  return candidates[0] ?? null
}
