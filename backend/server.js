// 在 server.js 顶部
require("dotenv").config();

// 导入必要的模块 Import required modules
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const photosRoutes = require("./src/routes/photos");
const videosRoutes = require("./src/routes/videos");

// 在 server.js 或其他后端文件中
const dataDir = process.env.DATA_DIR || "data";
const publicDir = process.env.PUBLIC_DIR || "public";

// 使用 path.join 构建路径
const photosPath = path.join(__dirname, "..", dataDir, "photos");

// 创建Express应用 Create Express app
const app = express();

// 端口配置
const port = process.env.PORT || 3000;

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://192.168.23.56", "http://localhost:3000"];

// 使用一个统一的CORS配置
app.use(
  cors({
    origin: function (origin, callback) {
      // 允许没有源的请求或在白名单内的请求
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("CORS拒绝源:", origin);  // 记录被拒绝的源
        callback(null, true);  // 暂时允许所有源，便于调试
        // 如果需要恢复严格的CORS策略，请改回:
        // callback(new Error("不允许的来源"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

// Socket.IO 已移除:前端通过 /api/video-progress 轮询获取进度

// 路径配置
const PATHS = {
  DATA_DIR: path.join(__dirname, "..", process.env.DATA_DIR || "data"),
  PUBLIC_DIR: path.join(__dirname, "..", process.env.PUBLIC_DIR || "public"),

  // 确保这些配置与 .env 文件一致
  ORIGINAL_IMAGES: path.join(
    __dirname,
    "..",
    process.env.PUBLIC_DIR || "public",
    "original",
    "images",
  ),
  ORIGINAL_VIDEOS: path.join(
    __dirname,
    "..",
    process.env.PUBLIC_DIR || "public",
    "original",
    "videos",
  ),

  PHOTOS: path.join(__dirname, "..", process.env.DATA_DIR || "data", "photos"),
  PHOTO_THUMBNAILS: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "photo_thumbnails",
  ),

  VIDEOS: path.join(__dirname, "..", process.env.DATA_DIR || "data", "videos"),
  VIDEO_THUMBNAILS: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "video_thumbnails",
  ),

  // 序列号文件存储路径
  PHOTO_SN_FILE: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "photos",
    "sn.txt",
  ),
  VIDEO_SN_FILE: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "videos",
    "sn.txt",
  ),
};

// 启用中间件 Enable middleware
app.use(cors()); // 启用跨域支持 Enable CORS
app.use(express.json()); // 解析JSON请求体 Parse JSON request body

// 配置静态文件服务 Configure static file serving
app.use(
  process.env.PHOTO_THUMBNAILS_PATH || "/photo_thumbnails",
  express.static(PATHS.PHOTO_THUMBNAILS),
); // 缩略图 Thumbnails
app.use(process.env.PHOTOS_PATH || "/photos", express.static(PATHS.PHOTOS)); // 照片 Photos
app.use(process.env.VIDEOS_PATH || "/videos", express.static(PATHS.VIDEOS)); // 视频 Videos
app.use(
  process.env.VIDEO_THUMBNAILS_PATH || "/video_thumbnails",
  express.static(PATHS.VIDEO_THUMBNAILS),
); // 视频缩略图 Video thumbnails

// 初始化目录和文件 Initialize directories and files
async function initializeDirectories() {
  try {
    await Promise.all([
      fs.ensureDir(PATHS.ORIGINAL_IMAGES),
      fs.ensureDir(PATHS.ORIGINAL_VIDEOS),
      fs.ensureDir(PATHS.PHOTOS),
      fs.ensureDir(PATHS.PHOTO_THUMBNAILS), // 确保使用正确的变量名
      fs.ensureDir(PATHS.VIDEOS),
      fs.ensureDir(PATHS.VIDEO_THUMBNAILS),
    ]);

    console.log("目录初始化完成 Directory initialization completed");
  } catch (error) {
    console.error("初始化失败 Initialization failed:", error);
    throw error;
  }
}

// 启动时初始化 Initialize on startup
initializeDirectories().catch(console.error);

