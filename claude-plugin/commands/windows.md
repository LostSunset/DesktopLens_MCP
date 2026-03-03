---
description: "List all visible desktop windows"
argument-hint: "[filter]"
allowed-tools: ["mcp__desktoplens__desktoplens_list_windows"]
---

List all visible desktop windows and display them in a formatted table.

## Steps

1. Call `desktoplens_list_windows`. If the user provided arguments, use them as the `filter` parameter for fuzzy matching.
2. Present the results in a markdown table with columns: Window ID, Title, App Name, Size.
3. If no windows are found, suggest the user check if the target application is open and visible.

$ARGUMENTS
