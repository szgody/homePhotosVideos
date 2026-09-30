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
  - [Project Structure](#project-structure)
  - [Key Components](#key-components)
  - [Main Views](#main-views)
  - [Installation Guide](#installation-guide)
    - [Prerequisites](#prerequisites)
  - [Installation Steps](#installation-steps)
  - [Running the Application](#running-the-application)
    - [Backend (in separate terminal)](#backend-in-separate-terminal)
  - [Deployment](#deployment)
  - [Environment Configuration](#environment-configuration)
  - [Technology Stack](#technology-stack)
  - [Screenshots](#screenshots)
  - [License](#license)

## Features
- 📷 Photo gallery browsing and management
- 🎬 Video library browsing and playback
- 🖼️ Automated thumbnail generation for photos and videos
- 🔄 Batch processing of photo and video files
- 📱 Responsive design for mobile and desktop devices
- 🔧 Background processing interface with real-time progress display

## Project Structure

```plaintext
├── 📱 src/            # Frontend (api/, composables/, components/, views/, styles/)
├── ⚙️ backend/        # Backend API (server.js entry + src/ layered + test/)
├── 📁 data/           # Media storage (runtime)
├── 🖼️ public/         # Original media & static assets
├── 🐳 docker-compose.yml  # Container orchestration (single)
└── 📄 nginx.conf.template # Nginx template (single)
```

## Key Components
- **AppHeader**: Navigation bar component
- **PhotoGrid**: Photo grid display component
- **VideoGrid**: Video grid display component

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
cd home-photo-vue
```

2. Install frontend dependencies
```bash
npm install
```

3. Install backend dependencies
```bash
cd backend
npm install
cd ..
```

4. Create required directories
```bash
mkdir -p data/photos data/videos data/photo_thumbnails data/video_thumbnails
mkdir -p public/original/images public/original/videos
```

5. Verify FFmpeg installation
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
node backend/server.js
```

2. Access via browser: http://localhost:5173

## Deployment

**Deploy with PM2:**

1. Build frontend
```bash
npm run build
```

2. Start services
```bash
pm2 start ecosystem.config.js
```

## Environment Configuration
Configure via .env.local or .env.production files:

- `VITE_API_URL`: API prefix (default /api; in dev Vite proxies to http://localhost:3000)

## Technology Stack

- Frontend: Vue.js, Vite
- Backend: Node.js, Express
- Media Processing: FFmpeg
- Deployment: PM2

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