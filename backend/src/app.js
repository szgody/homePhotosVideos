// Express 装配:中间件、静态资源、路由挂载 App assembly
const express = require("express");
const cors = require("cors");
const { PATHS, URL_PATHS, ALLOWED_ORIGINS } = require("./config");
const photosRoutes = require("./routes/photos");
const videosRoutes = require("./routes/videos");

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
    });
  });

  // API 路由
  app.use("/api", photosRoutes);
  app.use("/api", videosRoutes);

  // 统一 404
  app.use((req, res) => {
    res.status(404).json({ error: "接口不存在" });
  });

  return app;
}

module.exports = { createApp };
