<template>
  <!-- 页头组件 Header component -->
  <header class="header">
    <!-- 网站标题 Website title -->
    <h1>家庭照片与视频 Home Photos and Videos</h1>
    
    <!-- 导航栏 Navigation bar -->
    <nav class="nav-bar">
      <!-- 导航链接列表 Navigation link list -->
      <router-link :to="baseUrl + '/'">首页</router-link>             <!-- Home page -->
      <router-link :to="baseUrl + '/photo'">照片</router-link>        <!-- Photos page -->
      <router-link :to="baseUrl + '/video'">视频</router-link>        <!-- Videos page -->
      <router-link :to="baseUrl + '/admin/processing'">处理</router-link> <!-- Processing page -->
    </nav>
  </header>
</template>

<script>
// 导入外部 CSS 样式
import '../styles/components/appheader.css'

// 导出组件配置 Export component configuration
export default {
  name: 'AppHeader', // 组件名称 Component name
  
  // 添加数据属性
  data() {
    return {
      // 从环境变量获取基础URL
      baseUrl: import.meta.env.VITE_BASE_URL || ''
    }
  },

  methods: {
    async loadPhotos() {
      try {
        const response = await fetch(`${this.apiUrl}/photos`);
        const data = await response.json();
        // 修复路径问题
        this.photos = data.photos.map(photo => ({
          ...photo,
          url: `/photos/${photo.filename}`,
          thumbnailUrl: `/photo_thumbnails/${photo.filename}`
        }));
      } catch (error) {
        console.error('加载照片失败:', error);
      }
    }
  }
}
</script>