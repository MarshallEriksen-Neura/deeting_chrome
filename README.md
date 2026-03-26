# Deeting Chrome

Chrome extension execution surface for the desktop-local Deeting browser agent.

## Scope

This repository intentionally implements the browser-side executor only.

- Desktop AI is the decision surface.
- The extension is the bounded browser execution surface.
- Users configure browsing policy, not MCP or skills.

## Initial Structure

- `src/background/` for localhost bridge, policy, and routing
- `src/content/` for page extraction and DOM actions
- `src/shared/` for action and bridge protocol types
- `src/popup/` and `src/options/` for future user-facing controls

## MVP

The first milestone is:

1. Connect to desktop over localhost WebSocket
2. Open a tab
3. Read a structured page snapshot
4. Execute bounded click/type/scroll actions
5. Block high-risk actions pending approval
