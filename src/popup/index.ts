import { loadBridgeConnectionState, loadSettings } from "../background/store"
import { BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE } from "../background/bridge"
import {
  BROWSER_MANUAL_QUERY_MESSAGE_TYPE,
  type BrowserManualQueryResponse,
} from "../shared/manual-query"

/* ── iOS System Colors ────────────────────────────────── */

const C = {
  bg: "#F2F2F7",
  card: "#FFFFFF",
  label: "#000000",
  secondary: "rgba(60,60,67,0.6)",
  tertiary: "rgba(60,60,67,0.3)",
  separator: "rgba(60,60,67,0.12)",
  tint: "#007AFF",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF3B30",
  fill: "rgba(120,120,128,0.12)",
} as const

/* ── Helpers ──────────────────────────────────────────── */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function sectionHeader(text: string): string {
  return `<div style="padding:24px 16px 7px;font-size:13px;font-weight:400;color:${C.secondary};text-transform:uppercase;letter-spacing:-0.01em;">${escapeHtml(text)}</div>`
}

function sep(): string {
  return `<div style="height:0.5px;background:${C.separator};margin-left:16px;"></div>`
}

function renderStatusIndicator(status: string): string {
  const color =
    status === "connected"
      ? C.green
      : status === "connecting"
        ? C.orange
        : status === "error"
          ? C.red
          : C.tertiary

  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;background:${C.fill};">
    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
    <span style="font-size:13px;font-weight:500;color:${C.secondary};">${escapeHtml(label)}</span>
  </div>`
}

function formatUpdatedAt(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) return null
  return parsed.toLocaleString()
}

function renderDomainPills(domains: string[]): string {
  if (domains.length === 0) return ""
  const visible = domains.slice(0, 4)
  const remaining = domains.length - visible.length
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
    ${visible.map((d) => `<span style="display:inline-flex;padding:4px 10px;border-radius:8px;background:rgba(0,122,255,0.1);color:${C.tint};font-size:13px;font-weight:500;">${escapeHtml(d)}</span>`).join("")}
    ${remaining > 0 ? `<span style="display:inline-flex;padding:4px 10px;border-radius:8px;background:${C.fill};color:${C.secondary};font-size:13px;font-weight:500;">+${remaining}</span>` : ""}
  </div>`
}

function renderToggleDisplay(isOn: boolean): string {
  return `<div style="position:relative;width:51px;height:31px;border-radius:15.5px;background:${isOn ? C.green : "rgba(120,120,128,0.16)"};flex-shrink:0;">
    <div style="position:absolute;top:2px;${isOn ? "left:22px" : "left:2px"};width:27px;height:27px;border-radius:50%;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.15),0 1px 1px rgba(0,0,0,0.06);"></div>
  </div>`
}

function resultSummary(result: BrowserManualQueryResponse["data"] | undefined): string {
  const count = typeof result?.resultCount === "number" ? result.resultCount : 0
  if (result?.kind === "ask_current_page") {
    return "Current page is ready in Island."
  }
  const kind = result?.kind === "search_memory" ? "memory" : "wiki"
  if (count <= 0) {
    return `No related ${kind} results were found.`
  }
  return `Found ${count} related ${kind} result${count === 1 ? "" : "s"} in Island.`
}

async function runManualQuery(method: "search_wiki" | "search_memory" | "ask_current_page") {
  const response = (await chrome.runtime.sendMessage({
    type: BROWSER_MANUAL_QUERY_MESSAGE_TYPE,
    method,
  })) as BrowserManualQueryResponse | undefined

  if (!response?.ok) {
    throw new Error(response?.error || "Lookup failed")
  }

  return response.data
}

