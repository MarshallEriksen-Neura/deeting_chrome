import { connectBridge } from "./bridge"
import { handleCommand } from "./router"

const bridge = connectBridge()

bridge.onCommand(async (message) => {
  const result = await handleCommand(message)
  bridge.sendResult(result)
})
