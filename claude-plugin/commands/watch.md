---
description: "Start real-time streaming of a desktop window"
argument-hint: "[window name | stop | status]"
allowed-tools: ["mcp__desktoplens__desktoplens_list_windows", "mcp__desktoplens__desktoplens_watch", "mcp__desktoplens__desktoplens_status", "mcp__desktoplens__desktoplens_stop"]
---

Start real-time streaming of a desktop window to the Chrome viewer.

## Steps

1. Call `desktoplens_list_windows` to find the target window. If the user provided arguments, use them as the `filter` parameter.
2. If multiple windows match, ask the user to select one.
3. Call `desktoplens_watch` with the selected window:
   - `open_browser: true` to auto-open the Chrome viewer
   - Use default quality (`medium`) and FPS (`2`) unless the user specifies otherwise
4. Report the session ID, stream URL, and viewer URL.
5. Remind the user they can use `/watch stop` or ask to stop streaming when done.

If the user says "stop" or "status" as arguments, call `desktoplens_stop` or `desktoplens_status` instead.

$ARGUMENTS
