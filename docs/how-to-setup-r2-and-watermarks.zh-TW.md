# 如何設定 Cloudflare R2 與自訂浮水印

本指南提供逐步說明，協助你設定 **Watermark Bucket Uploader** 外掛程式以搭配 **Cloudflare R2** 儲存空間，並在已上傳的圖片上設定自訂 Logo 或文字浮水印。

## 前提條件

開始之前，請確保你已準備好：
1. 已安裝並更新的 **Obsidian**。
2. 已在你的 Vault 中安裝並啟用 **Watermark Bucket Uploader** 外掛程式（基本安裝請參閱 [README](../README.md)）。
3. 已設定付款資訊的 **Cloudflare** 帳號（Cloudflare R2 提供每月 10 GB 的免費額度）。

---

## 步驟 1：建立 Cloudflare R2 儲存桶 (Bucket)

1. 登入你的 [Cloudflare 儀表板](https://dash.cloudflare.com/)。
2. 在左側選單中，點擊 **R2**（或 **Object Storage**）。
3. 點擊 **Create bucket**（建立儲存桶）。
4. 輸入唯一的 **Bucket name**（例如 `my-obsidian-photos`）。
5. 點擊 **Create bucket** 完成建立。

---

## 步驟 2：啟用儲存桶的公開存取 (Public Access)

若要在 Obsidian 筆記中顯示已上傳的圖片，該儲存桶必須是公開可存取的。

1. 在儲存桶詳細資料頁面中，選擇 **Settings**（設定）標籤頁。
2. 在 **Public Access**（公開存取）下，選擇以下任一方式：
   - **Custom Domains**（自訂網域）：點擊 **Connect Domain**，連線你擁有的子網域（例如 `images.yourdomain.com`）。*推薦此方式以取得乾淨的網址。*
   - **R2.dev Subdomain**：點擊 **Allow**，啟用免費自動產生的 `pub-<id>.r2.dev` 網域。
3. 複製網域 URL（例如 `https://pub-example.r2.dev` 或 `https://images.yourdomain.com`）。你稍後需要將此作為 **Custom Image URL**（自訂圖片網址）。

---

## 步驟 3：產生 R2 API 憑證 (API Credentials)

外掛程式需要 API 憑證才能將圖片寫入你的 R2 儲存桶。

1. 返回 Cloudflare 儀表板中的 **R2** 主頁。
2. 點擊右側的 **Manage R2 API Tokens**（管理 R2 API 權限）。
3. 點擊 **Create API token**（建立 API Token）。
4. 設定 Token 名稱（例如 `Obsidian Uploader Token`）。
5. 在 **Permissions**（權限）下，選擇 **Object Read & Write**（物件讀取與寫入）。
6. 在 **Bucket scoping**（儲存桶範圍）下，選擇 **Apply to specific buckets only**（僅套用至特定儲存桶），並選擇你在步驟 1 中建立的儲存桶。
7. 點擊 **Create API Token**。
8. 請立即複製下列憑證（這些資訊不會再次顯示）：
   - **Access Key ID**（對應外掛設定的 **Access Key**）
   - **Secret Access Key**（對應外掛設定的 **Secret Key**）
   - **Endpoint**（提示：從此 Endpoint 中擷取 Account ID，或使用結構：`https://<account-id>.r2.cloudflarestorage.com`）

---

## 步驟 4：在 Obsidian 中設定儲存空間

1. 開啟 Obsidian，前往 **設定** $\rightarrow$ **Watermark Bucket Uploader**。
2. 填寫 **Storage**（儲存設定）欄位：

| 欄位 | 數值 / 設定方式 |
| :--- | :--- |
| **Access Key** | 貼上步驟 3 取得的 **Access Key ID**。 |
| **Secret Key** | 貼上步驟 3 取得的 **Secret Access Key**。 |
| **Region** | 輸入 `auto`（Cloudflare R2 必須填此值）。 |
| **S3 Bucket** | 輸入你的儲存桶名稱（例如 `my-obsidian-photos`）。 |
| **Bucket Folder** | *(選填)* 例如 `vault-images/${year}/${month}`，用來將檔案分類。 |
| **Custom Endpoint** | 輸入 `https://<account-id>.r2.cloudflarestorage.com`（請將 `<account-id>` 替換為你的 Cloudflare 帳號 ID）。 |
| **Custom Image URL** | 輸入你在步驟 2 取得的公開網域網址（例如 `https://images.yourdomain.com`）。 |

---

## 步驟 5：設定自訂浮水印

若要在上傳圖片時自動套用浮水印：

1. 在外掛程式設定中，向下滾動到 **Watermark**（浮水印）區段。
2. 找到 **Live Preview**（即時預覽）畫布。此處會即時顯示你的調整效果。
3. 設定你的浮水印：
   - **Text Watermark**（文字浮水印）：啟用此開關以疊加文字（例如 `© ${year} YourName`）。自訂字體大小、顏色、透明度和位置。若大小設定為 `0`，則字體大小會自動縮放為圖片寬度的 2%。
   - **Logo Watermark**（Logo 浮水印）：啟用此開關以疊加 Logo 圖片。輸入相對於 Vault 的 Logo 檔案路徑（例如 `_assets/logo.png`）。調整大小（佔圖片寬度的百分比）與透明度。
4. 設定 **Position**（位置，例如 `Bottom Right`），並使用 **Offset X/Y** 微調浮水印與邊緣的距離。

---

## 步驟 6：驗證設定

1. 在 Obsidian 中開啟一個測試筆記。
2. 截圖或複製任何圖片至剪貼簿。
3. 將圖片貼入筆記中（`Ctrl/Cmd+V`）。
4. 你應該會看到：
   - 短暫出現載入中指示器或預留位置。
   - 圖片自動轉換成 WebP、壓縮、套用浮水印，並完成上傳。
   - 筆記中的連結動態替換為 `![](https://your-public-url.com/image.webp)`。
5. 前往你的 Cloudflare R2 儲存桶儀表板，確認檔案已成功上傳。

---

## 常見問題排解

### 1. 錯誤：`SignatureDoesNotMatch` 或 `InvalidAccessKeyId`
* **原因**：你的 Access Key 或 Secret Key 輸入錯誤。
* **解決方法**：從 Cloudflare API Token 頁面重新複製金鑰。如果忘記金鑰，請刪除該 Token 並重新建立一個。

### 2. 圖片無法在 Obsidian 中顯示（圖片連結失效）
* **原因**：**Custom Image URL** 設定不正確，或者儲存桶的公開存取（Public Access）未啟用。
* **解決方法**：
  * 驗證你是否能在網頁瀏覽器中直接存取該圖片網址。
  * 確保在該 R2 儲存桶的 **Settings** $\rightarrow$ **Public Access** 區段中，已正確啟用該網域。

### 3. Logo 浮水印沒有顯示
* **原因**：**Logo Path** 路徑無效或檔案無法讀取。
* **解決方法**：確保路徑是相對於 Vault 根目錄（例如 `_assets/logo.png`，而不是 `/vault/_assets/logo.png` 或外部 URL）。
