<template>
  <!-- 页头组件 Header component -->
  <header class="header">
    <!-- 网站标题 Website title -->
    <h1>家庭照片与视频 Home Photos and Videos</h1>

    <!-- 导航栏 Navigation bar -->
    <nav class="nav-bar">
      <!-- 导航链接列表 Navigation link list -->
      <router-link to="/">首页</router-link>
      <!-- Home page -->
      <router-link to="/photo">照片</router-link>
      <!-- Photos page -->
      <router-link to="/video">视频</router-link>
      <!-- Videos page -->
      <router-link to="/admin/processing">处理</router-link>
      <!-- Processing page -->
    </nav>
  </header>
</template>

<script>
// 导入外部 CSS 样式
import "../styles/components/appheader.css";

// 导出组件配置 Export component configuration
export default {
  name: "AppHeader", // 组件名称 Component name
};
</script>
