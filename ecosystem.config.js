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
      name: "home-photo-backend",
      script: "server.js",
      cwd: "<PROJECT_ROOT>/backend",  // 使用相对路径占位符
      env: {
        NODE_ENV: "production",
        PORT: 3000  // 改回 3000
      },
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      autorestart: true
    }
  ]
}
