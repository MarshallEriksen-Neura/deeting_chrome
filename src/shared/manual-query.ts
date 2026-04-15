import type { BrowserQueryMethod } from "./protocol"

export const BROWSER_MANUAL_QUERY_MESSAGE_TYPE = "browser.manualQuery"

export interface BrowserManualQueryRequest {
  type: typeof BROWSER_MANUAL_QUERY_MESSAGE_TYPE
  method: BrowserQueryMethod
}

export interface BrowserManualQueryResponse {
  ok: boolean
  data?: {
    lookupId?: string
    resultCount?: number
    kind?: string
  }
  error?: string
}