async function getActiveTabSummary() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  const title = typeof tab?.title === "string" ? tab.title : "No active page"
  const url = typeof tab?.url === "string" ? tab.url : ""
  let host = ""
  try {
    host = url ? new URL(url).host : ""
  } catch {
    host = ""
  }
  return { title, host }
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const W = 384
  document.documentElement.style.width = `${W}px`
  document.body.style.width = `${W}px`
  document.body.style.minWidth = `${W}px`
  document.body.style.margin = "0"
  document.body.style.background = C.bg
  document.body.style.overflowX = "hidden"
  app.style.width = `${W}px`

  await chrome.runtime
    .sendMessage({ type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE, source: "popup" })
    .catch(() => undefined)

  const [settings, bridgeState, activeTab] = await Promise.all([
    loadSettings(),
    loadBridgeConnectionState(),
    getActiveTabSummary(),
  ])

  const iconUrl = chrome.runtime.getURL("assets/icon.png")
  const updatedAt = formatUpdatedAt(bridgeState.updatedAt)

  const actionBtnStyle = `display:block;width:100%;padding:11px 16px;border:none;background:transparent;font-family:inherit;font-size:15px;color:${C.tint};text-align:center;cursor:pointer;`

  app.innerHTML = `
    <main style="width:${W}px;box-sizing:border-box;padding-bottom:20px;background:${C.bg};font-family:-apple-system,system-ui,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;">

      <!-- Header -->
      <header style="padding:16px 16px 0;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#1C1C1E;display:grid;place-items:center;flex-shrink:0;">
          <img src="${iconUrl}" alt="" width="24" height="24" style="display:block;" />
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:20px;font-weight:700;color:${C.label};letter-spacing:-0.02em;">Deeting</div>
          <div style="font-size:13px;color:${C.secondary};margin-top:1px;">Browser Agent</div>
        </div>
        ${renderStatusIndicator(bridgeState.status)}
      </header>

      <!-- Connection -->
      ${sectionHeader("Connection")}
      <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
        <div style="padding:11px 16px;">
          <div style="font-size:15px;color:${C.label};">Bridge Endpoint</div>
          <div style="font-size:13px;color:${C.secondary};margin-top:2px;overflow-wrap:anywhere;">${escapeHtml(settings.bridgeUrl)}</div>
        </div>
        ${sep()}
        <div style="padding:11px 16px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:15px;color:${C.label};">Last Update</span>
          <span style="font-size:15px;color:${C.secondary};">${updatedAt ? escapeHtml(updatedAt) : "Waiting\u2026"}</span>
        </div>
        ${bridgeState.lastError ? `
          ${sep()}
          <div style="padding:11px 16px;background:rgba(255,59,48,0.05);">
            <div style="font-size:13px;color:${C.red};line-height:1.4;overflow-wrap:anywhere;">${escapeHtml(bridgeState.lastError)}</div>
          </div>
        ` : ""}
      </div>

      <!-- Current Page -->
      ${sectionHeader("Current Page")}
      <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
        <div style="padding:11px 16px;">
          <div style="font-size:15px;font-weight:500;color:${C.label};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(activeTab.title)}</div>
          <div style="font-size:13px;color:${C.secondary};margin-top:2px;">${escapeHtml(activeTab.host || "No active host")}</div>
        </div>
      </div>

      <!-- Actions -->
      <div style="margin:8px 16px 0;border-radius:12px;background:${C.card};overflow:hidden;">
        <button id="ask-current-page" style="${actionBtnStyle}font-weight:500;">Ask Current Page</button>
        ${sep()}
        <button id="search-wiki" style="${actionBtnStyle}">Search Wiki</button>
        ${sep()}
        <button id="search-memory" style="${actionBtnStyle}">Search Memory</button>
      </div>
      <div id="lookup-status" style="padding:7px 32px 0;font-size:13px;color:${C.secondary};line-height:1.4;">Query results will open in the desktop Island.</div>

      <!-- Security -->
      ${sectionHeader("Security")}
      <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
        <div style="padding:11px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:15px;color:${C.label};">Allowed Domains</span>
            <span style="font-size:15px;color:${C.secondary};">${escapeHtml(settings.allowedDomains.length === 0 ? "All" : `${settings.allowedDomains.length} listed`)}</span>
          </div>
          ${renderDomainPills(settings.allowedDomains)}
        </div>
        ${sep()}
        <div style="padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;color:${C.label};">Low-Risk Auto Approval</div>
            <div style="font-size:13px;color:${C.secondary};margin-top:1px;">${settings.autoApproveLowRisk ? "Enabled" : "Disabled"}</div>
          </div>
          ${renderToggleDisplay(settings.autoApproveLowRisk)}
        </div>
      </div>

      <!-- Settings -->
      <div style="margin:24px 16px 0;border-radius:12px;background:${C.card};overflow:hidden;">
        <button id="open-options" style="display:flex;width:100%;padding:11px 16px;border:none;background:transparent;font-family:inherit;font-size:15px;color:${C.tint};align-items:center;justify-content:center;gap:4px;cursor:pointer;">
          Settings
          <span style="font-size:17px;color:${C.tertiary};font-weight:300;">\u203A</span>
        </button>
      </div>
    </main>
  `

  /* ── Event Listeners ──────────────────────────────────── */

  document.getElementById("open-options")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage()
  })

  const lookupStatus = document.getElementById("lookup-status")
  const setLookupStatus = (message: string, tone: "neutral" | "error" | "success" = "neutral") => {
    if (!lookupStatus) return
    const color =
      tone === "error" ? C.red : tone === "success" ? C.green : C.secondary
    lookupStatus.textContent = message
    lookupStatus.setAttribute(
      "style",
      `padding:7px 32px 0;font-size:13px;line-height:1.4;color:${color};`
    )
  }

  const bindLookupButton = (id: string, method: "search_wiki" | "search_memory" | "ask_current_page") => {
    document.getElementById(id)?.addEventListener("click", async () => {
      setLookupStatus("Running lookup\u2026", "neutral")
      try {
        const result = await runManualQuery(method)
        setLookupStatus(resultSummary(result), "success")
      } catch (error) {
        setLookupStatus(
          error instanceof Error ? error.message : "Lookup failed",
          "error"
        )
      }
    })
  }

  bindLookupButton("ask-current-page", "ask_current_page")
  bindLookupButton("search-wiki", "search_wiki")
  bindLookupButton("search-memory", "search_memory")
}

void main()
