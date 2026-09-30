<template>
  <!-- 应用程序根组件 Root application component -->
  <div id="app">
    <!-- 页头组件 Header component -->
    <AppHeader />
    <!-- 路由视图组件 Router view component -->
    <router-view></router-view>
  </div>
</template>

<script>
// 导入页头组件 Import header component
import AppHeader from "./components/AppHeader.vue";
// 导入处理监控初始化 Import processing monitor initialization
import { initProcessingMonitor } from "./composables/useProcessing.js";

// 导出应用程序配置 Export application configuration
export default {
  name: "App", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    AppHeader, // 页头组件 Header component
  },

  // 使用组合式API Setup function
  setup() {
    // 初始化处理状态监控(原 SessionStorage 隐藏组件的职责)
    initProcessingMonitor();
  },
};
</script>

<style>
/* 全局设计变量与基础样式 Global design tokens & base styles */
:root {
  --primary: #42b983;
  --primary-dark: #36a76f;
  --bg: #f5f7f6;
  --surface: #ffffff;
  --text: #2c3e50;
  --muted: #6b7280;
  --radius: 8px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 6px 18px rgba(0, 0, 0, 0.12);
}

body {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background-color: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

img {
  max-width: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #4caf50;
  color: white;
  padding: 1rem;
  text-align: center;
}

.app-header nav {
  margin-top: 1rem;
}

.app-header a {
  color: white;
  text-decoration: none;
  margin: 0 0.5rem;
}

.app-header a.router-link-active {
  font-weight: bold;
  text-decoration: underline;
}

.content {
  flex: 1;
  padding: 2rem;
}

.app-footer {
  background-color: #f1f1f1;
  padding: 1rem;
  text-align: center;
}
</style>
