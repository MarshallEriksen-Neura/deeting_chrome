import type { BrowserAction, RiskLevel } from "../shared/actions"
import { loadSettings, type BrowserAgentSettings } from "./store"

export interface PolicyDecision {
  ok: boolean
  risk: RiskLevel
  requiresApproval: boolean
  error?: {
    code: string
    message: string
  }
}

const HIGH_RISK_ACTIONS = new Set<BrowserAction["kind"]>(["type"])

export interface PolicyContext {
  settings?: BrowserAgentSettings
  targetUrl?: string
}

function isDomainAllowed(targetUrl: string | undefined, settings: BrowserAgentSettings): boolean {
  if (!targetUrl) return true
  if (settings.allowedDomains.length === 0) return true

  let hostname = ""
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase()
  } catch {
    return false
  }

  return settings.allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  )
}

export async function applyPolicy(
  action: BrowserAction,
  context: PolicyContext = {}
): Promise<PolicyDecision> {
  const settings = context.settings ?? (await loadSettings())
  const risk: RiskLevel = HIGH_RISK_ACTIONS.has(action.kind) ? "high" : "low"

  if (!isDomainAllowed(context.targetUrl, settings)) {
    return {
      ok: false,
      risk,
      requiresApproval: false,
      error: {
        code: "DOMAIN_NOT_ALLOWED",
        message: `Domain is not allowed for action ${action.kind}`,
      },
    }
  }

  if (risk === "high") {
    return {
      ok: false,
      risk,
      requiresApproval: true,
      error: {
        code: "APPROVAL_REQUIRED",
        message: `Action ${action.kind} requires explicit approval`,
      },
    }
  }

  return {
    ok: true,
    risk,
    requiresApproval: false,
  }
}
