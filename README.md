# DesktopLens MCP

[![CI](https://github.com/LostSunset/DesktopLens_MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/LostSunset/DesktopLens_MCP/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/desktoplens-mcp)](https://www.npmjs.com/package/desktoplens-mcp)
[![GitHub stars](https://img.shields.io/github/stars/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/network/members)
[![GitHub issues](https://img.shields.io/github/issues/LostSunset/DesktopLens_MCP)](https://github.com/LostSunset/DesktopLens_MCP/issues)

> Give Claude Code eyes beyond the browser.

**DesktopLens MCP** 是一個 Model Context Protocol (MCP) Server，讓 Claude Code 能即時捕獲桌面應用程式的 UI 畫面進行分析。

## 功能

- **desktoplens_list_windows** — 列出所有可見桌面視窗
- **desktoplens_screenshot** — 截取指定視窗截圖，回傳 base64 圖片供 Claude Vision 分析
- **desktoplens_status** — 回傳伺服器狀態與平台資訊

## 快速開始

### Claude Code 設定

將以下設定加入你的 MCP 設定：

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

### 使用方式

在 Claude Code 中直接使用：

```
> 列出我桌面上所有視窗
> 截取 Notepad 的畫面並分析 UI 佈局
> 檢查 DesktopLens 伺服器狀態
```

## 開發

```bash
# 安裝依賴
npm install

# TypeScript 型別檢查
npx tsc --noEmit

# 開發模式
npm run dev

# 執行測試
npm test

# 執行測試 + 覆蓋率
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

## 專案路線圖

- [x] Phase 1 — Core MVP：視窗列表 + 截圖 + MCP Server
- [ ] Phase 2 — Streaming：WebSocket 即時串流 + Chrome Viewer
- [ ] Phase 3 — Analysis：UI 對比分析 + 標註
- [ ] Phase 4 — Plugin Ecosystem：Plugin 市場 + 動態載入
- [ ] Phase 5 — Polish & Ship：E2E 測試 + 文件 + npm 發布

## 授權

[MIT](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=LostSunset/DesktopLens_MCP&type=Date)](https://star-history.com/#LostSunset/DesktopLens_MCP&Date)
