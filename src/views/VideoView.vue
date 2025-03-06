<template>
  <!-- 视频视图容器 Video view container -->
  <div class="video-view">
    <!-- 标题 Title -->
    <h2>视频库 Video Gallery</h2>
    <!-- 视频网格布局 Video grid layout -->
    <div class="video-grid">
      <!-- 遍历视频列表 Iterate through videos -->
      <div v-for="video in videos" 
           :key="video.filename" 
           class="video-item"
           @click="playVideo(video)">
        <!-- 视频缩略图 Video thumbnail -->
        <img :src="getThumbnailUrl(video)" 
             :alt="video.filename"
             class="thumbnail"
             @error="handleThumbnailError($event, video)">
        <!-- 显示视频名称 Display video name -->
        <div class="video-name">{{ formatVideoName(video.filename) }}</div>
      </div>
    </div>

    <!-- 视频播放弹窗 Video player modal -->
    <div v-if="showPlayer" class="video-overlay" @click="closePlayer">
      <!-- 视频容器 Video container -->
      <div class="video-container" @click.stop>
        <!-- 视频播放器 Video player -->
        <video 
          ref="videoPlayer"
          :src="getVideoUrl(selectedVideo)"
          controls
          autoplay
          class="video-player">
          您的浏览器不支持 HTML5 视频播放 Your browser does not support HTML5 video
        </video>
        <!-- 关闭按钮 Close button -->
        <button class="close-button" @click="closePlayer">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
// 导入视频网格组件 Import video grid component
import VideoGrid from '../components/VideoGrid.vue'

export default {
  name: 'VideoView', // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    VideoGrid
  },

  // 组件数据 Component data
  data() {
    return {
      videos: [],           // 视频列表 Video list
      showPlayer: false,    // 显示播放器标志 Show player flag
      selectedVideo: null,  // 选中的视频 Selected video
      baseUrl: import.meta.env.VITE_BASE_URL || 
               import.meta.env.VITE_API_BASE_URL || 
               process.env.VUE_APP_BASE_URL ||
               process.env.VUE_APP_API_BASE_URL || 
               '' // 从环境变量获取API URL
    }
  },

  // 组件创建时执行 Execute when component is created
  created() {
    // 打印基础URL以便调试
    console.log('Base URL:', this.baseUrl);
    this.fetchVideos()
  },

  // 组件方法 Component methods
  methods: {
    // 获取视频列表 Fetch video list
    async fetchVideos() {
      try {
        // 构建API URL
        const apiUrl = this.baseUrl ? `${this.baseUrl}/api/videos` : '/api/videos';
        console.log('正在从以下地址获取视频 Fetching videos from:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`获取视频列表失败 Failed to get video list: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('获取到的数据 Retrieved data:', data);
        
        // 验证和处理数据
        if (data && Array.isArray(data.videos)) {
          this.videos = data.videos;
          console.log('获取到视频数量 Retrieved videos count:', this.videos.length);
        } else {
          console.warn('返回数据格式不完整，使用空数组 Invalid data format, using empty array');
          this.videos = [];
        }
      } catch (error) {
        console.error('获取视频失败 Failed to fetch videos:', error);
        this.videos = [];
      }
    },

    // 获取缩略图URL Get thumbnail URL
    getThumbnailUrl(video) {
      if (!video || !video.thumbnailPath) return `${this.baseUrl}/assets/default-video-thumbnail.jpg`;
      
      // 检查是否已经是完整URL
      if (video.thumbnailPath.startsWith('http')) {
        return video.thumbnailPath;
      }
      
      // 确保路径以/开头
      const path = video.thumbnailPath.startsWith('/') 
        ? video.thumbnailPath 
        : `/${video.thumbnailPath}`;
        
      return `${this.baseUrl}${path}`;
    },
    
    // 获取视频URL Get video URL
    getVideoUrl(video) {
      if (!video || !video.path) return '';
      
      // 检查是否已经是完整URL
      if (video.path.startsWith('http')) {
        return video.path;
      }
      
      // 确保路径以/开头
      const path = video.path.startsWith('/') 
        ? video.path 
        : `/${video.path}`;
        
      return `${this.baseUrl}${path}`;
    },

    // 播放视频 Play video
    playVideo(video) {
      console.log('播放视频 Playing video:', video)
      this.selectedVideo = video
      this.showPlayer = true
    },

    // 关闭播放器 Close player
    closePlayer() {
      if (this.$refs.videoPlayer) {
        this.$refs.videoPlayer.pause()  // 暂停视频播放 Pause video playback
      }
      this.showPlayer = false
      this.selectedVideo = null
    },

    // 处理缩略图加载错误 Handle thumbnail loading error
    handleThumbnailError(event, video) {
      console.log('缩略图加载失败 Thumbnail loading failed:', event.target.src);
      
      // 设置为默认缩略图 Set default thumbnail
      event.target.src = `${this.baseUrl}/assets/default-video-thumbnail.jpg`;
      
      // 可选：触发API重新生成缩略图 Optional: trigger API to regenerate thumbnail
      this.regenerateThumbnail(video.filename);
    },
    
    // 格式化视频文件名 Format video filename
    formatVideoName(filename) {
      // 去除扩展名 Remove extension
      return filename ? filename.replace(/\.[^/.]+$/, "") : '未命名视频 Unnamed Video';
    },
    
    // 请求重新生成缩略图 Request to regenerate thumbnail
    async regenerateThumbnail(filename) {
      if (!filename) return;
      
      try {
        // 构建API URL
        const apiUrl = this.baseUrl 
          ? `${this.baseUrl}/api/regenerate-thumbnail` 
          : '/api/regenerate-thumbnail';
          
        const response = await fetch(`${apiUrl}?filename=${encodeURIComponent(filename)}`);
        console.log('重新生成缩略图请求结果 Thumbnail regeneration result:', await response.json());
      } catch (error) {
        console.error('请求重新生成缩略图失败 Failed to request thumbnail regeneration:', error);
      }
    }
  }
}
</script>

