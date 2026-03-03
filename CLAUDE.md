# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DesktopLens MCP** is a Model Context Protocol (MCP) server that gives Claude Code real-time vision of desktop applications outside web browsers. It captures native app UIs, streams them via WebSocket to a Playwright-controlled Chrome viewer, and exposes MCP tools for screenshot analysis.

NPM package name: `desktoplens-mcp`

## Project Status

This project is in **blueprint/specification stage**. The full design is documented in `DesktopLens-MCP-Blueprint.md`. Implementation follows 5 phases:
1. **Phase 1 — Core MVP**: Project init, cross-platform screenshot engine (Windows first), window detection, basic MCP server, `desktoplens_list_windows` + `desktoplens_screenshot`
2. **Phase 2 — Streaming**: WebSocket server, Chrome viewer, Playwright bridge, `desktoplens_watch`/`stop`/`status`, differential frame compression
3. **Phase 3 — Analysis**: UI comparison, annotation overlay, `desktoplens_compare`
4. **Phase 4 — Plugin Ecosystem**: Plugin manifest/loader/sandbox, marketplace API, built-in plugin examples
5. **Phase 5 — Polish & Ship**: E2E tests, docs, CI/CD, npm publish

## Build & Development Commands (Planned)

```bash
npm run build          # TypeScript compilation
npm run dev            # Development mode
npm test               # Run all tests (Vitest — unit, integration, e2e)
npm run plugin:create  # Generate plugin template
```

## Architecture

### Core Modules (`src/`)

- **`index.ts` / `server.ts`** — MCP server entry point and main logic
- **`capture/`** — Cross-platform screenshot engine with abstract layer (`engine.ts`) and platform-specific implementations (Windows win32-api, macOS screencapture, Linux xdotool/grim)
- **`stream/`** — WebSocket real-time streaming with differential frame compression (dirty rectangles) and adaptive quality encoding
- **`window-manager/`** — Window detection, tracking, and interactive selection
- **`browser/`** — Playwright bridge for Chrome viewer with Canvas-based rendering and overlay annotations
- **`analysis/`** — Screenshot capture for Claude Vision, before/after comparison, UI annotation
- **`tools/`** — MCP tool definitions (capture, window, stream, analysis, plugin)
- **`plugin/`** — Plugin marketplace client, installer, registry, and dynamic loader
- **`utils/`** — Platform detection, logger, config, image processing

### Chrome Viewer (`viewer/`)

Static HTML/JS/CSS served to Playwright-controlled Chrome. Uses Canvas 2D rendering (not img rotation) with binary WebSocket transport. Displays real-time stream with FPS/latency/resolution stats.

### MCP Tools (10 total)

Core: `desktoplens_list_windows`, `desktoplens_watch`, `desktoplens_screenshot`, `desktoplens_compare`, `desktoplens_stop`, `desktoplens_status`
Plugin: `desktoplens_plugin_search`, `desktoplens_plugin_install`, `desktoplens_plugin_list`, `desktoplens_plugin_remove`

## Key Technical Decisions

- **TypeScript strict mode** required for all code
- **Vitest** for testing; target 85%+ line coverage, 80%+ branch coverage, 100% MCP tool coverage
- **No Electron** — screenshot engine must use lightweight native APIs only
- **WebSocket binds localhost only** — security requirement
- **Plugins run in sandbox** — cannot modify core MCP tools, only add new ones
- **All screenshot data stays local** — no external network requests from viewer
- **Token efficiency** — auto-compress/resize screenshots before sending to Claude Vision
- **Graceful degradation** — fallback when platform features are unavailable, never crash

## Streaming Quality Levels

| Level  | Format    | Scale | Size/frame |
|--------|-----------|-------|------------|
| Low    | JPEG q=50 | 50%   | ~30KB      |
| Medium | WebP q=75 | 75%   | ~80KB      |
| High   | PNG       | 100%  | ~300KB     |

Adaptive FPS: 0.5fps when idle, up to 5fps on detected changes.

## Platform-Specific Capture

| Platform       | Method                              |
|----------------|-------------------------------------|
| Windows        | screenshot-desktop + win32-api (node-ffi-napi) |
| macOS          | screencapture CLI + Core Graphics   |
| Linux X11      | xdotool + ImageMagick import        |
| Linux Wayland  | grim + slurp                        |

## Environment Variables

```
DESKTOPLENS_PORT=9876
DESKTOPLENS_DEFAULT_FPS=2
DESKTOPLENS_DEFAULT_QUALITY=medium
DESKTOPLENS_PLUGIN_DIR=~/.desktoplens/plugins
```

## Language

This project's documentation and code comments are in Traditional Chinese (正體中文). The blueprint (`DesktopLens-MCP-Blueprint.md`) is the authoritative design reference.

---

## 開發規範與工作準則

### 環境管理

- **Python 套件管理器**：一律使用 `uv`，禁止 pip
- **虛擬環境**：`.venv`，設定 `UV_PROJECT_ENVIRONMENT=.venv`（寫入 `.env` 或 shell profile）
- **編碼**：所有文字檔 UTF-8，`PYTHONIOENCODING=utf-8`
- **倉庫**：`https://github.com/LostSunset/DesktopLens_MCP.git`

### Lint 流程（推送前必做）

1. `ruff format .` → 2. `ruff check --fix .` → 3. `ruff check .`（零錯誤才可推送）

### 版本號（Semantic Versioning）

`fix:` → PATCH, `feat:` → MINOR, `breaking:` → MAJOR。每次推送必須遞增。

### 計畫模式優先

複雜任務先進入計畫模式產出完整計畫再實作。偏離預期立刻回到計畫模式重新規劃。

### 開發團隊模式（預設啟用）

開發任務自動創立虛擬團隊，所有子代理用 `claude-opus-4-6`。角色：架構師、資深開發者、QA、Code Reviewer、DevOps、領域專家。涉及數學/物理/數值方法時自動指派領域專家。

### Code Review 雙重審查（強制）

1. code-review Plugin 自動掃描
2. Opus Code Reviewer 深度審查

兩關皆通過才允許提交。

### 觸發詞

| 觸發詞 | 行為 |
|--------|------|
| 「release」/「發布」 | 自動發布（測試→lint→版本號→tag→push） |
| 「review」/「審查」 | 雙重審查流程 |
| 「開團隊」 | 啟動完整開發團隊 |
| 「砍掉重練」 | 從零實作最優解 |
| 「嚴格考問我」 | 嚴格 reviewer 模式 |
| 「公式審查」 | 領域專家審查公式/模型 |

### Bug 修復

- 貼錯誤訊息 + 「fix」→ 自行理解上下文直接修復
- 「去修好失敗的 CI」→ 自己讀 log、找原因、修復

### 記憶維護

- 犯錯後主動更新記憶檔，確保不再重犯
- 每個任務維護 `docs/notes/` 筆記，PR 完成後更新

### 錯誤紀錄

> 每次犯錯後在此新增，避免再犯。

1. （待記錄）

### README 規範

必須包含：CI 狀態徽章、MIT License 徽章、Python 版本徽章、GitHub stars/forks/issues 徽章、Star History 圖表。
