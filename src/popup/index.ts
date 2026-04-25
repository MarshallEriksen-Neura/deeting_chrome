import { loadBridgeConnectionState, loadSettings } from "../background/store"
import { BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE } from "../background/bridge"
import {
  BROWSER_MANUAL_QUERY_MESSAGE_TYPE,
  type BrowserManualQueryResponse,
} from "../shared/manual-query"

/* ── iOS Design Tokens ────────────────────────────────── */

const C = {
  bg: "#EAF0F8",
  shellTop: "#FBFDFF",
  shellBottom: "#E8EEF7",
  card: "rgba(255,255,255,0.92)",
  cardBorder: "rgba(255,255,255,0.88)",
  label: "#111827",
  secondary: "rgba(94,105,124,0.88)",
  tertiary: "rgba(122,132,150,0.4)",
  separator: "rgba(134,145,164,0.16)",
  tint: "#1677FF",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF3B30",
  indigo: "#5856D6",
  purple: "#AF52DE",
  fill: "rgba(130,145,170,0.12)",
  scrollThumb: "rgba(148,159,180,0.9)",
  scrollThumbHover: "rgba(117,129,151,0.95)",
} as const

/* ── Icons (Feather-stroke 15×15 on colored 29×29 rounded squares) ── */

const _s = (d: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const _ic = (bg: string, svg: string) =>
  `<div style="width:29px;height:29px;border-radius:8px;background:${bg};display:grid;place-items:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${svg}</div>`

const IC = {
  link: _ic(C.tint, _s(`<path d="M15 7h3a5 5 0 010 10h-3M9 17H6A5 5 0 016 7h3"/><line x1="8" y1="12" x2="16" y2="12"/>`)),
  clock: _ic(C.green, _s(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`)),
  doc: _ic(C.indigo, _s(`<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>`)),
  globe: _ic(C.orange, _s(`<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>`)),
  shield: _ic(C.purple, _s(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`)),
  gear: _ic("#8E8E93", `<svg width="14" height="14" viewBox="0 0 20 20" fill="#fff"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`),
}

const chevron = `<svg width="7" height="12" viewBox="0 0 7 12" fill="none" style="flex-shrink:0;"><path d="M1 1l5 5-5 5" stroke="rgba(60,60,67,0.3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/* ── Layout Helpers ───────────────────────────────────── */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/** iOS section header — uppercase small caps above a card group */
function sectionHeader(text: string): string {
  return `<div style="padding:24px 18px 9px;font-size:12px;font-weight:700;color:${C.secondary};text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(text)}</div>`
}

/** Hairline separator inset to align with row text (past the icon) */
function sep(inset = 61): string {
  return `<div style="height:0.5px;background:${C.separator};margin-left:${inset}px;"></div>`
}

/* ── Data Helpers ─────────────────────────────────────── */

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

  return `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.76);border:1px solid rgba(255,255,255,0.9);box-shadow:inset 0 1px 0 rgba(255,255,255,0.8),0 10px 24px rgba(111,124,147,0.12);">
    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
    <span style="font-size:13px;font-weight:700;color:${C.secondary};">${escapeHtml(label)}</span>
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
    ${visible.map((d) => `<span style="display:inline-flex;padding:3px 9px;border-radius:6px;background:rgba(0,122,255,0.1);color:${C.tint};font-size:12px;font-weight:500;">${escapeHtml(d)}</span>`).join("")}
    ${remaining > 0 ? `<span style="display:inline-flex;padding:3px 9px;border-radius:6px;background:${C.fill};color:${C.secondary};font-size:12px;font-weight:500;">+${remaining}</span>` : ""}
  </div>`
}

