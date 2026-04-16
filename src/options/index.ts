import { loadSettings, saveSettings } from "../background/store"
import { BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE } from "../background/bridge"

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
  fill: "rgba(120,120,128,0.12)",
} as const

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
  return `<div style="padding:24px 20px 7px;font-size:13px;font-weight:400;color:${C.secondary};text-transform:uppercase;letter-spacing:-0.01em;">${text}</div>`
}

function sectionFooter(text: string): string {
  return `<div style="padding:7px 36px 0;font-size:13px;color:${C.secondary};line-height:1.4;">${text}</div>`
}

/* ── Main ─────────────────────────────────────────────── */

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  await chrome.runtime
    .sendMessage({ type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE, source: "options" })
    .catch(() => undefined)

  const settings = await loadSettings()

  const inputStyle = `display:block;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid ${C.separator};background:${C.bg};font-family:inherit;font-size:15px;color:${C.label};outline:none;`

  app.innerHTML = `
    <main style="max-width:680px;margin:0 auto;padding:0 0 40px;font-family:-apple-system,system-ui,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;">

      <!-- Large Title -->
      <header style="padding:24px 20px 0;">
        <h1 style="margin:0;font-size:34px;font-weight:700;color:${C.label};letter-spacing:-0.02em;">Settings</h1>
        <p style="margin:6px 0 0;font-size:15px;color:${C.secondary};line-height:1.4;">Configure the localhost bridge and domain access for the browser agent.</p>
      </header>

      <form id="settings-form">

        <!-- Bridge URL -->
        ${sectionHeader("Bridge")}
        <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
          <div style="padding:11px 16px;">
            <label style="display:block;font-size:13px;font-weight:500;color:${C.secondary};margin-bottom:6px;">Bridge URL</label>
            <input id="bridge-url" name="bridgeUrl" type="url" value="${settings.bridgeUrl}" style="${inputStyle}" />
          </div>
        </div>

        <!-- Domain Allowlist -->
        ${sectionHeader("Domain Allowlist")}
        <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
          <div style="padding:11px 16px;">
            <textarea id="allowed-domains" name="allowedDomains" rows="8" style="${inputStyle}resize:vertical;line-height:1.5;">${domainsToText(settings.allowedDomains)}</textarea>
          </div>
        </div>
        ${sectionFooter("Leave empty to allow all domains. Enter one hostname per line.")}

        <!-- Automation -->
        ${sectionHeader("Automation")}
        <div style="margin:0 16px;border-radius:12px;background:${C.card};overflow:hidden;">
          <div style="padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span style="font-size:15px;color:${C.label};">Auto-approve low-risk actions</span>
            <div id="toggle-track" style="position:relative;width:51px;height:31px;border-radius:15.5px;background:${settings.autoApproveLowRisk ? C.green : "rgba(120,120,128,0.16)"};cursor:pointer;flex-shrink:0;transition:background 0.25s ease;">
              <div id="toggle-thumb" style="position:absolute;top:2px;${settings.autoApproveLowRisk ? "left:22px" : "left:2px"};width:27px;height:27px;border-radius:50%;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.15),0 1px 1px rgba(0,0,0,0.06);transition:left 0.25s ease;"></div>
            </div>
            <input id="auto-approve-low-risk" name="autoApproveLowRisk" type="checkbox" ${settings.autoApproveLowRisk ? "checked" : ""} style="display:none;" />
          </div>
        </div>

        <!-- Save -->
        <div style="margin:32px 16px 0;display:flex;align-items:center;gap:16px;">
          <button type="submit" style="flex:1;border:none;border-radius:12px;padding:14px;background:${C.tint};color:white;font-family:inherit;font-size:17px;font-weight:600;cursor:pointer;letter-spacing:-0.01em;">Save</button>
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
