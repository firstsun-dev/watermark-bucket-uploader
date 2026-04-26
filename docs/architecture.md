# Architecture

## Module Overview

```mermaid
graph TD
    main["main.ts\nR2UploaderPlugin"] --> settings["settings.ts\nR2UploaderSettings\nR2UploaderSettingTab"]
    main --> uploader["uploader.ts\ncreateS3Client\nuploadFile"]
    main --> pasteHandler["pasteHandler.ts\npasteHandler\nreplaceText"]
    pasteHandler --> imageProcessor["imageProcessor.ts\ncompressImage\nconvertToWebP\napplyWatermark"]
    pasteHandler --> uploader
    imageProcessor --> watermark["watermark.ts\npaintTextWatermark\npaintLogoWatermark\npaintCheckerboard"]
    settings --> watermark
```

## Paste / Drop Event Flow

```mermaid
sequenceDiagram
    participant User
    participant main as main.ts
    participant paste as pasteHandler.ts
    participant img as imageProcessor.ts
    participant wm as watermark.ts
    participant up as uploader.ts
    participant Editor

    User->>main: paste / drop / command
    main->>paste: pasteHandler(ev, editor, ...)
    paste->>paste: extract files from event
    paste->>paste: check shouldIgnore()

    loop each file
        alt is image
            paste->>img: convertToWebP() [if enabled]
            img-->>paste: File (.webp)
            paste->>img: compressImage() [if enabled]
            img-->>paste: File (compressed)
            paste->>img: applyWatermark() [if enabled]
            img->>wm: paintLogoWatermark()
            img->>wm: paintTextWatermark()
            wm-->>img: canvas composited
            img-->>paste: File (watermarked)
        end
        paste->>up: uploadFile(s3, settings, file, key)
        up-->>paste: public URL
        paste->>paste: wrapFileDependingOnType(url, type)
    end

    paste->>Editor: transaction insert markdown
```

## Settings Tab Preview Flow

```mermaid
sequenceDiagram
    participant User
    participant tab as R2UploaderSettingTab
    participant wm as watermark.ts

    User->>tab: change watermark setting
    tab->>tab: save()
    tab->>tab: refreshPreview()
    tab->>wm: paintCheckerboard() / fill bg
    tab->>wm: paintLogoWatermark() [if logo enabled]
    tab->>wm: paintTextWatermark() [if text enabled]
    wm-->>tab: canvas updated
```

## File Responsibilities

| File | Responsibility |
|---|---|
| `main.ts` | Plugin lifecycle (`onload`, `onunload`), command registration, event wiring, `createS3Client` |
| `settings.ts` | `R2UploaderSettings` interface, `DEFAULT_SETTINGS`, `R2UploaderSettingTab` UI, `wrapTextWithPasswordHide` |
| `watermark.ts` | Pure canvas drawing: `buildFont`, `resolvePosition`, `paintTextWatermark`, `paintLogoWatermark`, `paintCheckerboard` |
| `imageProcessor.ts` | Image pipeline: `compressImage`, `convertToWebP`, `applyWatermark` |
| `uploader.ts` | S3 transport: `ObsHttpHandler`, `createS3Client`, `uploadFile`, `generateFileHash`, `wrapFileDependingOnType` |
| `pasteHandler.ts` | Event handling: `pasteHandler`, `replaceText` |
