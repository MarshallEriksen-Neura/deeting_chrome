import type { ElementBounds, ElementLocator, ElementSnapshot } from "../shared/actions"

const ELEMENT_ID_ATTRIBUTE = "data-deeting-agent-id"
let nextElementId = 1

function elementText(element: Element): string {
  if (element instanceof HTMLInputElement) {
    return element.value?.trim() ?? ""
  }
  return element.textContent?.trim() ?? ""
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? ""
}

function elementPlaceholder(element: Element): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.placeholder?.trim() ?? ""
  }
  return ""
}

function elementHref(element: Element): string {
  return element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement
    ? element.href
    : ""
}

export function getElementAccessibleName(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby")
  if (labelledBy) {
    const value = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim()
    if (value) return normalizeText(value)
  }

  const ariaLabel = element.getAttribute("aria-label")
  if (ariaLabel?.trim()) return normalizeText(ariaLabel)

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const labels = Array.from(element.labels ?? [])
      .map((label) => label.textContent ?? "")
      .join(" ")
    if (labels.trim()) return normalizeText(labels)
  }

  if (element instanceof HTMLImageElement && element.alt.trim()) {
    return normalizeText(element.alt)
  }

  return normalizeText(elementText(element))
}

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden") {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function getElementId(element: HTMLElement): string {
  const existing = element.getAttribute(ELEMENT_ID_ATTRIBUTE)
  if (existing?.trim()) return existing

  const id = `deeting-el-${nextElementId++}`
  element.setAttribute(ELEMENT_ID_ATTRIBUTE, id)
  return id
}

export function getElementBounds(element: HTMLElement): ElementBounds {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  }
}

function selectorForElement(element: HTMLElement): string | undefined {
  if (element.id) return `#${CSS.escape(element.id)}`
  const testId = element.getAttribute("data-testid") ?? element.getAttribute("data-test")
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`
  const tagName = element.tagName.toLowerCase()
  const className = [...element.classList].slice(0, 2).map((item) => `.${CSS.escape(item)}`).join("")
  return `${tagName}${className}`
}

export function describeElement(element: HTMLElement): ElementSnapshot {
  return {
    elementId: getElementId(element),
    tagName: element.tagName.toLowerCase(),
    text: normalizeText(elementText(element)).slice(0, 300),
    role: element.getAttribute("role") ?? undefined,
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    accessibleName: getElementAccessibleName(element).slice(0, 300),
    selector: selectorForElement(element),
    href: elementHref(element) || undefined,
    testId:
      element.getAttribute("data-testid") ??
      element.getAttribute("data-test") ??
      undefined,
    placeholder: elementPlaceholder(element) || undefined,
    visible: isVisible(element),
    disabled:
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.disabled
        : element.getAttribute("aria-disabled") === "true",
    bounds: getElementBounds(element),
  }
}

export function resolveElement(locator: ElementLocator): HTMLElement | null {
  let candidates: HTMLElement[] = locator.selector
    ? [...document.querySelectorAll(locator.selector)].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    : [...document.querySelectorAll("*")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )

  if (locator.elementId) {
    candidates = candidates.filter(
      (node) => node.getAttribute(ELEMENT_ID_ATTRIBUTE) === locator.elementId
    )
  }

  if (locator.text) {
    candidates = candidates.filter((node) => normalizeText(elementText(node)) === normalizeText(locator.text))
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

  if (locator.ariaLabel) {
    candidates = candidates.filter(
      (node) => normalizeText(node.getAttribute("aria-label")) === normalizeText(locator.ariaLabel)
    )
  }

  if (locator.accessibleName) {
    candidates = candidates.filter(
      (node) => getElementAccessibleName(node) === normalizeText(locator.accessibleName)
    )
  }

  if (locator.href) {
    candidates = candidates.filter((node) => elementHref(node) === locator.href)
  }

  if (locator.testId) {
    candidates = candidates.filter(
      (node) =>
        node.getAttribute("data-testid") === locator.testId ||
        node.getAttribute("data-test") === locator.testId
    )
  }

  if (typeof locator.index === "number" && Number.isFinite(locator.index)) {
    return candidates[locator.index] ?? null
  }

  return candidates[0] ?? null
}
