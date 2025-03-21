// 导入 Vite 配置函数 Import Vite configuration function
import { defineConfig } from 'vite'

// 导入 Vue 插件 Import Vue plugin
import vue from '@vitejs/plugin-vue'

// 导出 Vite 配置 Export Vite configuration
export default defineConfig({
  // 配置插件 Configure plugins
  plugins: [vue()],  // Vue 插件支持 Vue plugin support
  
  // 公共资源目录 Public assets directory
  publicDir: 'public',
  
  // 开发服务器配置 Development server configuration
  server: {
    port: 5173,        // 服务器端口 Server port
    open: true         // 自动打开浏览器 Auto open browser
  },
  
  // 依赖优化选项 Dependency optimization options
  optimizeDeps: {
    include: ['sharp']  // 预构建包含的依赖 Dependencies to pre-bundle
  }
})