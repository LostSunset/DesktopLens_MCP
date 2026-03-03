# DesktopLens Plugin 開發指南

## 快速開始

### 1. 建立 Plugin 目錄結構

```
my-plugin/
├── plugin.json      # Manifest (必須)
├── src/
│   └── index.ts     # 入口
├── dist/
│   └── index.js     # 編譯後入口
├── package.json
└── tsconfig.json
```

### 2. 撰寫 plugin.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My DesktopLens plugin",
  "main": "dist/index.js",
  "tools": [
    {
      "name": "my_tool",
      "description": "Does something useful"
    }
  ]
}
```

**Manifest 欄位：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `name` | string | 是 | Plugin 名稱 (英數字 + 連字號) |
| `version` | string | 是 | SemVer 版本號 |
| `description` | string | 是 | 簡短描述 |
| `main` | string | 是 | 入口檔案路徑 |
| `tools` | array | 是 | 工具定義陣列 |
| `author` | string | 否 | 作者 |
| `license` | string | 否 | 授權 |
| `homepage` | string | 否 | 首頁 URL |
| `dependencies` | object | 否 | 相依套件 |

### 3. 實作 Plugin

```typescript
// src/index.ts
import type { PluginContext } from 'desktoplens-mcp';

export async function activate(context: PluginContext): Promise<void> {
  context.logger.info('My plugin activated');

  context.registerToolHandler('my_tool', async (params) => {
    const input = params.text as string ?? 'default';

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result: `Processed: ${input}` }),
      }],
    };
  });
}

export function deactivate(): void {
  // 清理資源
}
```

### 4. 編譯並安裝

```bash
# 編譯
npx tsc

# 安裝 (透過 Claude Code)
# Claude 會呼叫 desktoplens_plugin_install 工具
```

---

## PluginContext API

Plugin 透過 `PluginContext` 與 DesktopLens 互動：

### pluginName

```typescript
readonly pluginName: string
```

Plugin 名稱（唯讀）。

### logger

```typescript
readonly logger: Logger
```

預設帶有 `[plugin:name]` 前綴的 logger，包含 `debug`、`info`、`warn`、`error` 四個方法。

### registerToolHandler

```typescript
registerToolHandler(toolName: string, handler: PluginToolHandler): void
```

註冊工具處理函式。`toolName` 必須與 `plugin.json` 中定義的 `tools[].name` 一致。

---

## 工具命名空間

Plugin 工具會自動加上前綴：`plugin_{pluginName}_{toolName}`

例如：
- Plugin 名稱: `ui-grid`
- 工具名稱: `overlay`
- MCP 工具名稱: `plugin_ui-grid_overlay`

---

## PluginToolHandler 回傳格式

Handler 必須回傳符合 MCP `CallToolResult` 格式：

```typescript
type PluginToolHandler = (
  params: Record<string, unknown>,
) => Promise<CallToolResult>;

// CallToolResult
interface CallToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;      // base64
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

---

## 錯誤處理

Plugin handler 拋出的錯誤會被自動包裝成 MCP 錯誤回應：

```typescript
context.registerToolHandler('risky_tool', async (params) => {
  throw new Error('Something went wrong');
  // → { isError: true, content: [{ type: 'text', text: 'Plugin error: Something went wrong' }] }
});
```

---

## 限制

1. Plugin **不能**修改核心 MCP 工具
2. Plugin **不能**存取其他 Plugin 的資源
3. Plugin 工具名稱**不能**使用保留前綴 `desktoplens_`
4. Plugin 在 function-scope sandbox 中執行，無 VM 隔離

---

## 發布到 Marketplace

1. 在 GitHub 建立 repository
2. 加上 `desktoplens-plugin` topic
3. 確保 `plugin.json` 在 repository 根目錄
4. 使用者透過 `desktoplens_plugin_search` 搜尋即可找到

---

## 範例 Plugin

### Color Palette Extractor

```typescript
export async function activate(context: PluginContext): Promise<void> {
  context.registerToolHandler('extract_colors', async (params) => {
    const imageData = params.image_base64 as string;
    // 分析圖片顏色...
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          dominant_colors: ['#FF5733', '#33FF57', '#3357FF'],
          palette_size: 3,
        }),
      }],
    };
  });
}
```

### Accessibility Checker

```typescript
export async function activate(context: PluginContext): Promise<void> {
  context.registerToolHandler('check_contrast', async (params) => {
    const fg = params.foreground as string;
    const bg = params.background as string;
    // 計算對比度...
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          contrast_ratio: 4.5,
          wcag_aa: true,
          wcag_aaa: false,
        }),
      }],
    };
  });
}
```
