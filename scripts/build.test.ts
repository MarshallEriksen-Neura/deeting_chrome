import { describe, expect, it } from "bun:test"

import { renderHtmlDocument } from "./build"

describe("renderHtmlDocument", () => {
  it("renders a mount root and module script for the requested page", () => {
    const html = renderHtmlDocument("Deeting Browser Agent", "popup/index.js")

    expect(html).toContain("<title>Deeting Browser Agent</title>")
    expect(html).toContain('<div id="app"></div>')
    expect(html).toContain('<script type="module" src="./popup/index.js"></script>')
  })
})
