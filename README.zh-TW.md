# Watermark Bucket Uploader

一個 Obsidian 外掛，攔截圖片貼上／拖放事件，選擇性地轉換為 WebP 格式，透過 Canvas 疊加浮水印，上傳至 Cloudflare R2（或任何 S3 相容儲存服務），並將結果 URL 以 Markdown 圖片語法插入筆記。

[English](README.md)

## 功能特色

- **貼上／拖放自動上傳** — 圖片無需手動操作，即時上傳。
- **WebP 轉換** — 上傳前將圖片轉換為 WebP 格式，可設定品質，有效縮減檔案大小。
- **圖片壓縮** — 可設定品質、最大尺寸與檔案大小上限，進一步減少儲存空間與頻寬消耗。
- **文字浮水印** — 疊加自訂文字，可設定字體、大小、顏色、粗體／斜體、位置與偏移量。
- **Logo 浮水印** — 以 Vault 內的本地圖片作為浮水印，可設定大小、透明度、位置與偏移量。
- **即時浮水印預覽** — 在設定頁面即時預覽浮水印效果，可自訂預覽背景與解析度。
- **S3 / R2 相容** — 支援 Cloudflare R2、AWS S3、MinIO 及任何 S3 相容服務。
- **本地模式** — 可選擇將檔案複製到 Vault 本地資料夾，而非上傳至雲端。
- **影片 / 音訊 / PDF 支援** — 可選擇性地上傳非圖片類型的檔案。
- **忽略規則** — 使用 glob 模式跳過特定筆記的上傳（例如 `Private/*`）。
- **連線測試** — 直接在設定頁面驗證 S3/R2 憑證是否正確。

## 安裝方式

### 手動安裝

1. 下載最新版本的發布檔案：`main.js`、`manifest.json`、`styles.css`。
2. 複製到 `<vault>/.obsidian/plugins/watermark-bucket-uploader/`。
3. 在 **設定 → 社群外掛** 中啟用此外掛。

## 設定說明

前往 **設定 → Watermark Bucket Uploader** 來設定你的儲存服務。

### 核心設定

| 欄位 | 說明 |
|---|---|
| Access Key | S3 / R2 存取金鑰 ID |
| Secret Key | S3 / R2 私密金鑰（安全儲存於本地） |
| Region | 儲存桶區域（Cloudflare R2 使用 `auto`） |
| S3 Bucket | 儲存桶名稱 |
| Bucket Folder | 儲存桶內的可選路徑前綴，支援 `${year}`、`${month}`、`${day}`、`${basename}` 動態變數 |

### 進階設定

- **自訂端點（Custom Endpoint）**：Cloudflare R2 及非 AWS 服務必填。
- **強制路徑風格 URL（Force Path-Style URLs）**：使用 `endpoint/bucket/file` 格式，而非 `bucket.endpoint/file`。
- **自訂圖片 URL（Custom Image URL）**：覆蓋公開 URL 的基底（例如使用 CDN 或自訂網域時）。
- **Query String**：在插入的連結後附加版本號或存取 Token（例如 `?v=1`）。
- **繞過本地 CORS（Bypass Local CORS）**：若在 Obsidian 內上傳時遇到 CORS 問題，請啟用此選項。

### 浮水印設定

透過設定頁面的**即時預覽**來調整浮水印效果。

| 欄位 | 說明 |
|---|---|
| **文字浮水印** | 開關文字疊加功能。 |
| 文字（Text） | 要顯示的文字（例如 `© yourdomain.com`）。 |
| 字體（Font Family） | 指定字體（例如 `arial`、`georgia`、`monospace`）。 |
| 字體大小（Font Size） | 單位為像素；設為 `0` 則自動縮放（圖片寬度的 2%）。 |
| 樣式（Style） | 切換**粗體**與*斜體*。 |
| 顏色（Color） | CSS 顏色字串（例如 `rgba(255,255,255,0.8)`）。 |
| **Logo 浮水印** | 開關圖片疊加功能。 |
| Logo 路徑（Logo Path） | Vault 相對路徑（例如 `_assets/logo.png`）。 |
| Logo 大小（Logo Size） | 以目標圖片寬度的百分比縮放。 |
| Logo 透明度（Logo Opacity） | 透明度（0.0 到 1.0）。 |
| **共用設定** | |
| 位置（Position） | 選擇右下、左下、置中下方或置中。 |
| X/Y 偏移（Offset X/Y） | 以圖片尺寸百分比微調位置（±%）。 |
| 預覽解析度（Preview Res） | 設定預覽畫布解析度（720p 至 4K），以準確呈現縮放效果。 |

![浮水印設定即時預覽](assets/watermark-settings-preview.png)

### Cloudflare R2 快速設定

1. 在 Cloudflare R2 儀表板建立一個儲存桶。
2. 產生一個具有 **Object Read & Write** 權限的 API Token。
3. 將 **Custom Endpoint** 設定為 `https://<account-id>.r2.cloudflarestorage.com`。
4. 將 **Region** 設定為 `auto`。
5. 將 **Custom Image URL** 設定為你的公開儲存桶網域（或 R2 dev 網域）。

## 使用方式

- **貼上** 圖片（`Ctrl/Cmd+V`）到任意筆記中 — 外掛會攔截、處理、上傳，並插入 `![](url)`。
- **拖放** 圖片到編輯器（請確保已啟用「拖放上傳」選項）。
- **命令面板** → `Upload image`，手動選取並上傳檔案。
- **建立時自動上傳** — 若已啟用，任何新增至 Vault 的圖片（例如透過同步）將自動上傳並從本地刪除。

## 浮水印與圖片處理

外掛在設定頁面提供功能強大的**即時預覽** Canvas。

- **文字浮水印**：自訂文字、字體、大小（0 為自動）、顏色與位置。
- **Logo 浮水印**：提供 Vault 相對路徑（例如 `_assets/logo.png`）以使用圖片作為浮水印。
- **壓縮**：設定最大檔案大小或尺寸，節省儲存空間與頻寬。
- **WebP**：切換轉換為現代 WebP 格式，達到最佳網頁效能。

## 開發

1. 安裝相依套件：`npm install`
2. 以熱重載模式啟動開發：`npm run dev`
3. 建置正式版本：`npm run build`
4. 執行測試：`npm test`
5. 程式碼檢查：`npm run lint`

## 授權條款

MIT
