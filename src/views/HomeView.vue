<template>
  <!-- 首页容器 Home container -->
  <div class="home">
    <!-- 欢迎标题 Welcome title -->
    <h1>欢迎访问家庭照片与视频网站 Welcome to Family Photos and Videos</h1>
    
    <!-- 主要内容区域 Main content area -->
    <div class="content">
      <!-- 最新视频部分 Latest videos section -->
      <div class="grid-section">
        <h3 class="section-title">最新视频 Latest Videos</h3>
        <VideoGrid />
      </div>
      
      <!-- 最新照片部分 Latest photos section -->
      <div class="grid-section">
        <h3 class="section-title">最新照片 Latest Photos</h3>
        <PhotoGrid />
      </div>
      
      <!-- 查看更多按钮 View more buttons -->
      <div class="view-more">
        <router-link to="/photo" class="button">查看更多照片 View More Photos</router-link>
        <router-link to="/video" class="button">查看更多视频 View More Videos</router-link>
      </div>
    </div>

    <!-- 精选照片区域 Featured photos area -->
    <div class="featured-photos">
      <h2>精选照片 Featured Photos</h2>
      <div class="featured-grid">
        <div v-for="photo in displayPhotos.slice(0, 2)" 
             :key="photo.filename" 
             class="featured-item">
          <img :src="`${apiBaseUrl}/photos/${photo.filename}`"
               :alt="photo.filename"
               class="featured-image"
               @load="handleImageLoad"
               @error="handleImageError">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 导入所需的 Vue 功能和组件 Import required Vue features and components
