<template>
  <!-- 视频容器 Video container -->
  <div class="video-container">
    <!-- 视频信息显示 Video information display -->
    <div class="video-info">已加载视频: {{ totalVideos }} 个</div>
    <!-- 视频网格布局 Video grid layout -->
    <div class="video-grid">
      <!-- 遍历视频列表 Iterate through videos -->
      <div v-for="video in displayVideos" :key="video.filename" class="video-item">
        <!-- 视频缩略图 Video thumbnail -->
        <img :src="`${apiBaseUrl}${video.thumbnailPath}`" 
             :alt="video.filename"
             class="thumbnail-video">
      </div>
    </div>
  </div>
</template>

<script>
// 组件配置 Component configuration
export default {
  // 组件数据 Component data
  data() {
    return {
      videos: [],          // 视频数组 Array of videos
      displayCount: 8,     // 显示视频数量 Number of videos to display
      totalVideos: 0,      // 视频总数 Total number of videos
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '' // API基础URL地址
    }
  },

  // 计算属性 Computed properties
  computed: {
    // 要显示的视频列表 Videos to display
    displayVideos() {
      // 随机排序并截取指定数量的视频 Randomly sort and slice videos
      return [...this.videos]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.displayCount)
    }
  },

  // 组件创建时执行 Execute when component is created
  created() {
    this.fetchVideos()
  },

  // 组件方法 Component methods
  methods: {
    // 获取视频列表 Fetch video list
    async fetchVideos() {
      try {
        // 发送API请求 Send API request
        const response = await fetch(`${this.apiBaseUrl}/api/videos`)
        if (!response.ok) {
          throw new Error('获取视频列表失败 Failed to get video list')
        }

        // 解析响应数据 Parse response data
        const data = await response.json()
        
        // 处理返回的数据 Process returned data
        if (data && Array.isArray(data.videos)) {
          this.videos = data.videos
          this.totalVideos = data.videos.length
        } else {
          console.warn('返回数据格式不完整，使用空数组 Incomplete data format, using empty array')
          this.videos = []
          this.totalVideos = 0
        }
      } catch (error) {
        console.error('获取视频失败 Failed to fetch videos:', error)
        this.videos = []
        this.totalVideos = 0
      }
    }
  }
}
</script>

<style scoped>
/* 视频容器样式 Video container styles */
.video-container {
  margin-bottom: 20px;
}

/* 视频信息样式 Video information styles */
.video-info {
  font-size: 14px;        /* 字体大小 Font size */
  color: #666;            /* 文字颜色 Text color */
  margin-bottom: 10px;    /* 下边距 Bottom margin */
  padding-left: 10px;     /* 左内边距 Left padding */
}

/* 视频网格样式 Video grid styles */
.video-grid {
  display: flex;          /* 弹性布局 Flex layout */
  flex-direction: row;    /* 横向排列 Horizontal arrangement */
  align-items: center;    /* 垂直居中 Vertical center alignment */
  white-space: nowrap;    /* 不换行 No line break */
  font-size: 0;          /* 消除间隙 Remove gaps */
  line-height: 0;        /* 行高为0 Zero line height */
  letter-spacing: 0;     /* 字间距为0 Zero letter spacing */
  word-spacing: 0;       /* 词间距为0 Zero word spacing */
  margin-bottom: 20px;   /* 下边距 Bottom margin */
}

/* 视频项目样式 Video item styles */
.video-item {
  display: inline-block;  /* 内联块级显示 Inline block display */
  width: 60px;           /* 宽度 Width */
  height: 60px;          /* 高度 Height */
  margin: 0 10px 0 0;    /* 外边距 Margin */
  padding: 0;            /* 内边距 Padding */
  border: none;          /* 无边框 No border */
  vertical-align: top;   /* 顶部对齐 Top alignment */
}

/* 缩略图样式 Thumbnail styles */
.thumbnail-video {
  width: 100%;           /* 宽度100% Full width */
  height: 100%;          /* 高度100% Full height */
  object-fit: cover;     /* 覆盖填充 Cover fit */
  display: block;        /* 块级显示 Block display */
}
</style>