<style scoped>
/* 视频视图容器样式 Video view container styles */
.video-view {
  padding: 20px;          /* 内边距 Padding */
}

/* 视频网格样式 Video grid styles */
.video-grid {
  display: grid;          /* 网格布局 Grid layout */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));  /* 自适应列宽 Responsive columns */
  gap: 20px;             /* 网格间距 Grid gap */
  padding: 20px;         /* 内边距 Padding */
}

/* 视频项目样式 Video item styles */
.video-item {
  aspect-ratio: 16/9;    /* 宽高比 Aspect ratio */
  cursor: pointer;       /* 鼠标指针 Mouse cursor */
  transition: transform 0.2s;  /* 变换过渡 Transform transition */
  position: relative;    /* 相对定位 Relative positioning */
}

/* 视频项目悬停效果 Video item hover effect */
.video-item:hover {
  transform: scale(1.05);  /* 放大效果 Scale up effect */
}

/* 缩略图样式 Thumbnail styles */
.thumbnail {
  width: 100%;            /* 宽度 Width */
  height: 100%;           /* 高度 Height */
  object-fit: cover;      /* 填充方式 Object fit */
  border-radius: 8px;     /* 圆角边框 Rounded corners */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);  /* 阴影效果 Shadow effect */
}

/* 视频名称样式 Video name styles */
.video-name {
  margin-top: 8px;        /* 上边距 Margin top */
  font-size: 14px;        /* 字体大小 Font size */
  text-align: center;     /* 文字居中 Text alignment */
  color: #333;            /* 文字颜色 Text color */
}

/* 视频遮罩层样式 Video overlay styles */
.video-overlay {
  position: fixed;        /* 固定定位 Fixed positioning */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);  /* 半透明背景 Semi-transparent background */
  display: flex;          /* 弹性布局 Flex layout */
  justify-content: center;  /* 水平居中 Horizontal center */
  align-items: center;     /* 垂直居中 Vertical center */
  z-index: 1000;          /* 层级 Z-index */
}

/* 视频容器样式 Video container styles */
.video-container {
  position: relative;     /* 相对定位 Relative positioning */
  width: 80%;            /* 宽度 Width */
  max-width: 1000px;     /* 最大宽度 Maximum width */
  background: #000;      /* 背景颜色 Background color */
  border-radius: 8px;    /* 圆角边框 Rounded corners */
  overflow: hidden;      /* 溢出隐藏 Hide overflow */
  margin: 0 auto;        /* 居中显示 Center alignment */
}

/* 视频播放器样式 Video player styles */
.video-player {
  width: 100%;           /* 宽度 Width */
  height: auto;          /* 高度 Height */
  display: block;        /* 块级显示 Block display */
  aspect-ratio: 16/9;    /* 视频比例 Video aspect ratio */
}

/* 关闭按钮样式 Close button styles */
.close-button {
  position: absolute;    /* 绝对定位 Absolute positioning */
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;   /* 圆形按钮 Circular button */
  border: none;         /* 无边框 No border */
  background: rgba(255, 255, 255, 0.3);  /* 半透明背景 Semi-transparent background */
  color: white;         /* 文字颜色 Text color */
  font-size: 20px;     /* 字体大小 Font size */
  cursor: pointer;     /* 鼠标指针 Mouse cursor */
  display: flex;       /* 弹性布局 Flex layout */
  align-items: center; /* 垂直居中 Vertical center */
  justify-content: center;  /* 水平居中 Horizontal center */
  transition: background-color 0.2s;  /* 背景色过渡 Background transition */
  z-index: 1001;      /* 层级 Z-index */
}

/* 关闭按钮悬停效果 Close button hover effect */
.close-button:hover {
  background: rgba(255, 255, 255, 0.5);  /* 悬停背景色 Hover background color */
}
</style>