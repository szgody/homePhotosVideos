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
        <img :src="video.thumbnailPath" 
             :alt="video.filename"
             class="thumbnail"
             @error="handleThumbnailError($event, video)">
        <!-- 显示视频名称 Display video name -->
        <div class="video-name">{{ formatVideoName(video.filename) }}</div>
        <!-- 播放图标 Play icon -->
        <div class="play-icon">▶</div>
      </div>
    </div>

    <!-- 视频播放弹窗 Video player modal -->
    <div v-if="showPlayer" class="video-overlay" @click="closePlayer">
      <!-- 视频容器 Video container -->
      <div class="video-container" @click.stop>
        <!-- 视频播放器 Video player -->
        <video 
          ref="videoPlayer"
          controls
          autoplay
          class="video-player"
          @error="handleVideoError">
          <source :src="selectedVideo?.videoPath" type="video/mp4">
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
// 导入外部 CSS 样式文件
import '../styles/views/video-view.css'

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
      apiUrl: import.meta.env.VITE_API_URL || '',  // API URL
      baseUrl: import.meta.env.VITE_BASE_URL || ''  // 基础 URL
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
        // 构建API URL
        const apiEndpoint = this.apiUrl ? `${this.apiUrl}/videos` : '/api/videos';
        
        const response = await fetch(apiEndpoint);
        if (!response.ok) {
          throw new Error(`获取视频列表失败 Failed to get video list: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 验证和处理数据
        if (data && Array.isArray(data.videos)) {
          this.videos = data.videos;
        } else {
          this.videos = [];
        }
      } catch (error) {
        console.error('获取视频失败:', error.message);
        this.videos = [];
      }
    },

    // 播放视频 Play video
    playVideo(video) {
      this.selectedVideo = video;
      this.showPlayer = true;
      
      // 禁用背景滚动
      document.body.style.overflow = 'hidden';
    },

    // 关闭播放器 Close player
    closePlayer() {
      if (this.$refs.videoPlayer) {
        this.$refs.videoPlayer.pause();  // 暂停视频播放 Pause video playback
      }
      this.showPlayer = false;
      this.selectedVideo = null;
      
      // 恢复背景滚动
      document.body.style.overflow = '';
    },

    // 处理缩略图加载错误 Handle thumbnail loading error
    handleThumbnailError(event, video) {
      // 设置为默认缩略图 Set default thumbnail
      event.target.src = `${this.baseUrl}/assets/default-video-thumbnail.jpg`;
    },
    
    // 处理视频加载错误 Handle video loading error
    handleVideoError(event) {
      alert('很抱歉，视频加载失败。可能是视频格式不兼容或文件损坏。');
    },
    
    // 格式化视频文件名 Format video filename
    formatVideoName(filename) {
      // 去除扩展名 Remove extension
      return filename ? filename.replace(/\.[^/.]+$/, "") : '未命名视频 Unnamed Video';
    }
  }
}
</script>