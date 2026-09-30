// Express 装配:中间件、静态资源、路由挂载 App assembly
const express = require("express");
const cors = require("cors");
const { PATHS, URL_PATHS, ALLOWED_ORIGINS, LOGICAL_CORES, IMAGE_CONCURRENCY, VIDEO_THREADS, VIDEO_PRESET } = require("./config");
const photosRoutes = require("./routes/photos");
const videosRoutes = require("./routes/videos");
const uploadRoutes = require("./routes/upload");

function createApp() {
  const app = express();

  // CORS:仅白名单来源(无 origin 的请求如 curl 放行) Fix Bug #4
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        console.log("CORS拒绝源:", origin);
        return callback(new Error("不允许的来源"));
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // CORS 拒绝返回结构化 JSON(而非默认 500 HTML) Rejected CORS requests return JSON
  app.use((err, req, res, next) => {
    const status = err && err.code === "LIMIT_FILE_SIZE" ? 413 : err && err.status ? err.status : 403;
    console.error("请求被拒绝:", err.message);
    res.status(status).json({ error: "请求被拒绝", message: err.message });
  });

  app.use(express.json());

  // 静态资源
  app.use(URL_PATHS.photoThumbnails, express.static(PATHS.PHOTO_THUMBNAILS));
  app.use(URL_PATHS.photos, express.static(PATHS.PHOTOS));
  app.use(URL_PATHS.videos, express.static(PATHS.VIDEOS));
  app.use(URL_PATHS.videoThumbnails, express.static(PATHS.VIDEO_THUMBNAILS));

  // 健康检查
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      // 实际生效的性能配置(便于线上核对并发/线程数)
      performance: {
        logicalCores: LOGICAL_CORES,
        imageConcurrency: IMAGE_CONCURRENCY,
        videoThreads: VIDEO_THREADS,
        videoPreset: VIDEO_PRESET,
      },
    });
  });

  // API 路由
  app.use("/api", photosRoutes);
  app.use("/api", videosRoutes);
  app.use("/api", uploadRoutes);

  // 统一 404
  app.use((req, res) => {
    res.status(404).json({ error: "接口不存在" });
  });

  return app;
}

module.exports = { createApp };
