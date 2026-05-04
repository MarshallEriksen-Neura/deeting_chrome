export type RiskLevel = "low" | "medium" | "high"

export interface ElementLocator {
  selector?: string
  text?: string
  role?: string
  tagName?: string
  placeholder?: string
  elementId?: string
  ariaLabel?: string
  accessibleName?: string
  href?: string
  testId?: string
  frameId?: string
  index?: number
}

export interface ElementBounds {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface ElementSnapshot {
  elementId: string
  tagName: string
  text: string
  role?: string
  ariaLabel?: string
  accessibleName?: string
  selector?: string
  href?: string
  testId?: string
  placeholder?: string
  visible: boolean
  disabled: boolean
  bounds: ElementBounds
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
  elements: ElementSnapshot[]
}

export type BrowserAction =
  | { kind: "open_tab"; url: string }
  | { kind: "navigate_tab"; tabId: number; url: string }
  | { kind: "get_page_snapshot"; tabId: number }
  | { kind: "find_element"; tabId: number; target: ElementLocator }
  | { kind: "extract"; tabId: number; mode?: string; target?: ElementLocator; options?: Record<string, unknown> }
  | { kind: "region_screenshot"; tabId: number; target?: ElementLocator; region?: Partial<ElementBounds> }
  | { kind: "full_page_screenshot"; tabId: number }
  | { kind: "get_active_page" }
  | {
      kind: "wait"
      tabId?: number
      mode?: string
      target?: ElementLocator
      text?: string
      url?: string
      title?: string
      waitForReadyState?: "loading" | "interactive" | "complete"
      timeoutMs?: number
      pollIntervalMs?: number
    }
  | { kind: "tabs"; action: "list" | "switch" | "create" | "close"; tabId?: number; url?: string }
  | { kind: "fill"; tabId: number; target: ElementLocator; text: string; submitAfter?: boolean }
  | { kind: "key"; tabId: number; target?: ElementLocator; key: string }
  | { kind: "select"; tabId: number; target: ElementLocator; value?: unknown; checked?: boolean }
  | { kind: "upload_file"; tabId: number; target: ElementLocator; path?: string; paths?: string[] }
  | { kind: "downloads"; action?: "list" | "wait"; limit?: number; filenameContains?: string; timeoutMs?: number }
  | { kind: "dialog"; tabId?: number; action?: "status" | "accept" | "dismiss" | "respond"; text?: string }
  | { kind: "console_log"; tabId: number; level?: "log" | "warn" | "error"; limit?: number }
  | { kind: "network_log"; tabId: number; includeFailed?: boolean; limit?: number }
  | { kind: "storage_read"; tabId: number; area: "localStorage" | "sessionStorage"; key?: string }
  | { kind: "storage_write"; tabId: number; area: "localStorage" | "sessionStorage"; key: string; value: unknown }
  | { kind: "eval"; tabId: number; mode?: "read" | "write"; code: string }
  | { kind: "highlight"; tabId: number; target: ElementLocator; durationMs?: number }
  | { kind: "accessibility_audit"; tabId: number }
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

export const SUPPORTED_BROWSER_ACTIONS: BrowserAction["kind"][] = [
  "open_tab",
  "navigate_tab",
  "get_page_snapshot",
  "find_element",
  "extract",
  "region_screenshot",
  "full_page_screenshot",
  "get_active_page",
  "wait",
  "tabs",
  "fill",
  "key",
  "select",
  "upload_file",
  "downloads",
  "dialog",
  "console_log",
  "network_log",
  "storage_read",
  "storage_write",
  "eval",
  "highlight",
  "accessibility_audit",
  "query_dom",
  "wait_for_element",
  "wait_for_navigation",
  "scroll_into_view",
  "click",
  "type",
  "scroll",
]
