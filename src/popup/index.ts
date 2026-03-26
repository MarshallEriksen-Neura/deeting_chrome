import { loadBridgeConnectionState, loadSettings } from "../background/store"
import { BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE } from "../background/bridge"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderStatusBadge(status: string): string {
  const palette =
    status === "connected"
      ? { background: "#dcfce7", color: "#166534" }
      : status === "connecting"
        ? { background: "#fef3c7", color: "#92400e" }
        : status === "error"
          ? { background: "#fee2e2", color: "#b91c1c" }
          : { background: "#e2e8f0", color: "#475569" }

  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:${palette.background};color:${palette.color};font-size:12px;font-weight:700;text-transform:capitalize;"><span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:currentColor;"></span>${escapeHtml(status)}</span>`
}

function formatUpdatedAt(value: string): string | null {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) {
    return null
  }

  return parsed.toLocaleString()
}

function renderAllowedDomains(domains: string[]): string {
  if (domains.length === 0) {
    return `<p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">All domains are currently allowed. Add an allowlist in Settings if you want tighter control.</p>`
  }

  const visibleDomains = domains.slice(0, 4)
  const remainingCount = domains.length - visibleDomains.length

  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${visibleDomains
        .map(
          (domain) => `
            <span style="display:inline-flex;align-items:center;max-width:100%;padding:6px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(domain)}
            </span>
          `
        )
        .join("")}
      ${
        remainingCount > 0
          ? `<span style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#e2e8f0;color:#475569;font-size:12px;font-weight:600;">+${remainingCount} more</span>`
          : ""
      }
    </div>
  `
}

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const popupWidth = 384
  document.documentElement.style.width = `${popupWidth}px`
  document.body.style.width = `${popupWidth}px`
  document.body.style.minWidth = `${popupWidth}px`
  document.body.style.margin = "0"
  document.body.style.background = "#dfe7f3"
  document.body.style.overflowX = "hidden"
  app.style.width = `${popupWidth}px`

  await chrome.runtime
    .sendMessage({
      type: BRIDGE_ENSURE_CONNECTED_MESSAGE_TYPE,
      source: "popup",
    })
    .catch(() => undefined)

  const [settings, bridgeState] = await Promise.all([
    loadSettings(),
    loadBridgeConnectionState(),
  ])
  const iconUrl = chrome.runtime.getURL("assets/icon.png")
  const domainSummary =
    settings.allowedDomains.length === 0
      ? "Open access"
      : `${settings.allowedDomains.length} listed`
  const updatedAt = formatUpdatedAt(bridgeState.updatedAt)

  app.innerHTML = `
    <main style="width:${popupWidth}px;box-sizing:border-box;padding:18px;display:grid;gap:14px;background:linear-gradient(180deg, #f8fafc 0%, #dfe7f3 100%);">
      <section style="display:grid;gap:14px;padding:16px;border-radius:22px;background:linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(238,242,255,0.98) 45%, rgba(219,234,254,0.98) 100%);box-shadow:0 20px 45px rgba(15,23,42,0.18);">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="display:grid;place-items:center;flex:0 0 auto;width:48px;height:48px;border-radius:16px;background:#0f172a;box-shadow:0 12px 24px rgba(15,23,42,0.18);">
            <img src="${iconUrl}" alt="Deeting" width="28" height="28" style="display:block;" />
          </div>
          <div style="flex:1;min-width:0;display:grid;gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <h1 style="margin:0;font-size:19px;line-height:1.2;color:#0f172a;">Deeting Browser Agent</h1>
              ${renderStatusBadge(bridgeState.status)}
            </div>
            <p style="margin:0;font-size:13px;line-height:1.55;color:#334155;">Desktop-guided browser actions over the localhost bridge, with a bounded execution surface.</p>
          </div>
        </div>

        <div style="display:grid;gap:8px;padding:14px;border-radius:16px;background:rgba(255,255,255,0.88);border:1px solid rgba(148,163,184,0.26);">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Bridge Endpoint</span>
          <div style="font-size:13px;font-weight:700;line-height:1.5;color:#0f172a;overflow-wrap:anywhere;">${escapeHtml(settings.bridgeUrl)}</div>
          <div style="font-size:12px;color:#475569;">
            ${
              updatedAt
                ? `Last update ${escapeHtml(updatedAt)}`
                : "Waiting for the desktop bridge to report a live session."
            }
          </div>
          ${
            bridgeState.lastError
              ? `<div style="padding:10px 12px;border-radius:12px;background:#fef2f2;color:#b91c1c;font-size:12px;line-height:1.5;overflow-wrap:anywhere;">${escapeHtml(bridgeState.lastError)}</div>`
              : ""
          }
        </div>
      </section>

      <section style="display:grid;gap:12px;padding:16px;border-radius:20px;background:#ffffff;box-shadow:0 14px 30px rgba(15,23,42,0.1);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <strong style="font-size:14px;color:#0f172a;">Allowed domains</strong>
          <span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:600;">${escapeHtml(domainSummary)}</span>
        </div>
        ${renderAllowedDomains(settings.allowedDomains)}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
          <div style="display:grid;gap:4px;">
            <span style="font-size:13px;font-weight:700;color:#0f172a;">Low-risk auto approval</span>
            <span style="font-size:12px;color:#64748b;">${settings.autoApproveLowRisk ? "Enabled for routine safe actions." : "Every action still requires review."}</span>
          </div>
          <span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:${settings.autoApproveLowRisk ? "#dcfce7" : "#fee2e2"};color:${settings.autoApproveLowRisk ? "#166534" : "#b91c1c"};font-size:12px;font-weight:700;">${settings.autoApproveLowRisk ? "On" : "Off"}</span>
        </div>
      </section>

      <button id="open-options" style="border:none;border-radius:16px;padding:13px 14px;background:linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);box-shadow:0 16px 30px rgba(29,78,216,0.24);color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;">
        Open Settings
      </button>
    </main>
  `

  document.getElementById("open-options")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage()
  })
}

void main()
