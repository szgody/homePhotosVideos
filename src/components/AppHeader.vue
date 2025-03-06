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
// 导出组件配置 Export component configuration
export default {
  name: 'AppHeader', // 组件名称 Component name
  
  // 添加数据属性
  data() {
    return {
      // 从环境变量获取基础URL
      baseUrl: import.meta.env.VITE_BASE_URL || ''
    }
  }
}
</script>

<style scoped>
/* 页头样式 Header styles */
.header {
  background-color: #f8f9fa;    /* 背景颜色 Background color */
  padding: 1rem;                /* 内边距 Padding */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);  /* 阴影效果 Shadow effect */
  text-align: center;           /* 文本居中 Center text */
  position: sticky;             /* 固定定位 Sticky positioning */
  top: 0;                       /* 顶部对齐 Top alignment */
  z-index: 1000;               /* 层级 Z-index */
}

/* 标题样式 Title styles */
h1 {
  margin: 0 0 1rem 0;          /* 外边距 Margin */
  color: #333;                 /* 文字颜色 Text color */
  font-size: 1.8rem;           /* 字体大小 Font size */
  font-weight: 500;            /* 字体粗细 Font weight */
  letter-spacing: 0.5px;       /* 字间距 Letter spacing */
}

/* 导航栏样式 Navigation bar styles */
.nav-bar {
  display: flex;               /* 弹性布局 Flex layout */
  justify-content: center;     /* 居中对齐 Center alignment */
  gap: 20px;                  /* 间距 Gap between items */
  padding: 0.5rem 0;          /* 上下内边距 Vertical padding */
}

/* 导航链接样式 Navigation link styles */
.nav-bar a {
  color: #2c3e50;             /* 链接颜色 Link color */
  text-decoration: none;       /* 移除下划线 Remove underline */
  padding: 5px 15px;          /* 内边距 Padding */
  border-radius: 4px;         /* 圆角边框 Rounded corners */
  font-weight: 500;           /* 字体粗细 Font weight */
  transition: all 0.3s ease;   /* 过渡效果 Transition effect */
}

/* 导航链接悬停效果 Navigation link hover effect */
.nav-bar a:hover {
  background-color: #e9ecef;   /* 悬停背景色 Hover background color */
  transform: translateY(-1px); /* 轻微上浮 Slight lift effect */
}

/* 激活状态导航链接样式 Active navigation link styles */
.nav-bar a.router-link-active {
  background-color: #42b983;   /* 激活背景色 Active background color */
  color: white;               /* 激活文字颜色 Active text color */
  box-shadow: 0 2px 4px rgba(66,185,131,0.2); /* 激活状态阴影 Active state shadow */
}

/* 适配移动设备 Mobile device adaptation */
@media (max-width: 768px) {
  .nav-bar {
    flex-wrap: wrap;          /* 允许换行 Allow wrapping */
    gap: 10px;               /* 减小间距 Reduce gap */
  }
  
  h1 {
    font-size: 1.5rem;       /* 减小标题字号 Reduce title size */
  }
}
</style>