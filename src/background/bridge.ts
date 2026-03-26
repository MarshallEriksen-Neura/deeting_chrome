import type { CommandMessage, HelloMessage, ResultMessage } from "../shared/protocol"
import { loadSettings, saveBridgeConnectionState } from "./store"

type CommandListener = (message: CommandMessage) => Promise<void> | void

export function connectBridge() {
  let socket: WebSocket | null = null
  const listeners = new Set<CommandListener>()

  const connect = async () => {
    const settings = await loadSettings()
    await saveBridgeConnectionState({ status: "connecting" })
    socket = new WebSocket(settings.bridgeUrl)

    socket.onopen = () => {
      const hello: HelloMessage = {
        type: "hello",
        role: "extension",
        sessionId: crypto.randomUUID(),
        extensionVersion: chrome.runtime.getManifest().version,
      }
      void saveBridgeConnectionState({ status: "connected" })
      socket?.send(JSON.stringify(hello))
    }

    socket.onmessage = async (event) => {
      const payload = JSON.parse(String(event.data)) as CommandMessage
      if (payload.type !== "command") return
      for (const listener of listeners) {
        await listener(payload)
      }
    }

    socket.onclose = () => {
      void saveBridgeConnectionState({ status: "idle" })
      setTimeout(() => void connect(), 1500)
    }

    socket.onerror = () => {
      void saveBridgeConnectionState({
        status: "error",
        lastError: `Failed to reach ${settings.bridgeUrl}`,
      })
    }
  }

  void connect()

  return {
    onCommand(listener: CommandListener) {
      listeners.add(listener)
    },
    sendResult(message: ResultMessage) {
      socket?.send(JSON.stringify(message))
    },
  }
}
