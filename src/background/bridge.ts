import type { CommandMessage, HelloMessage, ResultMessage } from "../shared/protocol"

const BRIDGE_URL = "ws://127.0.0.1:31937/bridge"

type CommandListener = (message: CommandMessage) => Promise<void> | void

export function connectBridge() {
  let socket: WebSocket | null = null
  const listeners = new Set<CommandListener>()

  const connect = () => {
    socket = new WebSocket(BRIDGE_URL)

    socket.onopen = () => {
      const hello: HelloMessage = {
        type: "hello",
        role: "extension",
        sessionId: crypto.randomUUID(),
        extensionVersion: chrome.runtime.getManifest().version,
      }
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
      setTimeout(connect, 1500)
    }
  }

  connect()

  return {
    onCommand(listener: CommandListener) {
      listeners.add(listener)
    },
    sendResult(message: ResultMessage) {
      socket?.send(JSON.stringify(message))
    },
  }
}
