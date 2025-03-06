<template>
  <!-- 照片容器 Photo container -->
  <div class="photo-container">
    <!-- 照片信息显示 Photo information display -->
    <div class="photo-info">已加载照片: {{ totalPhotos }} 张</div>
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div v-for="photo in displayPhotos" 
           :key="photo.filename" 
           class="photo-item">
        <!-- 照片缩略图 Photo thumbnail -->
        <img :src="`${apiBaseUrl}/thumbnails/${photo.filename}`" 
             :alt="photo.filename"
             class="thumbnail-photo">
      </div>
    </div>
  </div>
</template>

<script>
// 组件配置 Component configuration
export default {
  name: 'PhotoGrid', // 组件名称 Component name

  // 组件数据 Component data
  data() {
    return {
      photos: [],          // 照片数组 Array of photos
      displayCount: 8,     // 显示照片数量 Number of photos to display
      totalPhotos: 0,      // 总照片数 Total number of photos
      apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '' // API基础URL地址
    }
  },

  // 计算属性 Computed properties
  computed: {
    // 要显示的照片列表 Photos to display
    displayPhotos() {
      // 随机排序并截取指定数量的照片 Randomly sort and slice photos
      return [...this.photos]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.displayCount)
    }
  },

  // 组件创建时执行 Execute when component is created
  async created() {
    await this.fetchPhotos() // 获取照片数据 Fetch photos data
  },

  // 组件方法 Component methods
  methods: {
    // 获取照片数据 Fetch photos data
    async fetchPhotos() {
      try {
        // 发送API请求 Send API request
        const response = await fetch(`${this.apiBaseUrl}/api/photos`)
        if (!response.ok) {
          throw new Error('获取照片列表失败 Failed to get photo list')
        }

        // 解析响应数据 Parse response data
        const data = await response.json()
        console.log('获取到的数据 Retrieved data:', data)
        
        // 处理数据 Process data
        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos
          this.totalPhotos = data.total || data.photos.length
        } else {
          console.warn('返回数据格式不完整，使用空数组 Incomplete data format, using empty array')
          this.photos = []
          this.totalPhotos = 0
        }
      } catch (error) {
        console.error('获取照片失败 Failed to fetch photos:', error.message)
        this.totalPhotos = 0
        this.photos = []
      }
    }
  }
}
</script>

<style scoped>
/* 照片容器样式 Photo container styles */
.photo-container {
  margin-bottom: 20px;    /* 底部外边距 Bottom margin */
}

/* 照片信息样式 Photo information styles */
.photo-info {
  font-size: 14px;        /* 字体大小 Font size */
  color: #666;            /* 文字颜色 Text color */
  margin-bottom: 10px;    /* 底部外边距 Bottom margin */
  padding-left: 10px;     /* 左侧内边距 Left padding */
}

/* 照片网格样式 Photo grid styles */
.photo-grid {
  display: flex;          /* 弹性布局 Flex layout */
  flex-direction: row;    /* 横向排列 Horizontal arrangement */
  align-items: center;    /* 垂直居中 Vertical center */
  white-space: nowrap;    /* 不换行 No wrapping */
  font-size: 0;          /* 消除间距 Remove spacing */
  line-height: 0;        /* 行高为0 Zero line height */
  letter-spacing: 0;     /* 字间距为0 Zero letter spacing */
  word-spacing: 0;       /* 词间距为0 Zero word spacing */
  margin-bottom: 20px;   /* 底部外边距 Bottom margin */
}

/* 照片项目样式 Photo item styles */
.photo-item {
  display: inline-block;  /* 内联块级显示 Inline block display */
  width: 60px;           /* 照片宽度 Photo width */
  height: 60px;          /* 照片高度 Photo height */
  margin: 0;             /* 外边距为0 Zero margin */
  padding: 0;            /* 内边距为0 Zero padding */
  border: none;          /* 无边框 No border */
  vertical-align: top;   /* 顶部对齐 Top alignment */
}

/* 缩略图样式 Thumbnail styles */
.thumbnail-photo {
  width: 100%;           /* 宽度100% Full width */
  height: 100%;          /* 高度100% Full height */
  object-fit: cover;     /* 保持图片比例 Maintain aspect ratio */
  display: block;        /* 块级显示 Block display */
  margin: 0 10px 0 0;    /* 右侧外边距 Right margin */
  padding: 0;            /* 内边距为0 Zero padding */
}

/* 隐藏滚动条 Hide scrollbar */
.photo-grid::-webkit-scrollbar {
  display: none;         /* 不显示滚动条 Hide scrollbar */
}
</style>