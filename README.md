# DesktopLens MCP

[![CI](https://github.com/LostSunset/DesktopLens_MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/LostSunset/DesktopLens_MCP/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/desktoplens-mcp)](https://www.npmjs.com/package/desktoplens-mcp)
[![GitHub stars](https://img.shields.io/github/stars/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/network/members)
[![GitHub issues](https://img.shields.io/github/issues/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/issues)

> Give Claude Code eyes beyond the browser.

**DesktopLens MCP** 是一個 Model Context Protocol (MCP) Server，讓 Claude Code 能即時捕獲桌面應用程式的 UI 畫面、進行即時串流、UI 比較分析，並支援 Plugin 擴充生態系統。

## 功能一覽

### 核心工具 (6 個)

| 工具 | 說明 |
|------|------|
| `desktoplens_list_windows` | 列出所有可見桌面視窗，支援模糊搜尋 |
| `desktoplens_screenshot` | 截取指定視窗截圖，自動儲存快照，支援品質調整與 grid overlay 標注 |
| `desktoplens_status` | 回傳伺服器狀態、平台資訊、串流 session 資訊 |
| `desktoplens_watch` | 開始即時串流指定視窗，透過 WebSocket 傳輸至 Chrome Viewer |
| `desktoplens_stop` | 停止串流 session (指定或全部) |
| `desktoplens_compare` | 比較兩張截圖差異 — 像素比對、變化區域偵測、diff image 生成 |

### Plugin 工具 (4 個)

| 工具 | 說明 |
|------|------|
| `desktoplens_plugin_search` | 在 GitHub marketplace 搜尋 DesktopLens Plugin |
| `desktoplens_plugin_install` | 從本地路徑安裝 Plugin |
| `desktoplens_plugin_list` | 列出所有已安裝的 Plugin |
| `desktoplens_plugin_remove` | 移除已安裝的 Plugin |

## 快速開始

### Claude Code Plugin 安裝（推薦）

透過 Claude Code Plugin Marketplace 一鍵安裝，自動啟動 MCP Server 並載入所有 skills、commands、agents：

```bash
/plugin marketplace add LostSunset/DesktopLens_MCP
/plugin install desktoplens-mcp@desktoplens-mcp
```

安裝後可直接使用：
- `/screenshot [window]` — 快速截取桌面視窗截圖
- `/windows [filter]` — 列出所有可見視窗
- `/watch [window]` — 開始即時串流

### 手動 MCP 設定

或者，將以下設定手動加入你的 MCP 設定：

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

### 使用範例

```
> 列出我桌面上所有視窗
> 截取 Notepad 的畫面並分析 UI 佈局
> 開始即時串流 VS Code 的畫面
> 比較截圖前後的 UI 差異
> 搜尋可用的 DesktopLens Plugin
> 停止所有串流 session
```

### 即時串流

```
> 使用 desktoplens_watch 工具串流 "Visual Studio Code" 視窗

回傳:
{
  "session_id": "abc-123",
  "stream_url": "ws://localhost:9876/stream/abc-123",
  "viewer_url": "http://localhost:9876/?session=abc-123",
  "status": "streaming"
}
```

串流支援自適應 FPS (0.5-5fps)、三種品質級別 (low/medium/high)、dirty block 差異壓縮。

### Plugin 系統

```
> 搜尋 UI 相關的 Plugin
> 安裝 Plugin: /path/to/my-plugin
> 列出已安裝的 Plugin
```

Plugin 使用命名空間隔離：`plugin_{pluginName}_{toolName}`。詳見 [Plugin 開發指南](docs/PLUGIN-DEVELOPMENT.md)。

## 架構

```
Claude Code ◄─ stdio MCP ─► MCP Server (10 tools)
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         Capture         WebSocket          Plugin
         Engine          Streaming          System
              │                │                │
         Screenshots     Chrome Viewer     Marketplace
```

詳見 [系統架構文件](docs/ARCHITECTURE.md)。

## 開發

```bash
# 安裝依賴
npm install

# TypeScript 型別檢查
npx tsc --noEmit

# 開發模式
npm run dev

# 執行測試 (329 tests)
npm test

# 執行測試 + 覆蓋率 (100%)
npm run test:coverage

# 編譯
npm run build
```

## 平台支援

| 平台 | 截圖方式 | 狀態 |
|------|---------|------|
| Windows | node-screenshots (Rust native) | ✅ 完整支援 |
| macOS | node-screenshots (Rust native) | ✅ 完整支援 |
| Linux | node-screenshots (Rust native) | ✅ 完整支援 |

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DESKTOPLENS_PORT` | `9876` | WebSocket 埠號 |
| `DESKTOPLENS_DEFAULT_FPS` | `2` | 預設串流幀率 |
| `DESKTOPLENS_DEFAULT_QUALITY` | `medium` | 預設畫質 (low/medium/high) |
| `DESKTOPLENS_PLUGIN_DIR` | `~/.desktoplens/plugins` | Plugin 目錄 |
| `DESKTOPLENS_LOG_LEVEL` | `info` | 日誌等級 (debug/info/warn/error) |

## 文件

- [系統架構](docs/ARCHITECTURE.md) — 模組總覽、資料流、依賴注入
- [MCP Tools API](docs/MCP-TOOLS-API.md) — 10 個工具完整 API 文件
- [Plugin 開發指南](docs/PLUGIN-DEVELOPMENT.md) — Plugin 開發教學、PluginContext API
- [疑難排解](docs/TROUBLESHOOTING.md) — 常見問題與平台特定問題

## 專案路線圖

- [x] Phase 1 — Core MVP：視窗列表 + 截圖 + MCP Server (v0.1.0)
- [x] Phase 2 — Streaming：WebSocket 即時串流 + Chrome Viewer (v0.2.0)
- [x] Phase 3 — Analysis：UI 對比分析 + 標註 (v0.3.0)
- [x] Phase 4 — Plugin Ecosystem：Plugin 市場 + 動態載入 (v0.4.0)
- [x] Phase 5 — Polish & Ship：E2E 測試 + 文件 + npm 發布 (v0.5.0)
- [x] Phase 6 — Claude Code Plugin：Plugin 打包 + Marketplace 發布 (v0.6.0)

## 授權

[MIT](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=LostSunset/DesktopLens_MCP&type=Date)](https://star-history.com/#LostSunset/DesktopLens_MCP&Date)
