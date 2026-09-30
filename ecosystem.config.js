// PM2 配置:通过环境变量 PROJECT_ROOT 指定安装路径,不再硬编码
const ROOT = process.env.PROJECT_ROOT || "/var/www/homePhotosVideos";

module.exports = {
  apps: [
    {
      name: "home-photo-frontend",
      script: "npm",
      args: "run preview",
      cwd: ROOT,
      env: {
        NODE_ENV: "production",
        PORT: 5173,
      },
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      autorestart: true,
    },
    {
      name: "home-photos-videos-backend",
      script: "./backend/server.js",
      cwd: ROOT,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATA_DIR: "data",
        PUBLIC_DIR: "public",
        BASE_URL: "http://localhost:3000",
        PHOTOS_PATH: "/photos",
        PHOTO_THUMBNAILS_PATH: "/photo_thumbnails",
        VIDEOS_PATH: "/videos",
        VIDEO_THUMBNAILS_PATH: "/video_thumbnails",
      },
    },
  ],
};
