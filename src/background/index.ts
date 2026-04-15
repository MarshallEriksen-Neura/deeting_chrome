import {
  connectBridge,
  registerBridgeConnectionWakeHandler,
  registerBridgeLifecycleWakeHandlers,
} from "./bridge"
import { registerManualBrowserQueryHandler } from "./manual-query"
import { registerBridgePageContextSignals } from "./page-context"
import { handleCommand } from "./router"

const bridge = connectBridge()

registerBridgeConnectionWakeHandler(bridge)
registerBridgeLifecycleWakeHandlers(bridge)
registerBridgePageContextSignals(bridge)
registerManualBrowserQueryHandler(bridge)

bridge.onCommand(async (message) => {
  const result = await handleCommand(message)
  bridge.sendResult(result)
})

void bridge.ensureConnected()
