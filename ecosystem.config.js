module.exports = {
  apps: [{
    name: "home-photo-app",
    script: "/var/www/home-photo-vue/server.js",  // 使用绝对路径
    cwd: "/var/www/home-photo-vue",               // 设置工作目录
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "200M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    merge_logs: true,
    autorestart: true
  }]
}
