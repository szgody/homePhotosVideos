// 集中配置:路径、端口、环境变量 Centralized config: paths, port, env
require("dotenv").config();
const path = require("path");

// 项目根目录(backend/src 上两级) Project root (two levels above backend/src)
const ROOT = path.join(__dirname, "..", "..");

const DATA_DIR = process.env.DATA_DIR || "data";
const PUBLIC_DIR = process.env.PUBLIC_DIR || "public";

const PATHS = {
  ROOT,
  DATA_DIR: path.join(ROOT, DATA_DIR),
  PUBLIC_DIR: path.join(ROOT, PUBLIC_DIR),
  ORIGINAL_IMAGES: path.join(ROOT, PUBLIC_DIR, "original", "images"),
  ORIGINAL_VIDEOS: path.join(ROOT, PUBLIC_DIR, "original", "videos"),
  PHOTOS: path.join(ROOT, DATA_DIR, "photos"),
  PHOTO_THUMBNAILS: path.join(ROOT, DATA_DIR, "photo_thumbnails"),
  VIDEOS: path.join(ROOT, DATA_DIR, "videos"),
  VIDEO_THUMBNAILS: path.join(ROOT, DATA_DIR, "video_thumbnails"),
  PHOTO_SN_FILE: path.join(ROOT, DATA_DIR, "photos", "sn.txt"),
  VIDEO_SN_FILE: path.join(ROOT, DATA_DIR, "videos", "sn.txt"),
};

// 静态资源挂载路径(与前端 env 约定一致) Static mount URL paths
const URL_PATHS = {
  photos: process.env.PHOTOS_PATH || "/photos",
  photoThumbnails: process.env.PHOTO_THUMBNAILS_PATH || "/photo_thumbnails",
  videos: process.env.VIDEOS_PATH || "/videos",
  videoThumbnails: process.env.VIDEO_THUMBNAILS_PATH || "/video_thumbnails",
};

const PORT = parseInt(process.env.PORT || "3000", 10);
const BASE_URL = process.env.BASE_URL || "";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://192.168.23.56", "http://localhost:3000"];

// ffmpeg/ffprobe:环境变量优先,否则走系统 PATH(生产已 apt install ffmpeg)
const FFMPEG_PATH = process.env.FFMPEG_PATH || null;
const FFPROBE_PATH = process.env.FFPROBE_PATH || null;

module.exports = { PATHS, URL_PATHS, PORT, BASE_URL, ALLOWED_ORIGINS, FFMPEG_PATH, FFPROBE_PATH };
