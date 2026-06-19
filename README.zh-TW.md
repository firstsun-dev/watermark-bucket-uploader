# Watermark Bucket Uploader

[English](README.md)

**貼上圖片，它已經上傳、加上浮水印、插入連結——手指還沒離開鍵盤。**

告別手動上傳的繁瑣。這個 Obsidian 外掛攔截每一次貼上與拖放，自動蓋上你的浮水印、轉換成 WebP、上傳到你自己的 S3/R2，然後把乾淨的 `![](url)` 直接寫進筆記。零摩擦。你的圖片、你的基礎設施、你的品牌識別。

![浮水印設定即時預覽](assets/watermark-settings-preview.png)

## 你會愛上它的理由

- **零步驟上傳** — 貼上或拖入圖片，它已經在你的 bucket 裡了。不用選單，不用對話框。
- **你的浮水印，你的品牌** — 自動在每張圖片疊加文字或 Logo。字體、大小、顏色、透明度、位置全部自訂，設定頁即時預覽，所見即所得。
- **更小的檔案，更快的頁面** — 自動 WebP 轉換與壓縮，讓儲存空間更精省，網頁載入更快速。
- **支援任何 S3 相容儲存** — Cloudflare R2、AWS S3、MinIO、Backblaze B2 等，自帶 bucket 即可使用。
- **私密筆記不外洩** — 用 glob 規則排除特定資料夾，讓它們永遠不被上傳。
- **不只是圖片** — 可選擇性地以同樣方式上傳影片、音訊與 PDF。

## 安裝方式

1. 下載最新發布檔案：`main.js`、`manifest.json`、`styles.css`。
2. 複製到 `<vault>/.obsidian/plugins/watermark-bucket-uploader/`。
3. 在 **設定 → 社群外掛** 中啟用此外掛。

## 設定

如需逐步設定 Cloudflare R2 與浮水印的詳細教學，請參閱 [Cloudflare R2 與浮水印設定指南](docs/how-to-setup-r2-and-watermarks.zh-TW.md)。

前往 **設定 → Watermark Bucket Uploader** 填入你的 bucket 憑證。

### 儲存設定

| 欄位 | 說明 |
|---|---|
| Access Key | S3 / R2 存取金鑰 ID |
| Secret Key | S3 / R2 私密金鑰（安全儲存於本地） |
| Region | 儲存桶區域（Cloudflare R2 填 `auto`） |
| S3 Bucket | 儲存桶名稱 |
| Bucket Folder | 可選路徑前綴，支援 `${year}`、`${month}`、`${day}`、`${basename}` |
| Custom Endpoint | R2 及非 AWS 服務必填 |
| Custom Image URL | 公開存取的 URL 基底，例如 CDN 或自訂網域 |

#### Cloudflare R2 快速設定

1. 在 R2 儀表板建立一個儲存桶。
2. 產生具有 **Object Read & Write** 權限的 API Token。
3. 將 **Custom Endpoint** 設定為 `https://<account-id>.r2.cloudflarestorage.com`。
4. 將 **Region** 設定為 `auto`。
5. 將 **Custom Image URL** 設定為你的公開儲存桶網域。

### 浮水印設定

在設定頁面的**即時預覽**中即時查看調整效果。

| 欄位 | 說明 |
|---|---|
| **文字浮水印** | 開關文字疊加 |
| 文字 | 例如 `© yourdomain.com` |
| 字體 / 大小 / 樣式 / 顏色 | 完整排版控制；大小填 `0` 可自動縮放（圖片寬度的 2%） |
| **Logo 浮水印** | 開關圖片疊加 |
| Logo 路徑 | Vault 相對路徑，例如 `_assets/logo.png` |
| Logo 大小 / 透明度 | 縮放比例（佔圖片寬度百分比）與透明度（0–1） |
| 位置 | 右下、左下、置中下方或置中 |
| X/Y 偏移 | 微調位置（±% 圖片尺寸） |
| 預覽解析度 | 預覽畫布解析度（720p–4K） |

## 使用方式

| 操作 | 結果 |
|---|---|
| 在任意筆記中按 `Ctrl/Cmd+V` | 攔截圖片、處理、上傳，並插入 `![](url)` |
| 拖放圖片到編輯器 | 同樣流程（需在設定中啟用「拖放上傳」） |
| 命令面板 → `Upload image` | 手動選取本地檔案上傳 |
| 建立時自動上傳 | 任何新增至 Vault 的圖片將自動上傳並從本地刪除 |

## 授權條款

MIT
