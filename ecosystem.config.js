module.exports = {
  apps: [
    {
      name: "home-photo-frontend",
      script: "npm",
      args: "run preview",  // 使用 npm run preview 来启动 Vite 预览服务器
      cwd: "/var/www/home-photo-vue",
      env: {
        NODE_ENV: "production",
        PORT: 5173  // 前端服务默认端口
      },
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      autorestart: true
    },
    {
      name: "home-photos-videos-backend",
      script: "./backend/server.js",
      watch: ["backend"],
      ignore_watch: ["node_modules", "data", "public"],
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        DATA_DIR: "data",
        PUBLIC_DIR: "public",
        BASE_URL: "http://localhost:3000",
        PHOTOS_PATH: "/photos",
        THUMBNAILS_PATH: "/photo_thumbnails",
        VIDEOS_PATH: "/videos",
        VIDEO_THUMBNAILS_PATH: "/video_thumbnails"
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
}
