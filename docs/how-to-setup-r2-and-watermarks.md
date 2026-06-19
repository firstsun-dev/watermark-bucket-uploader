# How to Set Up Cloudflare R2 and Custom Watermarks

This guide provides step-by-step instructions to configure the **Watermark Bucket Uploader** plugin with **Cloudflare R2** storage and set up custom logo or text watermarks on your uploaded images.

## Prerequisites

Before starting, ensure you have:
1. **Obsidian** installed and updated.
2. The **Watermark Bucket Uploader** plugin installed and enabled in your vault (see the [README](../README.md) for basic installation).
3. A **Cloudflare** account with billing set up (Cloudflare R2 offers a generous free tier of 10 GB/month).

---

## Step 1: Create a Cloudflare R2 Bucket

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, click **R2** (or **Object Storage**).
3. Click **Create bucket**.
4. Enter a unique **Bucket name** (e.g., `my-obsidian-photos`).
5. Click **Create bucket** to finish.

---

## Step 2: Enable Public Access for Your Bucket

To display your uploaded images in Obsidian notes, the bucket must be publicly accessible.

1. In your bucket's details page, select the **Settings** tab.
2. Under **Public Access**, choose one of the following:
   - **Custom Domains**: Click **Connect Domain** to connect a subdomain you own (e.g., `images.yourdomain.com`). *Recommended for clean URLs.*
   - **R2.dev Subdomain**: Click **Allow** to enable the free auto-generated `pub-<id>.r2.dev` domain.
3. Copy the domain URL (e.g., `https://pub-example.r2.dev` or `https://images.yourdomain.com`). You will need this as your **Custom Image URL**.

---

## Step 3: Generate R2 API Credentials

The plugin needs API credentials to write images to your R2 bucket.

1. Navigate back to the main **R2** page in your Cloudflare Dashboard.
2. Click **Manage R2 API Tokens** on the right side.
3. Click **Create API token**.
4. Set the token name (e.g., `Obsidian Uploader Token`).
5. Under **Permissions**, select **Object Read & Write**.
6. Under **Bucket scoping**, select **Apply to specific buckets only** and select the bucket you created in Step 1.
7. Click **Create API Token**.
8. Copy the following credentials immediately (they will not be shown again):
   - **Access Key ID** (used as **Access Key**)
   - **Secret Access Key** (used as **Secret Key**)
   - **Endpoint** (Note: Extract the Account ID from this endpoint, or use the structure: `https://<account-id>.r2.cloudflarestorage.com`)

---

## Step 4: Configure Storage Settings in Obsidian

1. Open Obsidian and go to **Settings** $\rightarrow$ **Watermark Bucket Uploader**.
2. Fill in the **Storage** configuration fields:

| Field | Value / Configuration |
| :--- | :--- |
| **Access Key** | Paste the **Access Key ID** from Step 3. |
| **Secret Key** | Paste the **Secret Access Key** from Step 3. |
| **Region** | Enter `auto` (required for Cloudflare R2). |
| **S3 Bucket** | Enter the name of your bucket (e.g., `my-obsidian-photos`). |
| **Bucket Folder** | *(Optional)* e.g., `vault-images/${year}/${month}` to organize files. |
| **Custom Endpoint** | Enter `https://<account-id>.r2.cloudflarestorage.com` (replace `<account-id>` with your Cloudflare Account ID). |
| **Custom Image URL** | Enter your public domain URL from Step 2 (e.g., `https://images.yourdomain.com`). |

---

## Step 5: Configure Custom Watermarks

To automatically overlay watermarks on uploaded images:

1. In the plugin settings, scroll down to the **Watermark** section.
2. Locate the **Live Preview** canvas. This displays changes in real-time.
3. Configure your watermarks:
   - **Text Watermark**: Toggle this on to overlay text (e.g., `© ${year} YourName`). Customize the font size, color, opacity, and position. Set size to `0` to automatically scale font size to 2% of the image width.
   - **Logo Watermark**: Toggle this on to overlay an image. Specify a vault-relative path to your logo file (e.g., `_assets/logo.png`). Adjust size (percentage of image width) and opacity.
4. Set the **Position** (e.g., `Bottom Right`) and use **Offset X/Y** to fine-tune its placement away from the edges.

---

## Step 6: Verify the Setup

1. Open a test note in Obsidian.
2. Take a screenshot or copy any image to your clipboard.
3. Paste the image into the note (`Ctrl/Cmd+V`).
4. You should see:
   - A placeholder text or loading indicator appear briefly.
   - The image automatically converted to WebP, compressed, watermarked, and uploaded.
   - The link dynamically replaced with `![](https://your-public-url.com/image.webp)`.
5. Check your Cloudflare R2 bucket dashboard to confirm the file is uploaded.

---

## Troubleshooting Common Issues

### 1. Error: `SignatureDoesNotMatch` or `InvalidAccessKeyId`
* **Cause**: Your Access Key or Secret Key is incorrect.
* **Solution**: Re-copy the keys from the Cloudflare API tokens page. If you lost them, delete the token and create a new one.

### 2. Images are not rendering in Obsidian (broken image link)
* **Cause**: The **Custom Image URL** is incorrect, or the bucket's public access is disabled.
* **Solution**: 
  * Verify that you can access the image URL directly in your web browser.
  * Ensure the domain is properly authorized under the **Settings** $\rightarrow$ **Public Access** section of your R2 bucket.

### 3. Logo watermark does not display
* **Cause**: The **Logo Path** is invalid or the file cannot be read.
* **Solution**: Verify the path is relative to the vault root (e.g. `_assets/logo.png`, not `/vault/_assets/logo.png` or an external URL).
