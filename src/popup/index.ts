import { loadBridgeConnectionState, loadSettings } from "../background/store"

function renderStatusBadge(status: string): string {
  const color =
    status === "connected"
      ? "#15803d"
      : status === "connecting"
        ? "#b45309"
        : status === "error"
          ? "#b91c1c"
          : "#475569"
  return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${color};color:white;font-size:12px;">${status}</span>`
}

async function main() {
  const app = document.getElementById("app")
  if (!app) return

  const [settings, bridgeState] = await Promise.all([
    loadSettings(),
    loadBridgeConnectionState(),
  ])

  const domains =
    settings.allowedDomains.length === 0
      ? "All domains currently allowed"
      : settings.allowedDomains.join(", ")

  app.innerHTML = `
    <main style="padding:16px;display:grid;gap:12px;">
      <section style="display:grid;gap:6px;">
        <h1 style="margin:0;font-size:16px;">Deeting Browser Agent</h1>
        ${renderStatusBadge(bridgeState.status)}
        <p style="margin:0;font-size:12px;color:#475569;">Bridge: ${settings.bridgeUrl}</p>
        ${bridgeState.lastError ? `<p style="margin:0;font-size:12px;color:#b91c1c;">${bridgeState.lastError}</p>` : ""}
      </section>
      <section style="display:grid;gap:6px;padding:12px;border-radius:12px;background:white;">
        <strong style="font-size:13px;">Allowed domains</strong>
        <p style="margin:0;font-size:12px;color:#334155;">${domains}</p>
      </section>
      <button id="open-options" style="border:none;border-radius:10px;padding:10px 12px;background:#111827;color:white;cursor:pointer;">
        Open Settings
      </button>
    </main>
  `

  document.getElementById("open-options")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage()
  })
}

void main()
