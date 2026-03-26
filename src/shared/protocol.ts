import type { BrowserAction } from "./actions"

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
  event: "tab_updated" | "tab_closed" | "permission_required" | "user_blocked"
  data?: unknown
}

export type BridgeMessage =
  | HelloMessage
  | CommandMessage
  | ResultMessage
  | EventMessage
