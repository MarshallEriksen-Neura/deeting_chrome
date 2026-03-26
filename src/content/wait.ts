import type { ElementLocator } from "../shared/actions"
import { isVisible, resolveElement } from "./locate"

export interface WaitForElementResult {
  ok: boolean
  matched: boolean
  locator: ElementLocator | null
  visible: boolean
  url: string
  title: string
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

export async function waitForElement(
  target: ElementLocator,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<WaitForElementResult> {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const element = resolveElement(target)
    if (element) {
      return {
        ok: true,
        matched: true,
        locator: target,
        visible: isVisible(element),
        url: window.location.href,
        title: document.title,
      }
    }

    await wait(pollIntervalMs)
  }

  return {
    ok: false,
    matched: false,
    locator: null,
    visible: false,
    url: window.location.href,
    title: document.title,
  }
}
