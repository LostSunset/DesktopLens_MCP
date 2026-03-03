# 🔭 DesktopLens MCP — Project Blueprint

## 專案名稱

**DesktopLens** — _Real-time Desktop UI Vision for Claude Code_

> "Give Claude Code eyes beyond the browser."

---

## NPM Package Name

```
desktoplens-mcp
```

## Plugin 指令（目標）

```bash
/plugin marketplace add geralt-formosa/desktoplens-mcp
/plugin install desktoplens@desktoplens-mcp
```

---

## Claude Code 開發提示詞

> 直接複製下方整段貼入 Claude Code 開始開發

---

你是 Opus 4.6 首席架構師，現在帶領一個完整開發團隊來建構 "DesktopLens MCP" 專案。

## 🎯 專案目標

DesktopLens 是一個 MCP (Model Context Protocol) Server，讓 Claude Code 能夠：
1. 即時捕獲 Windows/macOS/Linux 桌面上任何非 Web 原生應用程式的 UI 畫面
2. 透過 Playwright 在 Chrome 中顯示即時串流
3. Claude Code 可透過 MCP 工具呼叫截圖、分析 UI、提出改進建議
4. 支援 /plugin marketplace 快速安裝機制

## 👥 開發團隊角色分配

以 Opus 4.6 的能力，你需要同時扮演以下角色並交替切換：

- **🏗️ Architect (架構師)**: 設計整體系統架構、MCP 協議介面、模組劃分
- **⚡ Backend Engineer (後端工程師)**: 實現截圖引擎、WebSocket 串流、視窗管理
- **🎨 Frontend Engineer (前端工程師)**: 實現 Chrome 端即時顯示頁面、控制面板
- **🔌 MCP Specialist (MCP 專家)**: 實現 MCP Server 協議、工具定義、與 Claude Code 整合
- **🧪 QA Engineer (測試工程師)**: 撰寫完整測試套件、端到端測試
- **📦 DevOps (發佈工程師)**: 設定 npm 發佈流程、/plugin 機制、CI/CD

## 📁 專案結構

