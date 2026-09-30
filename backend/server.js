// 后端入口:初始化目录后启动 HTTP 服务 Backend entry point
const { createApp } = require("./src/app");
const { ensureDirectories } = require("./src/bootstrap");
const { PORT, PATHS } = require("./src/config");

ensureDirectories().then(() => {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`后端服务器运行在端口: ${PORT}`);
    console.log("目录配置:");
    console.log("- 原始图片:", PATHS.ORIGINAL_IMAGES);
    console.log("- 原始视频:", PATHS.ORIGINAL_VIDEOS);
    console.log("- 处理后图片:", PATHS.PHOTOS);
    console.log("- 缩略图:", PATHS.PHOTO_THUMBNAILS);
    console.log("- 视频:", PATHS.VIDEOS);
    console.log("- 视频缩略图:", PATHS.VIDEO_THUMBNAILS);
  });
});


