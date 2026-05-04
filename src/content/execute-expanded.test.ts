import { beforeEach, describe, expect, it } from "bun:test"
import { JSDOM } from "jsdom"
import { executeAction } from "./execute"

describe("expanded browser actions", () => {
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
      HTMLButtonElement: dom.window.HTMLButtonElement,
      HTMLImageElement: dom.window.HTMLImageElement,
      HTMLAnchorElement: dom.window.HTMLAnchorElement,
      HTMLAreaElement: dom.window.HTMLAreaElement,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      Event: dom.window.Event,
      KeyboardEvent: dom.window.KeyboardEvent,
    })
  })

  it("finds elements through accessible locators and returns a stable element id", () => {
    document.body.innerHTML = `<button aria-label="Save changes">Save</button>`

    const result = executeAction({
      kind: "find_element",
      tabId: 1,
      target: { ariaLabel: "Save changes" },
    }) as any

    expect(result.ok).toBe(true)
    expect(result.element).toMatchObject({
      tagName: "button",
      ariaLabel: "Save changes",
      accessibleName: "Save changes",
    })
    expect(result.element.elementId).toStartWith("deeting-el-")
  })

  it("fills form fields and dispatches input/change events", () => {
    document.body.innerHTML = `<input placeholder="Search" />`
    const input = document.querySelector("input") as HTMLInputElement
    let inputEvents = 0
    let changeEvents = 0
    input.addEventListener("input", () => {
      inputEvents += 1
    })
    input.addEventListener("change", () => {
      changeEvents += 1
    })

    const result = executeAction({
      kind: "fill",
      tabId: 1,
      target: { placeholder: "Search" },
      text: "browser agent",
    })

    expect(result).toEqual({ ok: true })
    expect(input.value).toBe("browser agent")
    expect(inputEvents).toBe(1)
    expect(changeEvents).toBe(1)
  })

  it("reads and writes selected browser storage", () => {
    const writeResult = executeAction({
      kind: "storage_write",
      tabId: 1,
      area: "localStorage",
      key: "feature",
      value: "enabled",
    }) as unknown
    const readResult = executeAction({
      kind: "storage_read",
      tabId: 1,
      area: "localStorage",
      key: "feature",
    }) as unknown

    expect(writeResult).toEqual({ ok: true, area: "localStorage", key: "feature" })
    expect(readResult).toEqual({
      ok: true,
      area: "localStorage",
      key: "feature",
      value: "enabled",
    })
  })
})
