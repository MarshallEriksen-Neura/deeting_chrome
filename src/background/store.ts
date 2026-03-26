export interface BrowserAgentSettings {
  allowedDomains: string[]
  autoApproveLowRisk: boolean
}

const SETTINGS_KEY = "browser-agent-settings"

export async function loadSettings(): Promise<BrowserAgentSettings> {
  const raw = await chrome.storage.local.get(SETTINGS_KEY)
  return (
    (raw[SETTINGS_KEY] as BrowserAgentSettings | undefined) ?? {
      allowedDomains: [],
      autoApproveLowRisk: true,
    }
  )
}
