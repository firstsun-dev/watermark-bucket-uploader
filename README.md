# Watermark S3 Uploader

An Obsidian plugin that intercepts image paste/drop events, optionally converts to WebP, applies a canvas-based watermark, uploads to Cloudflare R2 (or any S3-compatible storage), and inserts the resulting URL as a markdown image link.

## Features

- **Auto-upload on paste/drag** — images are uploaded immediately without manual steps
- **WebP conversion** — convert images to WebP before upload for smaller file sizes
- **Image compression** — reduce file size with configurable quality and dimension limits
- **Text watermark** — overlay custom text with configurable font, size, color, bold/italic, position, and offset
- **Logo watermark** — overlay a local image as a watermark with configurable size, opacity, position, and offset
- **Live watermark preview** — see exactly how the watermark will look before uploading
- **Custom endpoint** — works with Cloudflare R2, AWS S3, MinIO, and any S3-compatible service
- **Custom public URL** — serve files via a custom domain or CDN
- **Video / Audio / PDF upload** — optionally upload non-image files too
- **Ignore patterns** — skip files matching a glob pattern

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins**
2. Search for **Watermark S3 Uploader**
3. Click **Install**, then **Enable**

### Manual

1. Download the latest release assets: `main.js`, `manifest.json`, `styles.css`
2. Copy them to `<vault>/.obsidian/plugins/watermark-s3-uploader/`
3. Enable the plugin in **Settings → Community plugins**

## Configuration

Go to **Settings → Watermark S3 Uploader** and fill in:

| Field | Description |
|---|---|
| Access Key | S3 / R2 access key ID |
| Secret Key | S3 / R2 secret access key |
| Region | Bucket region (e.g. `auto` for R2) |
| Bucket | Bucket name |
| Folder | Optional prefix/folder inside the bucket |
| Custom Endpoint | Required for R2 and non-AWS providers |
| Custom Image URL | Public base URL for inserted links (e.g. your CDN domain) |

### Cloudflare R2 Quick Setup

1. Create a bucket in the Cloudflare R2 dashboard
2. Generate an API token with **Object Read & Write** permissions
3. Set **Custom Endpoint** to `https://<account-id>.r2.cloudflarestorage.com`
4. Set **Region** to `auto`
5. Set **Custom Image URL** to your public bucket domain

## Usage

- **Paste** an image (Ctrl/Cmd+V) in any note — the plugin intercepts it, uploads, and inserts `![](url)`
- **Drag and drop** an image onto the editor (enable "Upload on drag" in settings)
- **Command palette** → `Upload clipboard image` to upload manually

## Watermark

Enable text or logo watermark in settings. Use the **live preview** canvas to adjust position, opacity, font, and offset before saving.

## Credits

Based on [jvsteiner/s3-image-uploader](https://github.com/jvsteiner/s3-image-uploader) (MIT License).
Extended with WebP conversion, image compression, and watermark support by [ClaudiaFang](https://github.com/firstsun-dev).

## License

MIT
