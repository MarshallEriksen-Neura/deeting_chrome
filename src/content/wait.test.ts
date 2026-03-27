import { beforeEach, describe, expect, it } from "bun:test"
import { JSDOM } from "jsdom"
import { waitForElement } from "./wait"

describe("waitForElement", () => {
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

  beforeEach(() => {
    document.body.innerHTML = ""
    document.title = "Test page"
    window.history.replaceState({}, "", "https://example.com/")
  })

  it("returns a match immediately when the target already exists", async () => {
    document.body.innerHTML = `<button>Continue</button>`

    const result = await waitForElement({ text: "Continue" }, 50, 1)

    expect(result.ok).toBe(true)
    expect(result.matched).toBe(true)
    expect(result.locator).toEqual({ text: "Continue" })
    expect(result.url).toBe("https://example.com/")
    expect(result.title).toBe("Test page")
  })

  it("waits for an element that appears later", async () => {
    setTimeout(() => {
      document.body.innerHTML = `<input placeholder="Search" />`
    }, 5)

    const result = await waitForElement({ placeholder: "Search" }, 50, 5)

    expect(result.ok).toBe(true)
    expect(result.matched).toBe(true)
    expect(result.locator).toEqual({ placeholder: "Search" })
  })

  it("times out when the target never appears", async () => {
    const result = await waitForElement({ text: "Missing" }, 20, 5)

    expect(result.ok).toBe(false)
    expect(result.matched).toBe(false)
    expect(result.locator).toBeNull()
  })
})
