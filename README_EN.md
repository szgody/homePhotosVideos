<p align="left">
  <a href="README.md">中文</a> | English
</p>

# Family Photo and Video Management System

## Live Demo
[Experience Online](http://110.40.168.84:8081/)

## Table of Contents

- [Family Photo and Video Management System](#family-photo-and-video-management-system)
  - [Live Demo](#live-demo)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Technology Stack](#technology-stack)
  - [Project Structure](#project-structure)
  - [Key Components](#key-components)
  - [Main Views](#main-views)
  - [Installation Guide](#installation-guide)
    - [Prerequisites](#prerequisites)
  - [Installation Steps](#installation-steps)
  - [Running the Application](#running-the-application)
    - [Backend (in separate terminal)](#backend-in-separate-terminal)
  - [Testing](#testing)
  - [Deployment](#deployment)
  - [Environment Configuration](#environment-configuration)
    - [Performance tuning (derived from local hardware)](#performance-tuning-derived-from-local-hardware)
  - [API Reference](#api-reference)
  - [Security](#security)
  - [FAQ](#faq)
  - [Screenshots](#screenshots)
  - [License](#license)

## Features

- **📤 Upload with security screening**: Upload photos and videos directly from the processing page. The backend enforces an extension allow-list plus content sniffing (a real Sharp decode for images, an ffprobe video-stream check for videos), so only genuine media is renamed into the pending directory — a script renamed to `.jpg` is rejected outright
- **🔄 Automated processing with hardware-aware concurrency**: Batch copy/compress/transcode with thumbnail and unique sequence-number generation. Image concurrency and video encoder threads are derived from the local CPU and can be overridden with environment variables
- **⏱️ Job control**: Live progress monitoring and one-click abort through an in-page confirmation dialog (image jobs stop immediately, video jobs finish the current transcode first)
- **🖼️ Viewing experience**: A shared photo lightbox and video player component with `←`/`→` navigation, `Space` play/pause and `Esc` to close, plus frosted-glass overlay and entry animations
- **📱 Responsive UI**: Desktop and mobile layouts with safe-area support and ≥44px touch targets
- **📊 Runtime insight**: `GET /api/health` reports memory usage and the effective concurrency/thread settings

## Technology Stack

| Layer | Technology |
| --- | --- |
| 🖥️ Frontend | Vue 3.5 + Vite 8 + Vue Router 5 (ES Modules) |
| ⚙️ Backend | Node.js 22 + Express 5 (CommonJS, layered as `config/utils/services/routes`) |
| 🎞️ Media processing | Sharp 0.35 (images), fluent-ffmpeg + ffmpeg/ffprobe (videos) |
| 📤 Uploads | multer 2 (staged in the system temp directory, renamed into place after screening) |
| 🧪 Testing | Built-in `node:test` (no extra dependency, 45 tests) |
| 🔧 Deployment | PM2 + Nginx + Docker Compose |

## Project Structure

```plaintext
├── 📱 src/
│   ├── api/            # Unified API client (client.js)
│   ├── components/     # Reusable components (incl. media/PhotoLightbox.vue, media/VideoPlayerModal.vue)
│   ├── composables/    # Processing state logic (useProcessing.js)
│   ├── router/         # Routes (/, /photo, /video, /admin/processing)
│   ├── styles/         # Layered styles (components/ layouts/ views/)
│   └── views/          # Pages (HomeView, PhotoView, VideoView, ProcessingView)
├── ⚙️ backend/
│   ├── server.js       # Service entry (thin wrapper)
│   ├── src/            # config, utils (sn/validate/sniff/concurrency), services, routes (incl. upload.js)
│   └── test/           # node:test suite (45 tests)
├── 📁 data/            # Processed media, thumbnails and sequence files (runtime, not committed)
├── 🖼️ public/original/ # Original media directory (pending)
├── 🧪 scripts/         # check-structure.js, check-ffmpeg.js
├── 🐳 docker-compose.yml
└── 📄 nginx.conf.template
```

## Key Components

- **AppHeader**: Navigation bar component
- **PhotoGrid / VideoGrid**: Grid previews rendered on the homepage
- **PhotoLightbox / VideoPlayerModal** (`components/media/`): Shared lightbox and player modals reused by the homepage, photo view and video view
- **useProcessing** (`composables/`): Shared processing/progress state logic

## Main Views

- **HomeView**: Homepage showing latest photos/videos
- **PhotoView**: Full photo gallery view
- **VideoView**: Full video library view
- **ProcessingView**: Background processing interface for raw files

## Installation Guide

### Prerequisites

- Node.js 22.x or higher
- FFmpeg installed system-wide (for video processing)

## Installation Steps

1. Clone repository

   ```bash
   git clone https://github.com/szgody/homePhotosVideos.git
   cd homePhotosVideos
   ```

1. Install frontend dependencies

   ```bash
   npm install
   ```

1. Install backend dependencies

   ```bash
   cd backend
   npm install
   cd ..
   ```

1. Create required directories

   ```bash
   mkdir -p data/photos data/videos data/photo_thumbnails data/video_thumbnails
   mkdir -p public/original/images public/original/videos
   ```

1. Verify FFmpeg installation

   ```bash
   node scripts/check-ffmpeg.js
   ```

## Running the Application

1. Start development servers

   **Frontend**

   ```bash
   npm run dev
   ```

### Backend (in separate terminal)

```bash
cd backend && node server.js
```

1. Access via browser: <http://localhost:5173>

## Testing

```bash
cd backend && npm test   # Backend unit/API tests (45 tests)
cd .. && npm run check   # Structure check + ffmpeg availability check
```

## Deployment

**Deploy with PM2:**

1. Build frontend

   ```bash
   npm run build
   ```

1. Start services

   ```bash
   pm2 start ecosystem.config.js
   ```

## Environment Configuration

**Frontend (`.env`)**

```dotenv
VITE_API_URL=/api
```

**Backend (`backend/.env`)**

```dotenv
PORT=3000
DATA_DIR=data
PUBLIC_DIR=public
BASE_URL=
PHOTOS_PATH=/photos
PHOTO_THUMBNAILS_PATH=/photo_thumbnails
VIDEOS_PATH=/videos
VIDEO_THUMBNAILS_PATH=/video_thumbnails
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional: explicit ffmpeg/ffprobe paths (defaults to the system PATH)
# FFMPEG_PATH=/usr/bin/ffmpeg
# FFPROBE_PATH=/usr/bin/ffprobe

# Performance tuning (optional; derived from local hardware by default)
# IMAGE_CONCURRENCY=8
# VIDEO_THREADS=8
# VIDEO_PRESET=medium
```

> ⚠️ In production, set `ALLOWED_ORIGINS` to your real domain/IP (e.g. `http://your-server-ip:8080`); otherwise browser requests are rejected by the CORS allow-list.

### Performance tuning (derived from local hardware)

| Variable | Default | Description |
| --- | --- | --- |
| `IMAGE_CONCURRENCY` | `min(logical cores / 2, 8)` | Image batch concurrency (1–32). A single Sharp operation is already multi-threaded, so oversubscribing hurts CPU/memory |
| `VIDEO_THREADS` | `min(logical cores / 2, 12)` | x264 encoder threads (1–32); videos are transcoded serially so jobs never fight over I/O |
| `VIDEO_PRESET` | `medium` | x264 preset — slower means smaller files (unchanged from previous behaviour) |

> 💡 Inspect the effective values with `curl http://localhost:3000/api/health` (returns a `performance` block). On memory-constrained machines lower `IMAGE_CONCURRENCY` (e.g. 4) — throughput barely drops.

## API Reference

All endpoints are prefixed with `/api`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check (version, memory, effective concurrency settings) |
| GET | `/photos` / `/videos` | Processed media list (includes static asset URLs) |
| GET | `/list-images` / `/list-videos` | Pending original files |
| POST | `/upload` | Upload photos/videos (extension allow-list + content sniffing before storage) |
| POST | `/process-images-batch` | Image batch processing (bounded concurrency, keeps originals + 240×240 thumbnails) |
| POST | `/process-images` | Image batch processing, compress profile (800×600 + 100×100 thumbnails, originals deleted) |
| POST | `/process-single-image` | Single image (legacy-compatible: copy original + 240×240 thumbnail) |
| POST | `/process-single-video` | Single video transcode + thumbnail (serial, rejects concurrent duplicates) |
| GET | `/video-progress` | Progress query (reads in-memory state only, no heavy work) |
| POST | `/cancel-processing` | Abort processing (photos and videos) |
| GET/POST | `/read-sn` / `/write-sn` | Photo sequence read/write (batch jobs allocate numbers server-side) |
| GET/POST | `/read-video-sn` / `/write-video-sn` | Video sequence read/write |
| POST | `/delete-all-original-images` / `/delete-all-original-videos` | Delete original files |

## Security

- Every filename-accepting endpoint validates input first (`backend/src/utils/validate.js`) and builds paths with `path.join()` to prevent path traversal
- Uploads are staged in the system temp directory and only renamed into the pending directory after passing the extension allow-list and content sniffing; user-supplied filenames are never used as on-disk names and temp files are always removed
- The CORS allow-list (`ALLOWED_ORIGINS`) is enforced — non-allow-listed origins receive `403`
- Secrets are injected only through `backend/.env`, which is never committed; see [SECURITY.md](SECURITY.md) for the full mandatory rules

## FAQ

- **Upload rejected**: usually because the extension is not allow-listed, the content does not match the extension (e.g. a script renamed to an image), the size limit was exceeded (50MB for images, 3GB per video), or the video contains no video stream — the page lists the exact reason per file
- **Processing is slow or memory-hungry**: tune `IMAGE_CONCURRENCY` (defaults to half the logical cores, capped at 8). Videos are transcoded one at a time because a single large file already saturates CPU and disk I/O
- **How do I abort a job?**: the processing page shows an in-page confirmation dialog; images stop immediately, videos take effect once the current transcode finishes
- **Photos render but thumbnails 404**: the file was likely left behind by an aborted job — process it again

## Screenshots

Index
![Image](https://github.com/user-attachments/assets/b4f315ab-ac8f-41f7-9d41-8cc1fdf802b6)

Photos
![Image](https://github.com/user-attachments/assets/f5b97c09-b20b-4088-ae0f-469067e7d3f7)

Videos
![Image](https://github.com/user-attachments/assets/ef5f9263-f24d-48e9-a23e-7c28cb28be7e)

Processing
![Image](https://github.com/user-attachments/assets/d8bf91d2-16fe-4559-91f8-13aaa28dfc61)

Processing Photos
![Image](https://github.com/user-attachments/assets/5a2e5893-187c-414e-a1ab-1ec2c0b69746)

Processing Videos
![Image](https://github.com/user-attachments/assets/47c67020-6710-41bb-bb21-1525ca02682a)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