```
desktoplens-mcp/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE (MIT)
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish.yml
├── src/
│   ├── index.ts                    # MCP Server 入口
│   ├── server.ts                   # MCP Server 主邏輯
│   ├── capture/
│   │   ├── engine.ts               # 截圖引擎抽象層
│   │   ├── windows.ts              # Windows 截圖 (win32 API / PowerShell)
│   │   ├── macos.ts                # macOS 截圖 (screencapture)
│   │   └── linux.ts                # Linux 截圖 (xdotool + scrot / grim)
│   ├── stream/
│   │   ├── websocket-server.ts     # WebSocket 即時串流 Server
│   │   ├── frame-buffer.ts         # 幀緩衝與差異壓縮
│   │   └── encoder.ts              # PNG/JPEG/WebP 編碼選擇
│   ├── window-manager/
│   │   ├── detector.ts             # 視窗偵測與列舉
│   │   ├── tracker.ts              # 視窗追蹤 (位置、大小、焦點變化)
│   │   └── selector.ts             # 互動式視窗選擇器
│   ├── browser/
│   │   ├── playwright-bridge.ts    # Playwright 瀏覽器管理
│   │   ├── viewer-page.ts          # 注入到 Chrome 的顯示頁面
│   │   └── overlay.ts              # UI 分析標註覆蓋層
│   ├── analysis/
│   │   ├── screenshot.ts           # 截圖並回傳 base64 給 Claude
│   │   ├── comparison.ts           # 前後對比分析
│   │   └── annotation.ts           # UI 元素標註 (邊界框、網格)
│   ├── tools/                      # MCP Tools 定義
│   │   ├── capture-tools.ts        # 截圖相關工具
│   │   ├── window-tools.ts         # 視窗管理工具
│   │   ├── stream-tools.ts         # 串流控制工具
│   │   ├── analysis-tools.ts       # UI 分析工具
│   │   └── plugin-tools.ts         # Plugin marketplace 工具
│   ├── plugin/
│   │   ├── marketplace.ts          # Plugin marketplace 客戶端
│   │   ├── installer.ts            # Plugin 安裝/移除管理
│   │   ├── registry.ts             # 本地 plugin 註冊表
│   │   └── loader.ts               # 動態 plugin 載入器
│   └── utils/
│       ├── platform.ts             # 跨平台偵測
│       ├── logger.ts               # 結構化日誌
│       ├── config.ts               # 設定管理
│       └── image-utils.ts          # 圖像處理工具
├── viewer/                         # Chrome 顯示端
│   ├── index.html                  # 主頁面
│   ├── viewer.js                   # WebSocket 客戶端 + 畫面渲染
│   ├── controls.js                 # 控制面板 (視窗選擇、FPS、品質)
│   └── styles.css                  # UI 樣式
├── plugins/                        # 內建 plugin 範例
│   ├── ui-grid-overlay/            # 網格覆蓋分析
│   ├── color-palette-extract/      # 色彩提取
│   └── accessibility-check/        # 無障礙檢查
├── test/
│   ├── unit/
│   │   ├── capture.test.ts
│   │   ├── stream.test.ts
│   │   ├── window-manager.test.ts
│   │   ├── plugin.test.ts
│   │   └── tools.test.ts
│   ├── integration/
│   │   ├── mcp-server.test.ts
│   │   ├── playwright-bridge.test.ts
│   │   └── websocket-stream.test.ts
│   └── e2e/
│       ├── full-capture-flow.test.ts
│       └── plugin-install.test.ts
├── scripts/
│   ├── setup.ts                    # 首次安裝設定
│   └── generate-plugin-template.ts # Plugin 模板產生器
└── docs/
    ├── ARCHITECTURE.md
    ├── MCP-TOOLS-API.md
    ├── PLUGIN-DEVELOPMENT.md
    └── TROUBLESHOOTING.md
```

## 🔌 MCP Tools 定義 (必須實現的工具)

### 核心工具

```typescript
// 1. 列出所有可見視窗
tool: "desktoplens_list_windows"
input: { filter?: string }  // 可選的標題關鍵字過濾
output: { windows: Array<{ id: string, title: string, process: string, bounds: Rect, visible: boolean }> }

// 2. 開始監控指定視窗
tool: "desktoplens_watch"
input: { 
  window_id?: string,        // 指定視窗 ID
  window_title?: string,     // 或用標題模糊匹配
  fps?: number,              // 幀率 (預設 2)
  quality?: "low"|"medium"|"high",  // 畫質
  open_browser?: boolean     // 是否自動開啟 Chrome 顯示 (預設 true)
}
output: { session_id: string, stream_url: string, status: "streaming" }

// 3. 截圖並回傳 (Claude Code 直接分析)
tool: "desktoplens_screenshot"
input: { 
  window_id?: string,
  window_title?: string,
  format?: "png"|"jpeg"|"webp",
  annotate?: boolean,        // 加上網格和尺寸標註
  resize?: { width: number, height: number }  // 縮放以節省 token
}
output: { 
  image_base64: string, 
  format: string,
  dimensions: { width: number, height: number },
  window_info: { title: string, process: string }
}

// 4. UI 對比分析
tool: "desktoplens_compare"
input: { 
  before_session_id?: string,
  after_window_id?: string,
  highlight_diff?: boolean
}
output: { 
  diff_image_base64: string,
  changes_detected: Array<{ region: Rect, type: "added"|"removed"|"modified" }>,
  similarity_score: number
}

// 5. 停止監控
tool: "desktoplens_stop"
input: { session_id?: string }  // 不指定則停止所有
output: { stopped: string[] }

// 6. 取得串流狀態
tool: "desktoplens_status"
input: {}
output: { 
  active_sessions: Array<{ session_id: string, window_title: string, fps: number, uptime: number }>,
  system: { platform: string, screens: number }
}
```

### Plugin Marketplace 工具

