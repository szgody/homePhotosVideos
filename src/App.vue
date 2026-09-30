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
