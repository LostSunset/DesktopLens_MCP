# DesktopLens MCP 系統架構

## 模組總覽

```
┌───────────────────────────────────────────────────┐
│                  MCP Server (stdio)                │
│                   src/server.ts                    │
├────────┬────────┬────────┬────────┬────────────────┤
│ Tools  │ Stream │Analysis│ Plugin │    Browser      │
│ (10)   │        │        │        │                │
├────────┴────────┴────────┴────────┴────────────────┤
│              Capture Engine                        │
│          src/capture/engine.ts                     │
├───────────────────────────────────────────────────┤
│           Platform Layer (OS APIs)                 │
└───────────────────────────────────────────────────┘
```

## 目錄結構

```
src/
├── index.ts                  # CLI 入口
├── server.ts                 # MCP Server 工廠 + DI
├── capture/
│   ├── engine.ts             # 擷取引擎抽象 + 工廠
│   └── node-screenshots.ts   # node-screenshots 實作
├── stream/
│   ├── protocol.ts           # 二進制幀協議 (magic header + frame types)
│   ├── encoder.ts            # 品質級別編碼 (low/medium/high)
│   ├── frame-differ.ts       # 8×6 grid dirty block 差異偵測
│   ├── websocket-server.ts   # HTTP + WebSocket 共用端口
│   └── session-manager.ts    # Session CRUD + capture loop
├── browser/
│   └── playwright-bridge.ts  # 動態 import playwright (graceful degradation)
├── analysis/
│   ├── snapshot-store.ts     # LRU 快照儲存 (max 50)
│   ├── comparison.ts         # pixelmatch 像素比較 + 區域偵測
│   └── annotation.ts         # SVG overlay (grid/bounding box)
├── tools/
│   ├── list-windows.ts       # desktoplens_list_windows
│   ├── screenshot.ts         # desktoplens_screenshot
│   ├── status.ts             # desktoplens_status
│   ├── watch.ts              # desktoplens_watch
│   ├── stop.ts               # desktoplens_stop
│   ├── compare.ts            # desktoplens_compare
│   ├── plugin-search.ts      # desktoplens_plugin_search
│   ├── plugin-install.ts     # desktoplens_plugin_install
│   ├── plugin-list.ts        # desktoplens_plugin_list
│   └── plugin-remove.ts      # desktoplens_plugin_remove
├── plugin/
│   ├── manifest.ts           # Zod schema 驗證 plugin.json
│   ├── registry.ts           # ~/.desktoplens/plugins/registry.json
│   ├── loader.ts             # 動態 import + PluginContext sandbox
│   ├── installer.ts          # 安裝/解安裝 plugin
│   └── marketplace.ts        # GitHub Search API marketplace
├── window-manager/
│   └── detector.ts           # 視窗偵測 + 模糊搜尋
└── utils/
    ├── config.ts             # 環境變數設定
    ├── logger.ts             # 結構化 JSON logger
    ├── platform.ts           # 平台資訊偵測
    └── image-utils.ts        # sharp 圖片處理
```

## 資料流

### 截圖流程

```
Claude Code (MCP Client)
    │
    │ callTool("desktoplens_screenshot", {window_id: 42})
    ▼
MCP Server (src/server.ts)
    │
    │ registerScreenshot handler
    ▼
Capture Engine (engine.ts)
    │
    │ captureWindow(42) → raw PNG buffer
    ▼
Image Utils (image-utils.ts)
    │
    │ processImage() → resize + compress
    ▼
Snapshot Store (snapshot-store.ts)
    │
    │ save({windowId, buffer}) → "snap-1"
    ▼
MCP Response
    ├── text: {window, snapshot_id, ...}
    └── image: base64 encoded
```

### 串流流程

```
Claude Code
    │
    │ callTool("desktoplens_watch", {window_id: 42})
    ▼
Session Manager ─────────────► WebSocket Server
    │  create session              │  port 9876
    │  start capture loop          │
    ▼                              ▼
Capture Engine ──► Encoder ──► WS Broadcast
    │  setInterval      │          │
    │  captureWindow()   │          │
    ▼                    ▼          ▼
Frame Differ ──► Protocol    Chrome Viewer
    │  dirty blocks  │  binary     │  Canvas 2D
    └────────────────┘  frames     └  rendering
```

## 依賴注入

`createDesktopLensServer(deps?)` 接受可選的 `ServerDeps`，所有模組都可以注入 mock 或替代實作：

```typescript
interface ServerDeps {
  engine?: CaptureEngine;
  detector?: WindowDetector;
  logger?: Logger;
  streamServer?: StreamServer;
  sessionManager?: SessionManager;
  playwrightBridge?: PlaywrightBridge;
  snapshotStore?: SnapshotStore;
  pluginRegistry?: PluginRegistry;
}
```

## Plugin 系統架構

```
Plugin Directory (~/.desktoplens/plugins/)
    │
    ├── registry.json         # 已安裝 plugin 清單
    ├── ui-grid/
    │   ├── plugin.json       # manifest
    │   └── dist/index.js     # 入口
    └── color-palette/
        ├── plugin.json
        └── dist/index.js

Plugin 載入流程:
  manifest.ts (驗證) → loader.ts (import + sandbox) → MCP Server (註冊工具)

命名空間: plugin_{pluginName}_{toolName}
例如: plugin_ui-grid_overlay
```

## 測試架構

```
test/
├── unit/           # 單元測試 (mock 所有外部依賴)
├── integration/    # 整合測試 (MCP Client ↔ Server)
├── e2e/            # E2E 測試 (完整流程)
└── fixtures/       # 測試用 plugin fixtures
```

- 測試框架: Vitest
- 覆蓋率目標: 100% (statements, branches, functions, lines)
- Mock 策略: 所有原生模組 (sharp, ws, node-screenshots, playwright) 使用 vi.mock()
