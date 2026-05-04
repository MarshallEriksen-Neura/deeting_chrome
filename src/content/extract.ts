import type { PageSnapshot } from "../shared/actions"
import { describeElement, resolveElement } from "./locate"

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? ""
}

export function getPageSnapshot(): PageSnapshot {
  const mainRoot =
    document.querySelector("main") ??
    document.querySelector("article") ??
    document.body

  return {
    url: window.location.href,
    title: document.title,
    documentReadyState: document.readyState,
    visibleText: document.body.innerText.slice(0, 12000),
    mainText: textOf(mainRoot).slice(0, 12000),
    headings: [...document.querySelectorAll("h1,h2,h3")]
      .slice(0, 50)
      .map((node) => ({
        level: Number(node.tagName[1]),
        text: textOf(node),
      })),
    links: [...document.querySelectorAll("a[href]")]
      .slice(0, 200)
      .map((node) => ({
        text: textOf(node),
        href: (node as HTMLAnchorElement).href,
      })),
    buttons: [...document.querySelectorAll("button,input[type='button'],input[type='submit']")]
      .slice(0, 200)
      .map((node) => ({
        text: node instanceof HTMLInputElement ? node.value : textOf(node),
        disabled: node instanceof HTMLButtonElement || node instanceof HTMLInputElement ? node.disabled : false,
      })),
    inputs: [...document.querySelectorAll("input,textarea,select")]
      .slice(0, 100)
      .map((node) => ({
        type: node instanceof HTMLInputElement ? node.type : undefined,
        name: (node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name || undefined,
        placeholder:
          "placeholder" in node && typeof node.placeholder === "string" ? node.placeholder : undefined,
      })),
    forms: [...document.querySelectorAll("form")]
      .slice(0, 20)
      .map((node) => ({
        action: (node as HTMLFormElement).action || undefined,
        method: (node as HTMLFormElement).method || undefined,
      })),
    elements: [
      ...document.querySelectorAll(
        "a[href],button,input,textarea,select,[role],[aria-label],[data-testid],[data-test],h1,h2,h3"
      ),
    ]
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .slice(0, 300)
      .map(describeElement),
  }
}

export function extractPageContent(action: {
  mode?: string
  target?: Parameters<typeof resolveElement>[0]
  options?: Record<string, unknown>
}) {
  const target = action.target ? resolveElement(action.target) : null
  const root = target ?? document.querySelector("main") ?? document.querySelector("article") ?? document.body
  const mode = action.mode ?? "summary"

  if (mode === "links") {
    return {
      ok: true,
      mode,
      links: [...root.querySelectorAll("a[href]")].slice(0, 300).map((node) => ({
        text: textOf(node),
        href: (node as HTMLAnchorElement).href,
      })),
    }
  }

  if (mode === "tables") {
    return {
      ok: true,
      mode,
      tables: [...root.querySelectorAll("table")].slice(0, 20).map((table) => ({
        text: textOf(table).slice(0, 5000),
        rows: [...table.querySelectorAll("tr")].slice(0, 100).map((row) =>
          [...row.querySelectorAll("th,td")].slice(0, 30).map((cell) => textOf(cell))
        ),
      })),
    }
  }

  if (mode === "metadata") {
    return {
      ok: true,
      mode,
      title: document.title,
      url: window.location.href,
      description:
        document.querySelector("meta[name='description']")?.getAttribute("content") ??
        undefined,
      jsonLd: [...document.querySelectorAll("script[type='application/ld+json']")]
        .slice(0, 20)
        .map((node) => node.textContent?.trim() ?? "")
        .filter(Boolean),
    }
  }

  return {
    ok: true,
    mode,
    url: window.location.href,
    title: document.title,
    text: textOf(root).slice(0, 20000),
    target: target ? describeElement(target) : undefined,
  }
}
