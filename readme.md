<p align="center">
  <h1 align="center">NoHoldr</h1>
  <p align="center"><strong>Browser-based tools for PDFs, images, media, files, and data.</strong></p>
  <p align="center">Local file processing, with optional Gemini tools.</p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/GlyphiezKay"><img src="https://img.shields.io/badge/Made%20by-GlyphiezKay-purple.svg" alt="Made by GlyphiezKay" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
  <a href="https://github.com/GlyphiezKay/NoHoldr/actions/workflows/ci.yml"><img src="https://github.com/GlyphiezKay/NoHoldr/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
</p>

---

## Why NoHoldr?

Most online file tools upload your files to a server. NoHoldr's file-processing tools run **locally in your browser** using Canvas API, Web Audio API, PDF.js, and other browser-native technologies. Optional AI tools send the content you submit directly to Google Gemini using your own API key.

---

## Tools

### 📄 PDF workspace · 36 tools

Open `/pdf` for page organization, target-size compression, OCR in English and Indonesian, repair, image and Office conversion, crop, annotations, AcroForms, password protection, redaction, visual comparison, and PDF workflows.

- **Target size:** the compressor tests multiple quality levels and selects the nearest result it finds without exceeding the chosen size, when possible. Raster compression removes selectable text and interactive elements.
- **Office input:** Word, Excel, PowerPoint, and local HTML use a browser-only LibreOffice engine. It requires desktop Chromium with WebAssembly JSPI and loads its runtime from the NoHoldr site on first use. The first development or build command prepares the pinned, checksum-verified assets. Documents stay in the browser.
- **Office output:** DOCX contains editable text, PPTX contains one image per page, and XLSX uses the position of selectable text to infer columns. Review the output for complex layouts.
- **Text and archive tools:** OCR and extractive summaries run locally. Translation uses the browser’s on-device Translator API when available. PDF/A-2b export flattens pages, and archival copies should be checked with a PDF/A validator.

### 🖼️ Image workspace · 17 tools

Open `/image` to find batch compression with a target size, resize, upscale, crop, rotate, format conversion, photo editing, watermarks, memes, animated GIFs, color extraction, images-to-PDF, area masking, color background removal, and metadata tools.

**Converter formats:** JPEG, PNG, WebP, BMP, GIF stills, raster-backed SVG, ICO, and AVIF. The separate GIF maker combines multiple stills into an animation. Background removal matches a chosen color, and upscaling uses browser resampling. HTML to Image accepts local markup with inline styles and embedded image data.

### 🎵 Media — 6 tools

| Audio | Video |
|-------|-------|
| Convert Audio | Convert Video |
| Trim Audio | Compress Video |
| Extract Audio | Trim Video |

**Audio output:** WAV (8/16/24/32-bit), OGG (Opus), WebM Audio — with sample rate, channel, and normalization controls.
**Video output:** WebM (VP8/VP9) with bitrate, resolution, and FPS controls. Frame extraction to JPEG/PNG.

### 🔄 Smart Convert — auto-detect & convert

Drop any file and NoHoldr detects its type, then shows available conversions:

| Input | Available Outputs |
|-------|-------------------|
| Image | JPEG, PNG, WebP, PDF |
| PDF | JPEG, PNG, WebP |
| Document | DOCX to PDF |
| Audio | WAV |
| Video | WebM (VP8/VP9), Frame JPEG, Frame PNG |
| Data | JSON ↔ CSV |

**Dedicated sub-converters** with advanced controls:
- `/convert/image` — 8 output formats, quality, resize, ICO sizes, batch ZIP
- `/convert/audio` — WAV, browser-supported Ogg or WebM, sample rate, bit depth, channels, normalization
- `/convert/video` — Bitrate, resolution, FPS, frame extraction with time slider
- `/convert/document` — TXT, HTML, Markdown, CSV ↔ JSON, JSON → XML

### 📁 Files — 5 tools

| Tool | Description |
|------|-------------|
| Create ZIP | Bundle files into a ZIP archive |
| Extract ZIP | Unpack ZIP archives |
| Batch Rename | Rename files with patterns |
| Find Duplicates | Detect duplicate files by hash |
| File Hash | Generate file checksums |

### 📊 Data — 16 tools

| Tool | Tool | Tool |
|------|------|------|
| JSON Formatter | CSV Viewer | Text Hash |
| Base64 Encode/Decode | URL Encode/Decode | Text Diff |
| QR Code Generator | Color Picker | Password Generator |
| Lorem Ipsum | Markdown Preview | Timestamp Converter |
| Regex Tester | Word Counter | Unit Converter |
| Color Extractor | | |

### ✨ AI — 4 tools (opt-in)

| Tool | Description |
|------|-------------|
| Chat | Conversational AI assistant |
| Summarize | Condense long text |
| Describe Image | AI image analysis |
| Generate Metadata | Titles, descriptions, keywords |

> AI tools use **your own Gemini API key**. Requests go directly from your browser to Google — NoHoldr never sees your content.

---

## Privacy

| | |
|---|---|
| 🔒 **In-Browser** | PDF, image, media, file, and data tools process your inputs locally |
| 🚫 **No Upload** | File tools do not upload your inputs. Optional Gemini tools send content you submit directly to Google |
| 🗑️ **Local Storage** | Your optional Gemini API key is stored in this browser |
| 👤 **No Tracking** | No accounts, no analytics, no cookies |

---

## Getting Started

Use Node.js 24 and [pnpm 12.23.0](https://pnpm.io/installation), the version pinned in `package.json`.

```bash
git clone https://github.com/GlyphiezKay/NoHoldr.git
cd NoHoldr
pnpm install --frozen-lockfile
pnpm dev
```

The first run prepares the browser engines, including checksum-verified LibreOffice WASM assets. Open [NoHoldr on localhost](http://localhost:3000).

Run the same verification as GitHub Actions:

```bash
pnpm check
```

To serve a production build locally, run `pnpm build` followed by `pnpm start`.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (Turbopack) |
| **Package manager** | pnpm 12 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Components** | shadcn/ui + Radix UI |
| **PDF** | pdf-lib, PDF.js, qpdf WASM, Tesseract.js, LibreOffice WASM |
| **Image** | Canvas API, jSquash AVIF, gifenc, exifr |
| **Audio/Video** | Web Audio API, MediaRecorder, OfflineAudioContext |
| **Data** | Web Crypto API (hashing), JSZip |
| **AI** | Google Gemini (opt-in, BYOK) |

---

## Project Structure

```
src/
├── app/
│   ├── pdf/           # PDF workspace and tools
│   ├── image/         # Image workspace and tools
│   ├── media/         # 6 audio & video tools
│   ├── convert/       # Smart Convert + 4 sub-converters
│   ├── files/         # 5 file utilities
│   ├── data/          # 16 data & developer tools
│   └── ai/            # 4 AI tools (Gemini)
├── components/ui/     # shadcn/ui components
└── lib/               # Shared utilities
```

---

## License

Licensed under the **MIT License**.

Effective November 25, 2026, the NoHoldr Attribution License (NAL) is retired and no longer applies to this project. It has been replaced by the MIT License; the additional NAL requirements no longer apply.

See [LICENSE](LICENSE) for full terms and [NOTICE](NOTICE) for third-party attributions.

---

<p align="center"><strong>NoHoldr</strong> by <a href="https://github.com/GlyphiezKay">GlyphiezKay</a></p>
