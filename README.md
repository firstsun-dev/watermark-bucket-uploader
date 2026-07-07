<div align="center">

# Watermark Bucket Uploader
*Paste an image. It's uploaded, watermarked, and linked — before you lift your finger.*

[![CI](https://img.shields.io/github/actions/workflow/status/firstsun-dev/watermark-bucket-uploader/ci.yml?branch=main&style=for-the-badge)](https://github.com/firstsun-dev/watermark-bucket-uploader/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/firstsun-dev/watermark-bucket-uploader?style=for-the-badge&color=2ea44f)](https://github.com/firstsun-dev/watermark-bucket-uploader/releases)
[![Downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&query=%24%5B%22watermark-bucket-uploader%22%5D.downloads&label=downloads&style=for-the-badge&color=007acc)](https://obsidian.md/plugins?id=watermark-bucket-uploader)
[![License](https://img.shields.io/github/license/firstsun-dev/watermark-bucket-uploader?style=for-the-badge)](LICENSE)

**[Releases](https://github.com/firstsun-dev/watermark-bucket-uploader/releases)** · **[繁體中文](README.zh-TW.md)** · **[Changelog](CHANGELOG.md)**

</div>

Stop wrestling with image hosting. This Obsidian plugin intercepts every paste and drop, stamps your watermark, converts to WebP, uploads to your own S3/R2 bucket, and drops a clean `![](url)` right into your note. Zero friction. Your images, your infrastructure, your brand.

<img src="https://img.shields.io/badge/Cloudflare%20R2-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare R2" height="20"> <img src="https://img.shields.io/badge/AWS%20S3-232F3E?style=flat-square&logo=amazons3&logoColor=white" alt="AWS S3" height="20"> <img src="https://img.shields.io/badge/MinIO-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO" height="20"> <img src="https://img.shields.io/badge/Backblaze%20B2-E21E29?style=flat-square&logo=backblaze&logoColor=white" alt="Backblaze B2" height="20">

<video src="assets/watermark-bucket-uploader-en.webm" width="100%" controls autoplay loop muted playsinline></video>

![Watermark settings live preview](assets/watermark-settings-preview.png)
*The Live Preview shows your text and logo watermark exactly as it will be applied, before you upload a single image.*

## What's inside

- **Zero-step uploads** — paste or drag an image and it's already in your bucket. No menus, no dialogs.
- **Your watermark, your brand** — overlay custom text or your logo on every image automatically. Font, size, color, opacity, position — all yours to configure, with a live preview so what you see is what you get.
- **Smaller files, faster pages** — automatic WebP conversion and compression keep your storage lean and your site fast.
- **Works with any S3-compatible storage** — Cloudflare R2, AWS S3, MinIO, Backblaze B2, and more. Bring your own bucket.
- **Keeps your private notes private** — glob-based ignore patterns let you exclude specific folders from ever being uploaded.
- **Not just images** — optionally upload video, audio, and PDFs the same way.

## Installation

### From Community Plugins (recommended)
1. Open **Settings → Community plugins** and turn off restricted mode.
2. Click **Browse**, search for **Watermark Bucket Uploader**, click **Install**, then **Enable**.

### Manual
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/firstsun-dev/watermark-bucket-uploader/releases/latest).
2. Create `<vault>/.obsidian/plugins/watermark-bucket-uploader/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Quick start

1. Go to **Settings → Watermark Bucket Uploader** and fill in your bucket credentials (see [Storage](#storage)).
2. Configure a text or logo watermark and check the **Live Preview** (see [Watermark](#watermark)).
3. Paste or drag an image into any note — it uploads, gets watermarked, and a `![](url)` link is inserted automatically.

For a step-by-step walkthrough on setting up Cloudflare R2 and configuring watermarks, see the [Cloudflare R2 & Watermarks Setup Guide](docs/how-to-setup-r2-and-watermarks.md).

## Configuration

### Storage

| Field | Description |
|---|---|
| Access Key | S3 / R2 access key ID |
| Secret Key | S3 / R2 secret access key (stored securely in local storage) |
| Region | Bucket region (`auto` for Cloudflare R2) |
| S3 Bucket | Your bucket name |
| Bucket Folder | Optional path prefix — supports `${year}`, `${month}`, `${day}`, `${basename}` |
| Custom Endpoint | Required for R2 and non-AWS providers |
| Custom Image URL | Public URL base, e.g. your CDN or custom domain |

#### Cloudflare R2 quick setup

1. Create a bucket in the R2 dashboard.
2. Generate an API token with **Object Read & Write** permissions.
3. Set **Custom Endpoint** to `https://<account-id>.r2.cloudflarestorage.com`.
4. Set **Region** to `auto`.
5. Set **Custom Image URL** to your public bucket domain.

### Watermark

Open the **Live Preview** in settings to see changes in real time.

| Field | Description |
|---|---|
| **Text Watermark** | Toggle text overlay |
| Text | e.g. `© yourdomain.com` |
| Font / Size / Style / Color | Full typography control; size `0` = auto (2% of image width) |
| **Logo Watermark** | Toggle image overlay |
| Logo Path | Vault-relative path, e.g. `_assets/logo.png` |
| Logo Size / Opacity | Scale (% of image width) and transparency (0–1) |
| Position | Bottom Right, Bottom Left, Bottom Center, or Center |
| Offset X/Y | Fine-tune placement (±% of image dimensions) |
| Preview Res | Canvas resolution for preview accuracy (720p–4K) |

## Daily workflow

| Action | Result |
|---|---|
| `Ctrl/Cmd+V` in any note | Intercepts the image, processes it, uploads, inserts `![](url)` |
| Drag & drop onto the editor | Same pipeline (enable "Upload on drag" in settings) |
| Command Palette → `Upload image` | Pick a local file to upload manually |
| Auto-upload on create | Any image added to your vault is uploaded and removed locally |

## Privacy and security

- **Local storage** — bucket credentials are stored locally in the plugin's data folder inside your vault, and are only ever sent to the storage endpoint you configured.
- **No telemetry** — the plugin collects no usage data or analytics.

## Requirements

- Obsidian **1.6.6** or later
- Desktop and mobile supported

## Development

```bash
git clone https://github.com/firstsun-dev/watermark-bucket-uploader.git
npm install

npm run dev    # watch build
npm run build  # type-check + production build
npm run test   # vitest suite
npm run lint   # eslint
```

## License

MIT

---

**Created by [ClaudiaFang](https://github.com/firstsun-dev)**
