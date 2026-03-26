import { describe, expect, it } from "bun:test"

import { applyPolicy } from "./policy"

describe("applyPolicy", () => {
  it("allows low-risk actions on allowlisted domains", async () => {
    const result = await applyPolicy(
      { kind: "get_page_snapshot", tabId: 1 },
      {
        settings: {
          bridgeUrl: "ws://127.0.0.1:31937/bridge",
          allowedDomains: ["example.com"],
          autoApproveLowRisk: true,
        },
        targetUrl: "https://example.com/docs",
      }
    )

    expect(result.ok).toBe(true)
    expect(result.risk).toBe("low")
    expect(result.requiresApproval).toBe(false)
  })

  it("blocks actions on domains outside the allowlist", async () => {
    const result = await applyPolicy(
      { kind: "get_page_snapshot", tabId: 2 },
      {
        settings: {
          bridgeUrl: "ws://127.0.0.1:31937/bridge",
          allowedDomains: ["example.com"],
          autoApproveLowRisk: true,
        },
        targetUrl: "https://not-allowed.dev/page",
      }
    )

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("DOMAIN_NOT_ALLOWED")
  })

  it("requires approval for high-risk actions even on allowed domains", async () => {
    const result = await applyPolicy(
      {
        kind: "type",
        tabId: 3,
        target: { selector: "input[name='email']" },
        text: "user@example.com",
      },
      {
        settings: {
          bridgeUrl: "ws://127.0.0.1:31937/bridge",
          allowedDomains: ["example.com"],
          autoApproveLowRisk: true,
        },
        targetUrl: "https://example.com/login",
      }
    )

    expect(result.ok).toBe(false)
    expect(result.requiresApproval).toBe(true)
    expect(result.error?.code).toBe("APPROVAL_REQUIRED")
  })
})
