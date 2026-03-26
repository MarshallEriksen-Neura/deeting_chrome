import type { PageSnapshot } from "../shared/actions"

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
  }
}