```typescript
// 7. 搜尋 Plugin
tool: "desktoplens_plugin_search"
input: { query: string, category?: string }
output: { plugins: Array<{ name: string, description: string, author: string, version: string, downloads: number }> }

// 8. 安裝 Plugin  
tool: "desktoplens_plugin_install"
input: { name: string, version?: string }
output: { installed: boolean, name: string, version: string, tools_added: string[] }

// 9. 列出已安裝 Plugin
tool: "desktoplens_plugin_list"
input: {}
output: { plugins: Array<{ name: string, version: string, enabled: boolean, tools: string[] }> }

// 10. 移除 Plugin
tool: "desktoplens_plugin_remove"
input: { name: string }
output: { removed: boolean }
```

## 🖥️ Chrome Viewer 頁面規格

在 Playwright 開啟的 Chrome 頁面中顯示：

```
┌─────────────────────────────────────────────┐
│  🔭 DesktopLens Viewer    [Window ▼] [⚙️]   │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│          [ 即時桌面視窗畫面 ]                 │
│          WebSocket 串流渲染                   │
│          Canvas 2D / ImageBitmap             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  FPS: 2  │  Res: 1920x1080  │  🟢 Live      │
│  Latency: 45ms │ Format: WebP │  CPU: 3%    │
└─────────────────────────────────────────────┘
```

要求：
- 使用 Canvas 渲染而非 img 輪替（減少閃爍）
- WebSocket 二進制傳輸（非 base64）
- 自適應品質：根據頻寬自動調整壓縮率
- 滑鼠懸停時顯示像素座標
- 可選網格覆蓋層

## 📋 /plugin 機制設計

### Plugin Manifest (plugin.json)

```json
{
  "name": "ui-grid-overlay",
  "version": "1.0.0",
  "description": "Overlay alignment grid on captured UI",
  "author": "geralt-formosa",
  "main": "dist/index.js",
  "desktoplens": {
    "minVersion": "1.0.0",
    "tools": [
      {
        "name": "grid_overlay",
        "description": "Apply grid overlay to screenshot",
        "inputSchema": {}
      }
    ],
    "hooks": ["onCapture", "onAnalysis"]
  },
  "repository": "https://github.com/geralt-formosa/desktoplens-plugin-grid"
}
```

### Claude Code /plugin 指令映射

```
用戶輸入:
  /plugin marketplace search <keyword>
  → 呼叫 desktoplens_plugin_search

  /plugin marketplace add <author>/<plugin-name>
  → 呼叫 desktoplens_plugin_install 從 GitHub/npm registry 安裝

  /plugin install <name>@<version>
  → 呼叫 desktoplens_plugin_install 指定版本

  /plugin list
  → 呼叫 desktoplens_plugin_list

  /plugin remove <name>
  → 呼叫 desktoplens_plugin_remove

  /plugin create <name>
  → 執行 generate-plugin-template.ts 產生 plugin 骨架
```

### Plugin Registry

- 第一階段：使用 GitHub Releases 作為 registry
- 第二階段：建立 desktoplens.dev registry API
- 本地快取在 ~/.desktoplens/plugins/
- 設定檔在 ~/.desktoplens/config.json

## ⚡ 技術規格

### 截圖引擎

| 平台 | 方案 | 備註 |
|------|------|------|
| Windows | screenshot-desktop + win32-api (node-ffi-napi) | 支援指定視窗 HWND 截圖 |
| macOS | screencapture CLI + Core Graphics via native addon | 需要螢幕錄製權限 |
| Linux X11 | xdotool + import (ImageMagick) | X11 環境 |
| Linux Wayland | grim + slurp | Wayland 環境 |

### 串流優化

- **差異幀壓縮**: 只傳輸變化區域 (dirty rectangles)
- **自適應 FPS**: 畫面靜止時降到 0.5fps，變化時升到 5fps
- **多品質層級**: 
  - Low: JPEG q=50, 50% 縮放 → ~30KB/frame
  - Medium: WebP q=75, 75% 縮放 → ~80KB/frame  
  - High: PNG lossless, 100% → ~300KB/frame

