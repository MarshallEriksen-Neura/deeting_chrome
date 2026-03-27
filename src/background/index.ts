import {
  connectBridge,
  registerBridgeConnectionWakeHandler,
  registerBridgeLifecycleWakeHandlers,
} from "./bridge"
import { handleCommand } from "./router"

const bridge = connectBridge()

registerBridgeConnectionWakeHandler(bridge)
registerBridgeLifecycleWakeHandlers(bridge)

bridge.onCommand(async (message) => {
  const result = await handleCommand(message)
  bridge.sendResult(result)
})

void bridge.ensureConnected()
