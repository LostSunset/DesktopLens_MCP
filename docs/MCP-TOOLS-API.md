# DesktopLens MCP Tools API

DesktopLens 提供 10 個 MCP 工具，分為核心工具 (6) 和 Plugin 工具 (4)。

---

## 核心工具

### desktoplens_list_windows

列出桌面上所有可見視窗。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `filter` | string | 否 | 視窗標題模糊搜尋 |

**回傳:**
```json
{
  "count": 3,
  "windows": [
    {
      "id": 42,
      "title": "Untitled - Notepad",
      "app_name": "notepad.exe",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 800, "height": 600 },
      "is_minimized": false
    }
  ]
}
```

---

### desktoplens_screenshot

擷取指定視窗的截圖。自動儲存快照供後續比較。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `window_id` | number | 二擇一 | 視窗 ID |
| `window_title` | string | 二擇一 | 視窗標題 (模糊搜尋) |
| `quality` | enum | 否 | `low` / `medium` (預設) / `high` |
| `annotate` | boolean | 否 | 是否加上 grid overlay 標注 |

**回傳:**
- `text`: 包含 window info、snapshot_id、metadata
- `image`: base64 編碼截圖 (JPEG/WebP/PNG，依 quality 而定)

---

### desktoplens_status

取得 DesktopLens 伺服器狀態。

**參數:** 無

**回傳:**
```json
{
  "version": "0.5.0",
  "uptime_seconds": 120,
  "capture_available": true,
  "platform": {
    "os": "win32",
    "arch": "x64",
    "node": "v20.10.0"
  },
  "streaming": {
    "active_sessions": [
      {
        "session_id": "abc-123",
        "window_title": "Notepad",
        "fps": 2,
        "quality": "medium",
        "uptime_seconds": 30,
        "frame_count": 60,
        "status": "streaming"
      }
    ]
  }
}
```

---

### desktoplens_watch

開始即時串流指定視窗。透過 WebSocket 傳輸影格到 Chrome Viewer。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `window_id` | number | 二擇一 | 視窗 ID |
| `window_title` | string | 二擇一 | 視窗標題 |
| `fps` | number | 否 | 影格率 0.5-5 (預設 2) |
| `quality` | enum | 否 | `low` / `medium` / `high` |
| `open_browser` | boolean | 否 | 是否自動開啟 Chrome Viewer |

**回傳:**
```json
{
  "session_id": "abc-123",
  "stream_url": "ws://localhost:9876/stream/abc-123",
  "viewer_url": "http://localhost:9876/?session=abc-123",
  "status": "streaming"
}
```

---

### desktoplens_stop

停止串流 session。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `session_id` | string | 否 | 指定 session，省略則停止全部 |

**回傳:**
```json
{
  "stopped": ["abc-123", "def-456"]
}
```

---

### desktoplens_compare

比較兩張截圖的差異。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `before_snapshot_id` | string | 二擇一 | 已儲存的快照 ID |
| `before_window_id` | number | 二擇一 | 即時擷取 before |
| `before_window_title` | string | 二擇一 | 即時擷取 before (模糊搜尋) |
| `after_window_id` | number | 二擇一 | 即時擷取 after |
| `after_window_title` | string | 二擇一 | 即時擷取 after (模糊搜尋) |
| `highlight_diff` | boolean | 否 | 高亮差異區域 (預設 true) |
| `threshold` | number | 否 | 像素差異門檻 0-1 (預設 0.1) |

**回傳:**
```json
{
  "similarity_score": 0.95,
  "diff_pixel_count": 2400,
  "total_pixels": 480000,
  "changed_regions": [
    {
      "x": 100, "y": 200,
      "width": 150, "height": 80,
      "pixel_count": 1200
    }
  ],
  "threshold": 0.1
}
```
加上 diff image (base64 PNG)。

---

## Plugin 工具

### desktoplens_plugin_search

在 GitHub marketplace 搜尋 DesktopLens plugin。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `query` | string | 是 | 搜尋關鍵字 |

**回傳:**
```json
{
  "total": 5,
  "plugins": [
    {
      "name": "ui-grid-overlay",
      "description": "Grid overlay for UI measurement",
      "stars": 42,
      "url": "https://github.com/user/desktoplens-plugin-ui-grid"
    }
  ]
}
```

---

### desktoplens_plugin_install

從本地路徑安裝 plugin。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `source` | string | 是 | Plugin 目錄的本地路徑 |

**回傳 (成功):**
```json
{
  "installed": true,
  "plugin_name": "ui-grid",
  "version": "1.0.0"
}
```

**回傳 (失敗):** `isError: true`，附帶錯誤訊息。

---

### desktoplens_plugin_list

列出所有已安裝的 plugin。

**參數:** 無

**回傳:**
```json
{
  "count": 2,
  "plugins": [
    {
      "name": "ui-grid",
      "version": "1.0.0",
      "description": "Grid overlay",
      "enabled": true,
      "tools": ["overlay", "measure"]
    }
  ]
}
```

---

### desktoplens_plugin_remove

移除已安裝的 plugin。

**參數:**
| 名稱 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `plugin_name` | string | 是 | Plugin 名稱 |

**回傳:**
```json
{
  "removed": true
}
```