function renderToggle(isOn: boolean): string {
  return `<div style="position:relative;width:51px;height:31px;border-radius:15.5px;background:${isOn ? C.green : "rgba(120,120,128,0.16)"};flex-shrink:0;">
    <div style="position:absolute;top:2px;${isOn ? "left:22px" : "left:2px"};width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.15),0 0 1px rgba(0,0,0,0.1);"></div>
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

function ensurePopupStyles() {
  if (document.getElementById("deeting-popup-style")) return

  const style = document.createElement("style")
  style.id = "deeting-popup-style"
  style.textContent = `
    html, body {
      scrollbar-width: thin;
      scrollbar-color: ${C.scrollThumb} transparent;
    }

    body {
      overscroll-behavior: none;
    }

    #popup-shell {
      scrollbar-width: thin;
      scrollbar-color: ${C.scrollThumb} transparent;
      scrollbar-gutter: stable;
    }

    #popup-shell::-webkit-scrollbar {
      width: 5px;
    }

    #popup-shell::-webkit-scrollbar-track {
      background: transparent;
    }

    #popup-shell::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, ${C.scrollThumb} 0%, ${C.scrollThumbHover} 100%);
      border-radius: 999px;
      border: 1px solid transparent;
      background-clip: padding-box;
    }

    #popup-shell::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, ${C.scrollThumbHover} 0%, rgba(99, 112, 137, 0.98) 100%);
    }

    #popup-shell::-webkit-scrollbar-button {
      width: 0;
      height: 0;
      display: none;
    }

    #popup-shell button {
      transition:
        transform 150ms ease,
        box-shadow 180ms ease,
        background-color 180ms ease,
        border-color 180ms ease;
    }

    #popup-shell button:hover {
      transform: translateY(-1px);
    }

    #popup-shell button:active {
      transform: translateY(0);
    }
  `

  document.head.append(style)
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const W = 404
  const MAX_POPUP_HEIGHT = 600
  const POPUP_RADIUS = 32
  const FONT = `-apple-system,system-ui,'Helvetica Neue',sans-serif`
  ensurePopupStyles()
  document.documentElement.style.width = `${W}px`
  document.documentElement.style.minWidth = `${W}px`
  document.documentElement.style.overflow = "hidden"
  document.documentElement.style.background = "transparent"
  document.documentElement.style.borderRadius = `${POPUP_RADIUS}px`
  document.body.style.width = `${W}px`
  document.body.style.minWidth = `${W}px`
  document.body.style.margin = "0"
  document.body.style.padding = "0"
  document.body.style.boxSizing = "border-box"
  document.body.style.background = "transparent"
  document.body.style.overflow = "hidden"
  document.body.style.borderRadius = `${POPUP_RADIUS}px`
  app.style.width = `${W}px`
  app.style.minWidth = `${W}px`
  app.style.background = "transparent"
  app.style.overflow = "hidden"
  app.style.borderRadius = `${POPUP_RADIUS}px`
  app.style.clipPath = `inset(0 round ${POPUP_RADIUS}px)`

  await chrome.runtime
    .sendMessage({ type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE, source: "popup" })
    .catch(() => undefined)

  const [settings, bridgeState, activeTab] = await Promise.all([
    loadSettings(),
    loadBridgeConnectionState(),
    getActiveTabSummary(),
  ])

  const iconUrl = chrome.runtime.getURL("assets/icon.svg")
  const updatedAt = formatUpdatedAt(bridgeState.updatedAt)

  /* ── Row style constants ─── */
  const ROW = `padding:16px 18px;display:flex;align-items:center;gap:14px;`
  const CARD = `margin:0 18px;border-radius:22px;background:${C.card};border:1px solid ${C.cardBorder};overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.82),0 18px 34px rgba(110,124,149,0.12),0 4px 10px rgba(98,111,132,0.06);backdrop-filter:blur(18px);`
  const ACTION_ROW = `display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:16px 18px;border:none;background:transparent;font-family:${FONT};font-size:16px;font-weight:600;color:${C.tint};text-align:center;cursor:pointer;`

  app.innerHTML = `
    <main id="popup-shell" style="width:${W}px;max-height:${MAX_POPUP_HEIGHT}px;box-sizing:border-box;padding-bottom:22px;background:
      radial-gradient(circle at 14% 10%, rgba(255,255,255,0.98), transparent 26%),
      radial-gradient(circle at 88% 12%, rgba(115,164,255,0.14), transparent 24%),
      linear-gradient(180deg,${C.shellTop} 0%,${C.bg} 42%,${C.shellBottom} 100%);
      font-family:${FONT};-webkit-font-smoothing:antialiased;border-radius:${POPUP_RADIUS}px;border:1px solid rgba(255,255,255,0.92);overflow:auto;box-shadow:inset 0 1px 0 rgba(255,255,255,0.86),0 28px 60px rgba(59,78,111,0.18),0 8px 18px rgba(74,93,124,0.08);">

      <!-- ─ Header ────────────────────────────────── -->
      <header style="padding:18px 18px 0;display:flex;align-items:center;gap:14px;">
        <img src="${iconUrl}" alt="" width="44" height="44" style="display:block;flex-shrink:0;" />
        <div style="flex:1;min-width:0;">
          <div style="font-size:21px;font-weight:800;color:${C.label};letter-spacing:-0.04em;">Deeting</div>
          <div style="font-size:13px;color:${C.secondary};margin-top:3px;">Browser Agent</div>
        </div>
        ${renderStatusIndicator(bridgeState.status)}
      </header>

      <!-- ─ Connection ────────────────────────────── -->
      ${sectionHeader("Connection")}
      <div style="${CARD}">
        <div style="${ROW}">
          ${IC.link}
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${C.label};">Bridge Endpoint</div>
            <div style="font-size:13px;color:${C.secondary};margin-top:3px;overflow-wrap:anywhere;">${escapeHtml(settings.bridgeUrl)}</div>
          </div>
        </div>
        ${sep()}
        <div style="${ROW}">
          ${IC.clock}
          <span style="flex:1;font-size:15px;font-weight:700;color:${C.label};">Last Update</span>
          <span style="font-size:15px;color:${C.secondary};flex-shrink:0;">${updatedAt ? escapeHtml(updatedAt) : "Waiting\u2026"}</span>
        </div>
        ${bridgeState.lastError ? `
          ${sep()}
          <div style="padding:10px 18px 12px 61px;background:rgba(255,59,48,0.05);">
            <div style="font-size:13px;color:${C.red};line-height:1.4;overflow-wrap:anywhere;">${escapeHtml(bridgeState.lastError)}</div>
          </div>
        ` : ""}
      </div>

      <!-- ─ Current Page ──────────────────────────── -->
      ${sectionHeader("Current Page")}
      <div style="${CARD}">
        <div style="${ROW}">
          ${IC.doc}
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${C.label};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(activeTab.title)}</div>
            <div style="font-size:13px;color:${C.secondary};margin-top:3px;">${escapeHtml(activeTab.host || "No active host")}</div>
          </div>
        </div>
      </div>

      <!-- ─ Primary Action ────────────────────────── -->
      <div style="margin:14px 18px 0;">
        <button id="ask-current-page" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:17px 18px;border:1px solid rgba(255,255,255,0.32);border-radius:20px;background:linear-gradient(180deg,#2789FF 0%,${C.tint} 100%);color:#fff;font-family:${FONT};font-size:16px;font-weight:700;cursor:pointer;letter-spacing:-0.01em;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 18px 28px rgba(22,119,255,0.24),0 6px 14px rgba(22,119,255,0.16);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Ask Current Page
        </button>
      </div>

      <!-- ─ Secondary Actions ─────────────────────── -->
      <div style="${CARD}margin-top:10px;">
        <button id="search-wiki" style="${ACTION_ROW}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${C.tint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Search Wiki
        </button>
        ${sep(18)}
        <button id="search-memory" style="${ACTION_ROW}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${C.tint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 017 7c0 3-2 5.5-4 7.5L12 22l-3-5.5C7 14.5 5 12 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          Search Memory
        </button>
      </div>
      <div id="lookup-status" style="padding:9px 36px 0;font-size:13px;color:${C.secondary};line-height:1.45;">Query results will open in the desktop Island.</div>

      <!-- ─ Security ──────────────────────────────── -->
      ${sectionHeader("Security")}
      <div style="${CARD}">
        <div style="padding:14px 18px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${IC.globe}
            <span style="flex:1;font-size:15px;font-weight:700;color:${C.label};">Allowed Domains</span>
            <span style="font-size:15px;color:${C.secondary};flex-shrink:0;">${escapeHtml(settings.allowedDomains.length === 0 ? "All" : `${settings.allowedDomains.length} listed`)}</span>
          </div>
          ${settings.allowedDomains.length > 0 ? `<div style="padding-left:43px;">${renderDomainPills(settings.allowedDomains)}</div>` : ""}
        </div>
        ${sep()}
        <div style="${ROW}">
          ${IC.shield}
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${C.label};">Low-Risk Auto Approval</div>
            <div style="font-size:13px;color:${C.secondary};margin-top:3px;">${settings.autoApproveLowRisk ? "Enabled" : "Disabled"}</div>
          </div>
          ${renderToggle(settings.autoApproveLowRisk)}
        </div>
      </div>

      <!-- ─ Settings ──────────────────────────────── -->
      <div style="${CARD}margin-top:22px;">
        <button id="open-options" style="display:flex;width:100%;${ROW}border:none;background:transparent;font-family:${FONT};cursor:pointer;">
          ${IC.gear}
          <span style="flex:1;font-size:15px;font-weight:700;color:${C.label};text-align:left;">Settings</span>
          ${chevron}
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
      `padding:9px 36px 0;font-size:13px;line-height:1.45;color:${color};`
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
