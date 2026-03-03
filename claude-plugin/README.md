# DesktopLens MCP — Claude Code Plugin

> Give Claude Code eyes beyond the browser.

## 安裝

### 從 Marketplace 安裝

```bash
/plugin marketplace add LostSunset/DesktopLens_MCP
/plugin install desktoplens-mcp@desktoplens-mcp
```

### 手動安裝

將此 plugin 目錄複製到 `~/.claude/plugins/` 下，或在 Claude Code MCP 設定中手動新增：

```json
{
  "mcpServers": {
    "desktoplens": {
      "command": "npx",
      "args": ["-y", "desktoplens-mcp"]
    }
  }
}
```

## 功能

安裝後自動獲得：

### MCP Server (10 個工具)
- **desktoplens_list_windows** — 列出所有可見桌面視窗
- **desktoplens_screenshot** — 截取指定視窗截圖
- **desktoplens_watch** — 即時串流視窗到 Chrome Viewer
- **desktoplens_stop** — 停止串流 session
- **desktoplens_status** — 查看伺服器狀態
- **desktoplens_compare** — 比較兩張截圖差異
- **desktoplens_plugin_search** — 搜尋 DesktopLens Plugin
- **desktoplens_plugin_install** — 安裝 Plugin
- **desktoplens_plugin_list** — 列出已安裝 Plugin
- **desktoplens_plugin_remove** — 移除 Plugin

### Slash Commands
- `/screenshot [window]` — 快速截取桌面視窗截圖
- `/windows [filter]` — 列出所有可見視窗
- `/watch [window]` — 開始即時串流

### Skills
- **desktop-vision** — 教導 Claude 如何使用所有 DesktopLens 工具的完整知識

### Agents
- **ui-analyzer** — UI 分析子代理，自動擷取、標注、比較、產生報告

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DESKTOPLENS_PORT` | `9876` | WebSocket 埠號 |
| `DESKTOPLENS_DEFAULT_FPS` | `2` | 預設串流幀率 |
| `DESKTOPLENS_DEFAULT_QUALITY` | `medium` | 預設畫質 (low/medium/high) |

## 系統需求

- Node.js >= 18
- 支援 Windows、macOS、Linux

## 授權

[MIT](https://github.com/LostSunset/DesktopLens_MCP/blob/main/LICENSE)
