import { connectBridge, registerBridgeConnectionWakeHandler } from "./bridge"
import { handleCommand } from "./router"

const bridge = connectBridge()

registerBridgeConnectionWakeHandler(bridge)

bridge.onCommand(async (message) => {
  const result = await handleCommand(message)
  bridge.sendResult(result)
})

void bridge.ensureConnected()
