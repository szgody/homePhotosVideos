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
        <img :src="`http://localhost:3000/video-thumbnails/${video.thumbnail}`" 
             :alt="video.name"
             class="thumbnail">
      </div>
    </div>

    <!-- 视频播放弹窗 Video player modal -->
    <div v-if="showPlayer" class="video-overlay" @click="closePlayer">
      <!-- 视频容器 Video container -->
      <div class="video-container" @click.stop>
        <!-- 视频播放器 Video player -->
        <video 
          ref="videoPlayer"
          :src="`http://localhost:3000/videos/${selectedVideo.videoFile}`"
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
      selectedVideo: null   // 选中的视频 Selected video
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
        const response = await fetch('http://localhost:3000/api/videos')
        if (!response.ok) {
          throw new Error('获取视频列表失败 Failed to get video list')
        }
        const data = await response.json()
        // 处理视频数据，添加缩略图和视频文件名 Process video data, add thumbnail and video filename
        this.videos = data.videos.map(video => ({
          ...video,
          thumbnail: `${video.filename}.jpg`,  // 缩略图文件名 Thumbnail filename
          videoFile: `${video.filename}.mp4`   // 视频文件名 Video filename
        }))
        console.log('处理后的视频数据 Processed video data:', this.videos)
      } catch (error) {
        console.error('获取视频失败 Failed to fetch videos:', error)
      }
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