// 挂载拆分后的路由 Mount split routes
app.use("/api", photosRoutes);
app.use("/api", videosRoutes);

// 健康检查接口增强
app.get("/api/health", async (req, res) => {
  try {
    // 基本信息
    const memoryUsage = process.memoryUsage();
    const health = {
      status: "ok",
      uptime: process.uptime(),
      memory: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      nodeVersion: process.version,
    };

    // 检查磁盘空间
    try {
      const { exec } = require("child_process");
      const diskSpaceCheck = await new Promise((resolve, reject) => {
        exec("df -h / | tail -1 | awk '{print $5}'", (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });
      health.diskSpace = diskSpaceCheck;
    } catch (error) {
      console.error("获取磁盘空间失败:", error);
      health.diskSpace = "unknown";
    }

    // 如果请求了详细信息
    if (req.query.detail === "true") {
      // 添加路径信息 - 只使用实际定义的路径
      health.paths = {
        root: process.cwd(),
        ORIGINAL_IMAGES: PATHS.ORIGINAL_IMAGES,
        PHOTOS: PATHS.PHOTOS,
        photoThumbnails: PATHS.PHOTO_THUMBNAILS,
        photoSN: PATHS.PHOTO_SN_FILE,
        ORIGINAL_VIDEOS: PATHS.ORIGINAL_VIDEOS,
        VIDEOS: PATHS.VIDEOS,
        videoThumbnails: PATHS.VIDEO_THUMBNAILS,
        videoSN: PATHS.VIDEO_SN_FILE,
      };

      // 检查路径是否存在
      health.pathExists = {};
      for (const [key, value] of Object.entries(health.paths)) {
        if (value) {
          // 确保路径有值
          health.pathExists[key] = await fs.pathExists(value);
        } else {
          health.pathExists[key] = false;
        }
      }

      // 检查环境变量
      health.env = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
      };

      // 检查函数定义
      health.functions = {
        processImage: typeof processImage === "function",
        processVideo: typeof processVideo === "function",
      };
    }

    res.json(health);
  } catch (error) {
    console.error("健康检查错误:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// 修改服务器启动代码 Modify server startup code
app.listen(port, () => {
  console.log(`后端服务器运行在 端口: ${port}`);
  console.log("目录配置:");
  console.log("- 原始图片:", PATHS.ORIGINAL_IMAGES);
  console.log("- 处理后图片:", PATHS.PHOTOS);
  console.log("- 缩略图:", PATHS.PHOTO_THUMBNAILS);

  // 添加 URL 配置日志
  console.log("URL 配置:");
  console.log("- 基础 URL:", process.env.BASE_URL || "未设置");
  console.log("- 图片路径:", process.env.PHOTOS_PATH || "/photos");
  console.log(
    "- 缩略图路径:",
    process.env.THUMBNAILS_PATH || "/photo_thumbnails",
  );
});

// 全局错误处理
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});

// 后端 server.js 或相关路由文件中

// 全局变量存储当前处理状态
global.processingStatus = {
  isProcessing: false,
  type: null, // 'image' 或 'video'
  progress: 0,
  currentFile: "",
  originalName: "",
  newName: "",
  currentSN: "",
  currentStage: "",
  processedCount: 0,
  totalCount: 0,
  ffmpegProgress: 0,
  timemarks: "",
  startTime: null,
};

// 在图片处理函数中
function processSingleImage(filename, newName) {
  // 更新处理状态
  global.processingStatus.currentFile = filename;
  global.processingStatus.originalName = filename;
  global.processingStatus.newName = newName;
  global.processingStatus.currentStage = "处理中";

  // 其他处理逻辑
}

// 在视频处理函数中
function processSingleVideo(filename, newName) {
  // 更新处理状态
  global.processingStatus.currentFile = filename;
  global.processingStatus.originalName = filename;
  global.processingStatus.newName = newName;
  global.processingStatus.currentStage = "处理中";

  // 更新 ffmpeg 进度时
  global.processingStatus.ffmpegProgress = percent;
  global.processingStatus.timemarks = timemarks;
}

