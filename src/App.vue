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
import AppHeader from './components/AppHeader.vue'

// 导出应用程序配置 Export application configuration
export default {
  name: 'App', // 组件名称 Component name
  
  // 注册子组件 Register child components
  components: {
    AppHeader // 页头组件 Header component
  }
}
</script>

<style>
/* 应用程序根样式 Root application styles */
#app {
  font-family: Arial, sans-serif;    /* 字体设置 Font family */
  -webkit-font-smoothing: antialiased;    /* WebKit字体平滑 WebKit font smoothing */
  -moz-osx-font-smoothing: grayscale;     /* Mozilla字体平滑 Mozilla font smoothing */
  color: #2c3e50;                    /* 文本颜色 Text color */
  margin: 0;                         /* 外边距 Margin */
  padding: 0;                        /* 内边距 Padding */
}

/* 全局链接样式 Global link styles */
a {
  text-decoration: none;             /* 移除下划线 Remove underline */
  color: inherit;                    /* 继承颜色 Inherit color */
}

/* 全局内容容器样式 Global content container styles */
.container {
  max-width: 1200px;                /* 最大宽度 Maximum width */
  margin: 0 auto;                   /* 居中对齐 Center alignment */
  padding: 0 20px;                  /* 内边距 Padding */
}

/* 响应式设计 Responsive design */
@media (max-width: 768px) {
  .container {
    padding: 0 10px;                /* 移动设备内边距 Mobile padding */
  }
}
</style>