### MCP Server 配置

```json
{
  "mcpServers": {
    "desktoplens": {
      "command": "npx",
      "args": ["-y", "desktoplens-mcp"],
      "env": {
        "DESKTOPLENS_PORT": "9876",
        "DESKTOPLENS_DEFAULT_FPS": "2",
        "DESKTOPLENS_DEFAULT_QUALITY": "medium",
        "DESKTOPLENS_PLUGIN_DIR": "~/.desktoplens/plugins"
      }
    }
  }
}
```

## 🧪 測試要求

### 單元測試 (Vitest)
- 截圖引擎：模擬各平台截圖 API
- 幀緩衝：驗證差異壓縮邏輯
- 視窗偵測：mock 系統 API 回傳
- Plugin 載入器：驗證動態載入和隔離
- 每個 MCP tool 的輸入驗證和輸出格式

### 整合測試
- MCP Server 啟動/關閉生命週期
- Playwright 瀏覽器啟動和頁面注入
- WebSocket 連線建立和幀傳輸
- Plugin 安裝/載入/移除完整流程

### 端到端測試
- 完整流程：啟動 → 選視窗 → 串流 → 截圖 → 分析 → 停止
- Plugin 安裝後新增 MCP tool 並可呼叫
- 跨平台煙霧測試 (CI matrix: windows, macos, ubuntu)

### 測試覆蓋率目標
- 行覆蓋率 > 85%
- 分支覆蓋率 > 80%
- 所有 MCP tool 100% 覆蓋

## 🚀 開發順序

### Phase 1: Core (MVP)
1. 專案初始化 (package.json, tsconfig, eslint, vitest)
2. 跨平台截圖引擎 (先 Windows，其他 stub)
3. 視窗偵測與選擇
4. MCP Server 基礎框架
5. 實現 desktoplens_list_windows 和 desktoplens_screenshot
6. 單元測試

### Phase 2: Streaming
7. WebSocket 串流 Server
8. Chrome Viewer 頁面
9. Playwright Bridge
10. 實現 desktoplens_watch, desktoplens_stop, desktoplens_status
11. 差異幀壓縮
12. 整合測試

### Phase 3: Analysis
13. UI 對比工具
14. 標註覆蓋層
15. 實現 desktoplens_compare
16. 與 Claude Vision 的最佳截圖策略

### Phase 4: Plugin Ecosystem
17. Plugin manifest 規格和驗證
18. Plugin 載入器和沙箱
19. Plugin marketplace API 客戶端
20. 實現所有 plugin 相關 MCP tools
21. 內建 plugin 範例 (grid, color, a11y)
22. Plugin 模板產生器

### Phase 5: Polish and Ship
23. 端到端測試
24. README 和文件
25. GitHub Actions CI/CD
26. npm 發佈配置
27. /plugin 指令整合文件

## 📌 關鍵原則

1. **TypeScript Strict Mode** — 全部 strict: true
2. **Zero Config 體驗** — npx 即可啟動，不需要額外設定
3. **優雅降級** — 平台不支援某功能時 fallback 而非 crash
4. **最小權限** — 只請求必要的系統權限
5. **Token 效率** — 截圖回傳前自動壓縮/縮放，避免浪費 Claude 的 vision token
6. **Plugin 安全** — Plugin 在受限沙箱中運行，不能存取主程序核心

## ⚠️ 重要限制

- 截圖引擎不能依賴 Electron 或類似重量框架
- WebSocket Server 必須只綁定 localhost（安全考量）
- Plugin 不能修改核心 MCP tools，只能新增
- 所有截圖資料不離開本機
- Chrome Viewer 不能有任何對外網路請求

---

現在開始 Phase 1。先建立專案結構，實現跨平台截圖引擎和基礎 MCP Server。每完成一個階段，先跑測試確認通過，再進入下一階段。

開工！
