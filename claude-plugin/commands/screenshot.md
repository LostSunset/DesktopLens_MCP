---
description: "Capture a screenshot of a desktop window"
argument-hint: "[window name]"
allowed-tools: ["mcp__desktoplens__desktoplens_list_windows", "mcp__desktoplens__desktoplens_screenshot"]
---

Capture a screenshot of a desktop application window.

## Steps

1. First, call `desktoplens_list_windows` to find available windows. If the user specified a window name, use it as the `filter` parameter.
2. Present the matching windows to the user if multiple matches are found.
3. Call `desktoplens_screenshot` with the selected window's `window_id` or `window_title`.
   - Use `annotate: true` if the user wants UI region references.
   - Use `format: "jpeg"` for smaller file size, `format: "png"` for best quality.
4. Display the captured screenshot and provide a brief description of what's visible.

If the user provided arguments (e.g., `/screenshot Notepad`), use that as the window filter directly.

$ARGUMENTS
