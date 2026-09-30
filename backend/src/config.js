// 集中配置:路径、端口、环境变量 Centralized config: paths, port, env
require("dotenv").config();
const os = require("os");
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

// ===== 性能相关:按本机硬件推导默认值,均可用环境变量覆盖 =====
// Performance tuning: defaults derived from local hardware, overridable via env

// 逻辑核心数(Sharp/libvips 与 x264 的并行度都以它为基准)
const LOGICAL_CORES = os.cpus().length || 4;

// 读取正整数环境变量,非法值回退默认,并限制上界
function toPositiveInt(raw, fallback, max) {
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.min(value, max);
}

// 图片并发上限(硬上限,防止误设置拖垮机器)
const MAX_IMAGE_CONCURRENCY = 32;

// 图片并发默认值:libvips 对单张图内部已多线程,再叠 N 张并发会超订 CPU/内存,
// 因此取「逻辑核心数的一半」且不超过 8(本机 16 逻辑核 → 8)
const DEFAULT_IMAGE_CONCURRENCY = Math.max(1, Math.min(Math.floor(LOGICAL_CORES / 2), 8));
const IMAGE_CONCURRENCY = toPositiveInt(
  process.env.IMAGE_CONCURRENCY,
  DEFAULT_IMAGE_CONCURRENCY,
  MAX_IMAGE_CONCURRENCY,
);

// 视频编码线程数:x264 帧级并行收益在 8~12 线程后递减,取逻辑核心一半(本机 16 → 8),
// 既能吃满小文件转码,又能避免单进程线程过多导致内存线性上涨
const DEFAULT_VIDEO_THREADS = Math.max(1, Math.min(Math.floor(LOGICAL_CORES / 2), 12));
const VIDEO_THREADS = toPositiveInt(process.env.VIDEO_THREADS, DEFAULT_VIDEO_THREADS, 32);

// 视频编码 preset:默认 medium(与历史行为一致,避免质量/体积回归)
const VIDEO_PRESET = process.env.VIDEO_PRESET || "medium";

module.exports = {
  PATHS,
  URL_PATHS,
  PORT,
  BASE_URL,
  ALLOWED_ORIGINS,
  FFMPEG_PATH,
  FFPROBE_PATH,
  LOGICAL_CORES,
  IMAGE_CONCURRENCY,
  MAX_IMAGE_CONCURRENCY,
  VIDEO_THREADS,
  VIDEO_PRESET,
};

