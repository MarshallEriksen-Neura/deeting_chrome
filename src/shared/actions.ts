export type RiskLevel = "low" | "medium" | "high"

export interface ElementLocator {
  selector?: string
  text?: string
  role?: string
  tagName?: string
  placeholder?: string
  index?: number
}

export interface PageSnapshot {
  url: string
  title: string
  documentReadyState: DocumentReadyState
  visibleText: string
  mainText: string
  headings: Array<{ level: number; text: string }>
  links: Array<{ text: string; href: string }>
  buttons: Array<{ text: string; disabled: boolean }>
  inputs: Array<{ type?: string; name?: string; placeholder?: string }>
  forms: Array<{ action?: string; method?: string }>
}

export type BrowserAction =
  | { kind: "open_tab"; url: string }
  | { kind: "navigate_tab"; tabId: number; url: string }
  | { kind: "get_page_snapshot"; tabId: number }
  | { kind: "query_dom"; tabId: number; selector?: string; textQuery?: string }
  | {
      kind: "wait_for_element"
      tabId: number
      target: ElementLocator
      timeoutMs: number
      pollIntervalMs: number
    }
  | {
      kind: "wait_for_navigation"
      tabId: number
      timeoutMs: number
      expectedUrlContains?: string
      expectedTitleContains?: string
      waitForReadyState?: "loading" | "interactive" | "complete"
    }
  | {
      kind: "scroll_into_view"
      tabId: number
      target: ElementLocator
      align?: "start" | "center" | "end" | "nearest"
    }
  | { kind: "click"; tabId: number; target: ElementLocator }
  | { kind: "type"; tabId: number; target: ElementLocator; text: string }
  | { kind: "scroll"; tabId: number; direction: "up" | "down"; amount?: number }
