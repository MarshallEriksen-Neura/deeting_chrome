export interface BrowserAgentSettings {
  bridgeUrl: string
  allowedDomains: string[]
  autoApproveLowRisk: boolean
}

const SETTINGS_KEY = "browser-agent-settings"
const BRIDGE_STATE_KEY = "browser-agent-bridge-state"

export interface BridgeConnectionState {
  status: "idle" | "connecting" | "connected" | "error"
  lastError?: string
  updatedAt: string
}

export function defaultSettings(): BrowserAgentSettings {
  return {
    bridgeUrl: "ws://127.0.0.1:31937/bridge",
    allowedDomains: [],
    autoApproveLowRisk: true,
  }
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeSettings(input?: Partial<BrowserAgentSettings>): BrowserAgentSettings {
  const defaults = defaultSettings()
  return {
    bridgeUrl: input?.bridgeUrl?.trim() || defaults.bridgeUrl,
    allowedDomains: (input?.allowedDomains ?? defaults.allowedDomains)
      .map(normalizeDomain)
      .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index),
    autoApproveLowRisk: input?.autoApproveLowRisk ?? defaults.autoApproveLowRisk,
  }
}

export async function loadSettings(): Promise<BrowserAgentSettings> {
  const raw = await chrome.storage.local.get(SETTINGS_KEY)
  return normalizeSettings(raw[SETTINGS_KEY] as Partial<BrowserAgentSettings> | undefined)
}

export async function saveSettings(settings: BrowserAgentSettings): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: normalizeSettings(settings),
  })
}

export async function loadBridgeConnectionState(): Promise<BridgeConnectionState> {
  const sessionStorage = chrome.storage.session
  const raw = sessionStorage ? await sessionStorage.get(BRIDGE_STATE_KEY) : {}
  return (
    (raw[BRIDGE_STATE_KEY] as BridgeConnectionState | undefined) ?? {
      status: "idle",
      updatedAt: new Date(0).toISOString(),
    }
  )
}

export async function saveBridgeConnectionState(
  state: Omit<BridgeConnectionState, "updatedAt">
): Promise<void> {
  const sessionStorage = chrome.storage.session
  if (!sessionStorage) return

  await sessionStorage.set({
    [BRIDGE_STATE_KEY]: {
      ...state,
      updatedAt: new Date().toISOString(),
    } satisfies BridgeConnectionState,
  })
}
