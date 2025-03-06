<template>
  <!-- 首页容器 Home container -->
  <div class="home">
    <!-- 最新视频部分 Latest videos section -->
    <div class="grid-section">
      <h3 class="section-title">最新视频 Latest Videos</h3>
      <!-- 视频网格组件 Video grid component -->
      <VideoGrid />
    </div>
    
    <!-- 最新照片部分 Latest photos section -->
    <div class="grid-section">
      <h3 class="section-title">最新照片 Latest Photos</h3>
      <!-- 照片网格组件 Photo grid component -->
      <PhotoGrid />
    </div>
  </div>
</template>

<script>
// 导入组件 Import components
import VideoGrid from '@/components/VideoGrid.vue'  // 视频网格组件 Video grid component
import PhotoGrid from '@/components/PhotoGrid.vue'  // 照片网格组件 Photo grid component

// 导出组件配置 Export component configuration
export default {
  name: 'Home',  // 组件名称 Component name
  
  // 注册子组件 Register child components
  components: {
    VideoGrid,  // 视频网格组件 Video grid component
    PhotoGrid   // 照片网格组件 Photo grid component
  }
}
</script>

<style scoped>
/* 首页样式 Home styles */
.home {
  padding: 20px;    /* 内边距 Padding */
}

/* 网格部分样式 Grid section styles */
.grid-section {
  margin-bottom: 20px;    /* 底部外边距 Bottom margin */
}

/* 部分标题样式 Section title styles */
.section-title {
  font-size: 16px;       /* 字体大小 Font size */
  color: #333;           /* 文字颜色 Text color */
  margin: 10px 0;        /* 上下外边距 Vertical margin */
  padding-left: 10px;    /* 左内边距 Left padding */
  border-left: 3px solid #42b983;  /* 左边框 Left border */
}
</style>