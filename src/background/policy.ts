import type { BrowserAction, RiskLevel } from "../shared/actions"

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

export async function applyPolicy(action: BrowserAction): Promise<PolicyDecision> {
  const risk: RiskLevel = HIGH_RISK_ACTIONS.has(action.kind) ? "high" : "low"

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
