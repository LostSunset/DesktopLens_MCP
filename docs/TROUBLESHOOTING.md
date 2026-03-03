# DesktopLens MCP 疑難排解

## 常見問題

### 擷取引擎不可用

**症狀:** `desktoplens_status` 顯示 `capture_available: false`

**原因:** 原生螢幕擷取模組 (`node-screenshots`) 無法載入。

**解決方案:**
1. 確認 Node.js 版本 ≥ 18.0.0
2. 重新安裝原生模組：
   ```bash
   npm rebuild node-screenshots
   ```
3. Windows：確認已安裝 Visual Studio Build Tools
4. Linux：確認已安裝 `libxcb`, `libxrandr` 等 X11 開發套件

---

### 視窗列表為空

**症狀:** `desktoplens_list_windows` 回傳 `count: 0`

**可能原因:**
- 所有視窗都已最小化
- 擷取引擎不可用（見上）
- Linux Wayland 環境下需要額外權限

**解決方案:**
1. 確認至少有一個非最小化的視窗
2. 檢查 `desktoplens_status` 確認擷取引擎狀態

---

### 截圖模糊或品質差

**症狀:** 截圖解析度低或壓縮過度

**解決方案:**
在 `desktoplens_screenshot` 使用 `quality: "high"` 參數：
```json
{ "window_id": 42, "quality": "high" }
```

品質級別對照：
| 級別 | 格式 | 縮放 | 大小 |
|------|------|------|------|
| low | JPEG q=50 | 50% | ~30KB |
| medium | WebP q=75 | 75% | ~80KB |
| high | PNG | 100% | ~300KB |

---

### WebSocket 連線失敗

**症狀:** Chrome Viewer 無法連線到串流

**可能原因:**
- 端口 9876 被佔用
- 防火牆阻擋

**解決方案:**
1. 更改端口：設定環境變數 `DESKTOPLENS_PORT=9877`
2. 確認防火牆允許 localhost 連線
3. 檢查是否有其他 DesktopLens 實例在運行

---

### Playwright 不可用

**症狀:** `open_browser: true` 時 Chrome Viewer 沒有開啟

**原因:** Playwright 是可選依賴，未安裝或版本不相容。

**解決方案:**
```bash
# 安裝 Playwright (可選)
npm install playwright
npx playwright install chromium
```

即使 Playwright 不可用，串流功能仍可透過手動開啟瀏覽器使用。

---

### Plugin 安裝失敗

**症狀:** `desktoplens_plugin_install` 回傳 `installed: false`

**常見原因:**
1. `plugin.json` 格式錯誤
2. 必填欄位缺失 (name, version, description, main, tools)
3. Plugin 名稱與已安裝的衝突
4. 工具名稱使用了保留前綴 `desktoplens_`

**解決方案:**
1. 檢查 `plugin.json` 是否符合格式
2. 確認 `main` 指向的檔案存在
3. 查看錯誤訊息中的具體驗證失敗原因

---

### 比較功能報錯

**症狀:** `desktoplens_compare` 回傳錯誤

**常見原因:**
1. `before_snapshot_id` 不存在（快照已過期或 server 重啟）
2. 未提供 before 來源
3. 指定的視窗不存在

**解決方案:**
1. 先用 `desktoplens_screenshot` 建立快照，記住 `snapshot_id`
2. 快照儲存在記憶體中，server 重啟後會清空 (最多保留 50 個)
3. 確認目標視窗仍然存在且未最小化

---

## 平台特定問題

### Windows

- **高 DPI 顯示器:** 截圖可能包含 DPI 縮放，這是預期行為
- **UAC 視窗:** 無法擷取系統層級的視窗 (如 UAC 對話框)
- **Windows Defender:** 可能需要將 node.exe 加入例外清單

### macOS

- **螢幕錄影權限:** 首次使用需在系統偏好設定中授權螢幕錄影
- **位置:** 系統偏好設定 → 安全性與隱私 → 隱私 → 螢幕錄影

### Linux

- **X11 vs Wayland:** 目前主要支援 X11。Wayland 支援為實驗性
- **依賴套件:** 需要 `xdotool` (X11) 或 `grim` + `slurp` (Wayland)

---

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DESKTOPLENS_PORT` | 9876 | WebSocket 伺服器端口 |
| `DESKTOPLENS_DEFAULT_FPS` | 2 | 預設影格率 |
| `DESKTOPLENS_DEFAULT_QUALITY` | medium | 預設品質 |
| `DESKTOPLENS_PLUGIN_DIR` | ~/.desktoplens/plugins | Plugin 目錄 |
| `DESKTOPLENS_LOG_LEVEL` | info | 日誌級別 (debug/info/warn/error) |

---

## 取得幫助

1. 開啟 [GitHub Issues](https://github.com/LostSunset/DesktopLens_MCP/issues)
2. 附上 `desktoplens_status` 的輸出
3. 附上相關錯誤日誌
