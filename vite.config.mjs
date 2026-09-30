// 导入 Vite 配置函数 Import Vite configuration function
import { defineConfig } from "vite";

// 导入 Vue 插件 Import Vue plugin
import vue from "@vitejs/plugin-vue";

// 后端地址 Backend base for dev proxy
const BACKEND = "http://localhost:3000";

// 导出 Vite 配置 Export Vite configuration
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/photos": { target: BACKEND, changeOrigin: true },
      "/photo_thumbnails": { target: BACKEND, changeOrigin: true },
      "/videos": { target: BACKEND, changeOrigin: true },
      "/video_thumbnails": { target: BACKEND, changeOrigin: true },
    },
  },
});
