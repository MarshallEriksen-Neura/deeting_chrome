import { loadSettings, saveSettings } from "../background/store"
import { BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE } from "../background/bridge"

/* ── iOS Design Tokens ────────────────────────────────── */

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
  purple: "#AF52DE",
  fill: "rgba(120,120,128,0.12)",
} as const

/* ── Icons ────────────────────────────────────────────── */

const _s = (d: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const _ic = (bg: string, svg: string) =>
  `<div style="width:29px;height:29px;border-radius:7px;background:${bg};display:grid;place-items:center;flex-shrink:0;">${svg}</div>`

const IC = {
  link: _ic(C.tint, _s(`<path d="M15 7h3a5 5 0 010 10h-3M9 17H6A5 5 0 016 7h3"/><line x1="8" y1="12" x2="16" y2="12"/>`)),
  globe: _ic(C.orange, _s(`<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>`)),
  shield: _ic(C.purple, _s(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`)),
}

/* ── Helpers ──────────────────────────────────────────── */

function domainsToText(domains: string[]): string {
  return domains.join("\n")
}

function textToDomains(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function sectionHeader(text: string): string {
  return `<div style="padding:28px 20px 7px;font-size:13px;font-weight:400;color:${C.secondary};text-transform:uppercase;letter-spacing:0.02em;">${text}</div>`
}

function sectionFooter(text: string): string {
  return `<div style="padding:7px 36px 0;font-size:13px;color:${C.secondary};line-height:1.4;">${text}</div>`
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const FONT = `-apple-system,system-ui,'Helvetica Neue',sans-serif`
  const CARD = `margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;`
  const INPUT = `display:block;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid ${C.separator};background:${C.bg};font-family:${FONT};font-size:15px;color:${C.label};outline:none;`

  await chrome.runtime
    .sendMessage({ type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE, source: "options" })
    .catch(() => undefined)

  const settings = await loadSettings()

  app.innerHTML = `
    <main style="max-width:680px;margin:0 auto;padding:0 0 48px;font-family:${FONT};-webkit-font-smoothing:antialiased;">

      <!-- ─ Large Title ───────────────────────────── -->
      <header style="padding:28px 20px 4px;">
        <h1 style="margin:0;font-size:34px;font-weight:700;color:${C.label};letter-spacing:-0.03em;">Settings</h1>
        <p style="margin:6px 0 0;font-size:15px;color:${C.secondary};line-height:1.45;">Configure the localhost bridge and domain access for the browser agent.</p>
      </header>

      <form id="settings-form">

        <!-- ─ Bridge ────────────────────────────────── -->
        ${sectionHeader("Bridge")}
        <div style="${CARD}">
          <div style="padding:12px 16px;display:flex;align-items:flex-start;gap:12px;">
            ${IC.link}
            <div style="flex:1;min-width:0;">
              <label style="display:block;font-size:13px;font-weight:500;color:${C.secondary};margin-bottom:7px;">Bridge URL</label>
              <input id="bridge-url" name="bridgeUrl" type="url" value="${settings.bridgeUrl}" style="${INPUT}" />
            </div>
          </div>
        </div>

        <!-- ─ Domain Allowlist ──────────────────────── -->
        ${sectionHeader("Domain Allowlist")}
        <div style="${CARD}">
          <div style="padding:12px 16px;display:flex;align-items:flex-start;gap:12px;">
            ${IC.globe}
            <div style="flex:1;min-width:0;">
              <textarea id="allowed-domains" name="allowedDomains" rows="8" placeholder="example.com" style="${INPUT}resize:vertical;line-height:1.5;">${domainsToText(settings.allowedDomains)}</textarea>
            </div>
          </div>
        </div>
        ${sectionFooter("Leave empty to allow all domains. Enter one hostname per line.")}

        <!-- ─ Automation ────────────────────────────── -->
        ${sectionHeader("Automation")}
        <div style="${CARD}">
          <div style="padding:12px 16px;display:flex;align-items:center;gap:12px;">
            ${IC.shield}
            <span style="flex:1;font-size:15px;color:${C.label};">Auto-approve low-risk actions</span>
            <div id="toggle-track" style="position:relative;width:51px;height:31px;border-radius:15.5px;background:${settings.autoApproveLowRisk ? C.green : "rgba(120,120,128,0.16)"};cursor:pointer;flex-shrink:0;transition:background 0.25s ease;">
              <div id="toggle-thumb" style="position:absolute;top:2px;${settings.autoApproveLowRisk ? "left:22px" : "left:2px"};width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.15),0 0 1px rgba(0,0,0,0.1);transition:left 0.25s ease;"></div>
            </div>
            <input id="auto-approve-low-risk" name="autoApproveLowRisk" type="checkbox" ${settings.autoApproveLowRisk ? "checked" : ""} style="display:none;" />
          </div>
        </div>

        <!-- ─ Save ──────────────────────────────────── -->
        <div style="margin:36px 16px 0;display:flex;align-items:center;gap:16px;">
          <button type="submit" style="flex:1;border:none;border-radius:12px;padding:14px;background:${C.tint};color:#fff;font-family:${FONT};font-size:17px;font-weight:600;cursor:pointer;letter-spacing:-0.01em;">Save</button>
          <span id="save-status" style="font-size:13px;color:${C.secondary};flex-shrink:0;"></span>
        </div>
      </form>
    </main>
  `

  /* ── Toggle Switch ────────────────────────────────────── */

  const toggleTrack = document.getElementById("toggle-track")
  const toggleThumb = document.getElementById("toggle-thumb")
  const toggleCheckbox = document.getElementById("auto-approve-low-risk") as HTMLInputElement | null

  toggleTrack?.addEventListener("click", () => {
    if (!toggleCheckbox || !toggleThumb || !toggleTrack) return
    const next = !toggleCheckbox.checked
    toggleCheckbox.checked = next
    toggleTrack.style.background = next ? C.green : "rgba(120,120,128,0.16)"
    toggleThumb.style.left = next ? "22px" : "2px"
  })

  /* ── Form Submission ──────────────────────────────────── */

  const form = document.getElementById("settings-form") as HTMLFormElement | null
  form?.addEventListener("submit", async (event) => {
    event.preventDefault()

    const bridgeUrl = (document.getElementById("bridge-url") as HTMLInputElement).value
    const allowedDomains = textToDomains(
      (document.getElementById("allowed-domains") as HTMLTextAreaElement).value
    )
    const autoApproveLowRisk = (document.getElementById("auto-approve-low-risk") as HTMLInputElement).checked

    await saveSettings({ bridgeUrl, allowedDomains, autoApproveLowRisk })

    const status = document.getElementById("save-status")
    if (status) {
      status.textContent = `Saved at ${new Date().toLocaleTimeString()}`
    }
  })
}

void main()
