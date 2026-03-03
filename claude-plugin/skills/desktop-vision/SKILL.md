---
name: "desktop-vision"
description: "Desktop vision capabilities — capture screenshots, stream desktop apps in real-time, and analyze UI changes using DesktopLens MCP tools"
---

# Desktop Vision Skill

You have access to DesktopLens MCP tools that let you see and analyze desktop applications outside the browser. Use these tools to capture screenshots, stream windows in real-time, compare UI changes, and manage plugins.

## Available Tools

### Core Tools

#### `desktoplens_list_windows`
List all visible desktop windows. Use this first to find the target window.
- `filter` (optional): Fuzzy search by window title or app name

#### `desktoplens_screenshot`
Capture a screenshot of a specific window.
- `window_id` or `window_title`: Target window identifier
- `format` (optional): `png` | `jpeg` | `webp` (default: `png`)
- `max_width` / `max_height` (optional): Resize constraints
- `annotate` (optional): Add grid overlay for region reference

#### `desktoplens_watch`
Start real-time streaming of a window to a Chrome viewer.
- `window_id` or `window_title`: Target window identifier
- `fps` (optional): Frame rate 0.5–5 (default: 2)
- `quality` (optional): `low` | `medium` | `high` (default: `medium`)
- `open_browser` (optional): Auto-open Chrome viewer (default: `true`)

#### `desktoplens_stop`
Stop streaming session(s).
- `session_id` (optional): Specific session to stop. Omit to stop all.

#### `desktoplens_status`
Get server status, platform info, and active streaming sessions.

#### `desktoplens_compare`
Compare two screenshots to detect UI changes.
- `before_snapshot_id` or `before_window_id`/`before_window_title`: Before state
- `after_window_id` or `after_window_title`: After state
- `highlight_diff` (optional): Generate visual diff image
- `threshold` (optional): Pixel difference sensitivity

### Plugin Tools

#### `desktoplens_plugin_search`
Search GitHub for DesktopLens plugins.
- `query`: Search keywords

#### `desktoplens_plugin_install`
Install a plugin from a local directory path.
- `source`: Path to plugin directory

#### `desktoplens_plugin_list`
List all installed plugins with their status and tools.

#### `desktoplens_plugin_remove`
Remove an installed plugin.
- `plugin_name`: Name of the plugin to remove

## Workflow Patterns

### Quick Screenshot
1. Call `desktoplens_list_windows` to find the target window
2. Call `desktoplens_screenshot` with the window ID or title
3. Analyze the returned screenshot image

### Before/After Comparison
1. Call `desktoplens_screenshot` to capture the "before" state (note the `snapshot_id`)
2. Ask the user to make their changes
3. Call `desktoplens_compare` with the before snapshot ID and current window

### Real-time Monitoring
1. Call `desktoplens_watch` to start streaming
2. The Chrome viewer opens automatically showing the live feed
3. Call `desktoplens_status` to check active sessions
4. Call `desktoplens_stop` when monitoring is complete

## Best Practices

- Always call `desktoplens_list_windows` first to verify the target window exists and get its exact ID
- Use `window_title` for convenience (supports fuzzy matching) or `window_id` for precision
- For UI analysis, use `annotate: true` to add a grid overlay that helps reference specific regions
- Set appropriate quality levels: `low` for quick checks, `high` for detailed analysis
- Stop streaming sessions when no longer needed to free resources
- Screenshots are automatically compressed for Claude Vision token efficiency
