import { loadSettings, saveSettings } from "../background/store"

function domainsToText(domains: string[]): string {
  return domains.join("\n")
}

function textToDomains(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const settings = await loadSettings()

  app.innerHTML = `
    <main style="max-width:720px;margin:0 auto;padding:24px;display:grid;gap:16px;">
      <section style="display:grid;gap:6px;">
        <h1 style="margin:0;font-size:24px;">Browser Agent Settings</h1>
        <p style="margin:0;color:#475569;">Configure the localhost bridge and optional domain allowlist for the browser executor.</p>
      </section>
      <form id="settings-form" style="display:grid;gap:16px;background:white;padding:20px;border-radius:16px;">
        <label style="display:grid;gap:6px;">
          <span style="font-weight:600;">Bridge URL</span>
          <input id="bridge-url" name="bridgeUrl" type="url" value="${settings.bridgeUrl}" style="padding:10px 12px;border-radius:10px;border:1px solid #cbd5e1;" />
        </label>
        <label style="display:grid;gap:6px;">
          <span style="font-weight:600;">Allowed Domains</span>
          <textarea id="allowed-domains" name="allowedDomains" rows="8" style="padding:10px 12px;border-radius:10px;border:1px solid #cbd5e1;">${domainsToText(settings.allowedDomains)}</textarea>
          <span style="font-size:12px;color:#64748b;">Leave empty to allow all domains. Use one hostname per line.</span>
        </label>
        <label style="display:flex;gap:8px;align-items:center;">
          <input id="auto-approve-low-risk" name="autoApproveLowRisk" type="checkbox" ${settings.autoApproveLowRisk ? "checked" : ""} />
          <span>Automatically approve low-risk actions</span>
        </label>
        <div style="display:flex;gap:12px;align-items:center;">
          <button type="submit" style="border:none;border-radius:10px;padding:10px 14px;background:#111827;color:white;cursor:pointer;">Save Settings</button>
          <span id="save-status" style="font-size:12px;color:#475569;"></span>
        </div>
      </form>
    </main>
  `

  const form = document.getElementById("settings-form") as HTMLFormElement | null
  form?.addEventListener("submit", async (event) => {
    event.preventDefault()

    const bridgeUrl = (document.getElementById("bridge-url") as HTMLInputElement).value
    const allowedDomains = textToDomains(
      (document.getElementById("allowed-domains") as HTMLTextAreaElement).value
    )
    const autoApproveLowRisk = (document.getElementById("auto-approve-low-risk") as HTMLInputElement).checked

    await saveSettings({
      bridgeUrl,
      allowedDomains,
      autoApproveLowRisk,
    })

    const status = document.getElementById("save-status")
    if (status) {
      status.textContent = `Saved at ${new Date().toLocaleTimeString()}`
    }
  })
}

void main()