import { ref, computed, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import PhotoGrid from '../components/PhotoGrid.vue'
import VideoGrid from '../components/VideoGrid.vue'

export default {
  name: 'HomeView', // 组件名称 Component name
  
  // 注册子组件 Register child components
  components: {
    AppHeader,   // 页头组件 Header component
    PhotoGrid,   // 照片网格组件 Photo grid component
    VideoGrid    // 视频网格组件 Video grid component
  },

  // 组件设置 Component setup
  setup() {
    // API基础URL API base URL
    const apiBaseUrl = ref(import.meta.env.VITE_API_BASE_URL || process.env.VUE_APP_API_BASE_URL || '')
    
    // 状态定义 State definitions
    const photos = ref([])           // 照片列表 Photo list
    const loadedImages = ref(0)      // 已加载图片数 Loaded images count
    const errorImages = ref(0)       // 加载失败图片数 Failed images count
    const debug = ref(true)          // 调试模式 Debug mode
    const displayCount = ref(8)      // 显示照片数量 Number of photos to display
    const latestVideos = ref([])     // 最新视频 Latest videos

    // 计算属性：随机选择照片 Computed property: randomly select photos
    const displayPhotos = computed(() => {
      return [...photos.value]
        .sort(() => Math.random() - 0.5)
        .slice(0, displayCount.value)
    })

    // 组件挂载时获取照片 Fetch photos when component is mounted
    onMounted(async () => {
      try {
        const response = await fetch(`${apiBaseUrl.value}/api/photos`)
        if (!response.ok) {
          throw new Error('获取照片列表失败 Failed to get photo list')
        }
        const data = await response.json()
        
        if (data && Array.isArray(data.photos)) {
          photos.value = data.photos
          console.log('获取到照片数量 Retrieved photos count:', data.photos.length)
        }
      } catch (error) {
        console.error('加载照片失败 Failed to load photos:', error)
      }
      
      // 获取最新视频 Fetch latest videos
      fetchLatestVideos()
    })

    // 图片加载成功处理 Handle successful image load
    const handleImageLoad = () => {
      loadedImages.value++
      if (debug.value) {
        console.log('图片加载成功，已加载 Image loaded successfully, total loaded:', loadedImages.value)
      }
    }

    // 图片加载失败处理 Handle image load error
    const handleImageError = (e) => {
      errorImages.value++
      console.error('图片加载失败 Image load failed:', e.target.src)
    }
    
    // 获取最新视频的方法 Fetch latest videos method
    const fetchLatestVideos = async () => {
      try {
        // 使用相对路径或完整路径 Use relative or complete path
        const response = await fetch(`${apiBaseUrl.value}/api/videos?limit=4`) 
        if (!response.ok) {
          throw new Error(`获取视频失败 Failed to get videos: ${response.status}`)
        }
        
        const data = await response.json()
        latestVideos.value = data.videos || []
        
        // 检查并修复缩略图路径 Check and fix thumbnail paths
        latestVideos.value.forEach(video => {
          if (video.thumbnailPath && video.thumbnailPath.startsWith(apiBaseUrl.value)) {
            // 替换为相对路径 Replace with relative path
            video.thumbnailPath = video.thumbnailPath.replace(new RegExp(`^${apiBaseUrl.value}`), '')
          }
        })
      } catch (error) {
        console.error('获取最新视频失败 Failed to fetch latest videos:', error)
        latestVideos.value = []
      }
    }
    
    // 格式化缩略图路径 Format thumbnail path
    const formatThumbnailPath = (path) => {
      // 首先，移除可能的 API 基础 URL 前缀 First, remove possible API base URL prefix
      let newPath = path.replace(new RegExp(`^${apiBaseUrl.value}`), '')
      
      // 然后，修复文件名，将 .mp4.jpg 替换为 .jpg Then, fix filename, replace .mp4.jpg with .jpg
      return newPath.replace(/\.(mp4|webm|avi|mov)\.jpg$/i, '.jpg')
    }
    
    // 处理缩略图加载错误 Handle thumbnail load error
    const handleThumbnailError = (event, video) => {
      console.log('视频缩略图加载失败 Video thumbnail load failed:', event.target.src)
      
      // 尝试修复路径 Try to fix path
      if (video && video.thumbnailPath) {
        const fixedPath = formatThumbnailPath(video.thumbnailPath)
        if (event.target.src !== `${apiBaseUrl.value}${fixedPath}`) {
          event.target.src = `${apiBaseUrl.value}${fixedPath}`
        } else {
          // 如果修复后仍然失败，使用默认图片 If still fails after fixing, use default image
          event.target.src = `${apiBaseUrl.value}/assets/default-video-thumbnail.jpg`
        }
      } else {
        // 没有视频对象时使用默认图片 Use default image when no video object
        event.target.src = `${apiBaseUrl.value}/assets/default-video-thumbnail.jpg`
      }
    }

    // 返回组件数据和方法 Return component data and methods
    return {
      photos,
      displayPhotos,
      loadedImages,
      errorImages,
      debug,
      apiBaseUrl,
      latestVideos,
      handleImageLoad,
      handleImageError,
      fetchLatestVideos,
      formatThumbnailPath,
      handleThumbnailError
    }
  }
}
</script>

<style scoped>
/* 首页样式 Home styles */
.home {
  padding: 20px;              /* 内边距 Padding */
}

/* 内容区域样式 Content area styles */
.content {
  max-width: 1200px;         /* 最大宽度 Maximum width */
  margin: 0 auto;            /* 居中对齐 Center alignment */
  padding: 20px;             /* 内边距 Padding */
}

/* 查看更多区域样式 View more area styles */
.view-more {
  margin-top: 20px;          /* 顶部外边距 Top margin */
  text-align: center;        /* 文本居中 Text center */
}

/* 按钮样式 Button styles */
.button {
  margin-right: 10px;        /* 右侧外边距 Right margin */
  display: inline-block;     /* 内联块级显示 Inline block display */
  padding: 8px 16px;         /* 内边距 Padding */
  background-color: #42b983; /* 背景色 Background color */
  color: white;              /* 文字颜色 Text color */
  text-decoration: none;     /* 无下划线 No underline */
  border-radius: 4px;        /* 圆角 Border radius */
  transition: background-color 0.2s; /* 背景色过渡 Background transition */
}

/* 按钮悬停效果 Button hover effect */
.button:hover {
  background-color: #3aa876; /* 悬停背景色 Hover background color */
}

/* 照片网格样式 Photo grid styles */
.photo-grid {
  display: flex;             /* 弹性布局 Flex layout */
  flex-direction: row;       /* 水平方向 Horizontal direction */
  gap: 10px;                /* 间距 Gap */
  padding: 20px;            /* 内边距 Padding */
  justify-content: center;   /* 居中对齐 Center alignment */
  flex-wrap: nowrap;        /* 不换行 No wrap */
  overflow-x: auto;         /* 水平滚动 Horizontal scroll */
}

/* 照片项目样式 Photo item styles */
.photo-item {
  flex: 0 0 60px;           /* 固定宽度 Fixed width */
  width: 60px;              /* 宽度 Width */
  height: 60px;             /* 高度 Height */
  overflow: hidden;         /* 溢出隐藏 Hide overflow */
  border-radius: 4px;       /* 圆角 Border radius */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* 阴影效果 Shadow effect */
}

/* 照片样式 Photo styles */
.photo-item img {
  width: 100%;              /* 宽度 Width */
  height: 100%;             /* 高度 Height */
  object-fit: cover;        /* 填充方式 Object fit */
  display: block;           /* 块级显示 Block display */
}

/* 调试信息样式 Debug info styles */
.debug-info {
  margin-top: 20px;         /* 顶部外边距 Top margin */
  padding: 10px;            /* 内边距 Padding */
  background-color: #f0f0f0; /* 背景色 Background color */
  border-radius: 4px;        /* 圆角 Border radius */
}

/* 网格部分样式 Grid section styles */
.grid-section {
  margin-bottom: 20px;      /* 底部外边距 Bottom margin */
}

/* 部分标题样式 Section title styles */
.section-title {
  font-size: 18px;          /* 字体大小 Font size */
  color: #333;              /* 文字颜色 Text color */
  margin: 10px 0;           /* 外边距 Margin */
  padding-left: 10px;       /* 左侧内边距 Left padding */
  border-left: 3px solid #42b983; /* 左边框 Left border */
}

/* 精选照片区域样式 Featured photos area styles */
.featured-photos {
  margin: 20px;             /* 外边距 Margin */
}

/* 精选网格样式 Featured grid styles */
.featured-grid {
  display: flex;            /* 弹性布局 Flex layout */
  justify-content: center;  /* 居中对齐 Center alignment */
  gap: 20px;               /* 间距 Gap */
  margin-top: 20px;        /* 顶部外边距 Top margin */
}

/* 精选项目样式 Featured item styles */
.featured-item {
  width: 640px;             /* 宽度 Width */
  height: 480px;            /* 高度 Height */
  overflow: hidden;         /* 溢出隐藏 Hide overflow */
  border-radius: 8px;       /* 圆角 Border radius */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* 阴影效果 Shadow effect */
}

/* 精选图片样式 Featured image styles */
.featured-image {
  width: 100%;              /* 宽度 Width */
  height: 100%;             /* 高度 Height */
  object-fit: cover;        /* 填充方式 Object fit */
}
</style>