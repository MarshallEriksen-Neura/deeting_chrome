import { beforeEach, describe, expect, it, mock } from "bun:test"
import { JSDOM } from "jsdom"
import { executeAction } from "./execute"

describe("scroll_into_view", () => {
  beforeEach(() => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: "https://example.com/",
    })

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
      HTMLSelectElement: dom.window.HTMLSelectElement,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    })
  })

  it("scrolls the located element into view", () => {
    document.body.innerHTML = `<button class="primary">Continue</button>`
    const button = document.querySelector("button") as HTMLButtonElement
    const scrollIntoViewMock = mock(() => undefined)
    button.scrollIntoView = scrollIntoViewMock as typeof button.scrollIntoView
    button.getBoundingClientRect = (() =>
      ({
        width: 120,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 120,
        x: 0,
        y: 0,
        toJSON() {
          return {}
        },
      }) as DOMRect) as typeof button.getBoundingClientRect

    const result = executeAction({
      kind: "scroll_into_view",
      tabId: 42,
      target: { selector: "button.primary" },
      align: "center",
    })

    expect(result).toEqual({ ok: true, visible: true })
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
  })

  it("returns a not found error when the target cannot be located", () => {
    const result = executeAction({
      kind: "scroll_into_view",
      tabId: 42,
      target: { text: "Missing" },
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ELEMENT_NOT_FOUND",
        message: "scroll target not found",
      },
    })
  })
})

describe("scroll", () => {
  beforeEach(() => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: "https://example.com/",
    })

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
      HTMLSelectElement: dom.window.HTMLSelectElement,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    })
  })

  it("scrolls the page by the requested amount", () => {
    const scrollByMock = mock(() => undefined)
    window.scrollBy = scrollByMock as typeof window.scrollBy

    const result = executeAction({
      kind: "scroll",
      tabId: 42,
      direction: "down",
      amount: 320,
    })

    expect(result).toEqual({ ok: true })
    expect(scrollByMock).toHaveBeenCalledWith({ top: 320, behavior: "smooth" })
  })

  it("defaults to a 600px upward scroll when amount is omitted", () => {
    const scrollByMock = mock(() => undefined)
    window.scrollBy = scrollByMock as typeof window.scrollBy

    const result = executeAction({
      kind: "scroll",
      tabId: 42,
      direction: "up",
    })

    expect(result).toEqual({ ok: true })
    expect(scrollByMock).toHaveBeenCalledWith({ top: -600, behavior: "smooth" })
  })
})
