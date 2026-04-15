import type { BrowserAction } from "./actions"

export type BrowserBridgeEventName =
  | "tab_updated"
  | "tab_closed"
  | "permission_required"
  | "user_blocked"

export interface BrowserTabEventData {
  tabId: number
  title?: string
  url?: string
  host?: string
}

export interface BrowserLookupPageContext {
  tabId: number
  title: string
  url: string
  host: string
  headingsSummary: string[]
  mainTextSnippet: string
  visibleTextSnippet: string
}

export interface HelloMessage {
  type: "hello"
  role: "desktop" | "extension"
  sessionId: string
  extensionVersion?: string
}

export interface CommandMessage {
  type: "command"
  requestId: string
  action: BrowserAction
}

export interface ResultMessage {
  type: "result"
  requestId: string
  ok: boolean
  data?: unknown
  error?: {
    code: string
    message: string
  }
}

export interface EventMessage {
  type: "event"
  event: BrowserBridgeEventName
  data?: unknown
}

export type BrowserQueryMethod =
  | "search_wiki"
  | "search_memory"
  | "ask_current_page"

export interface QueryMessage {
  type: "query"
  queryId: string
  method: BrowserQueryMethod
  params: {
    pageContext: BrowserLookupPageContext
  }
}

export interface QueryResultMessage {
  type: "query_result"
  queryId: string
  ok: boolean
  data?: unknown
  error?: {
    code: string
    message: string
  }
}

export type BridgeMessage =
  | HelloMessage
  | CommandMessage
  | ResultMessage
  | EventMessage
  | QueryMessage
  | QueryResultMessage
