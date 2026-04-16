import { describe, expect, it } from "bun:test"

import { renderHtmlDocument } from "./build"

describe("renderHtmlDocument", () => {
  it("renders the popup shell with a mount root and module script", () => {
    const html = renderHtmlDocument("Deeting Browser Agent", "popup/index.js", "popup")

    expect(html).toContain("<title>Deeting Browser Agent</title>")
    expect(html).toContain('<div id="app"></div>')
    expect(html).toContain('<script type="module" src="./popup/index.js"></script>')
    expect(html).toContain("background: transparent;")
    expect(html).toContain("overflow: hidden;")
  })
})
