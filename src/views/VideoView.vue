<template>
  <!-- 视频视图容器 Video view container -->
  <div class="video-view">
    <!-- 标题 Title -->
    <h2>视频库 Video Gallery</h2>

    <!-- 处理中提示 Processing notice -->
    <div v-if="isVideoProcessing" class="processing-notice">
      <div class="notice-content">
        <span class="processing-icon">⚙️</span>
        <span>正在处理新视频，最新视频将在处理完成后显示</span>
      </div>
    </div>

    <!-- 视频网格布局 Video grid layout -->
    <div class="video-grid">
      <!-- 使用过滤后的视频列表 Use filtered videos -->
      <div
        v-for="video in filteredVideos"
        :key="video.filename"
        class="video-item"
        @click="playVideo(video)"
      >
        <!-- 视频缩略图 Video thumbnail -->
        <img
          :src="video.thumbnailPath"
          :alt="video.filename"
          class="thumbnail"
          @error="handleThumbnailError($event, video)"
        />
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
          @error="handleVideoError"
        >
          <source :src="selectedVideo?.videoPath" type="video/mp4" />
          您的浏览器不支持 HTML5 视频播放 Your browser does not support HTML5
          video
        </video>
        <!-- 关闭按钮 Close button -->
        <button class="close-button" @click="closePlayer">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
// 导入视频网格组件 Import video grid component
import VideoGrid from "../components/VideoGrid.vue";
// 导入外部 CSS 样式文件
import "../styles/views/video-view.css";
// 导入视频处理状态
import {
  isVideoProcessing,
  isVideoSession,
} from "../components/SessionStorage.vue";
import { computed } from "vue";

export default {
  name: "VideoView", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    VideoGrid,
  },

  // 使用组合式API Setup function
  setup() {
    return {
      isVideoProcessing,
      isVideoSession, // 添加会话状态
    };
  },

  // 组件数据 Component data
  data() {
    return {
      videos: [], // 视频列表 Video list
      showPlayer: false, // 显示播放器标志 Show player flag
      selectedVideo: null, // 选中的视频 Selected video
      apiUrl: import.meta.env.VITE_API_URL || "", // API URL
      baseUrl: import.meta.env.VITE_BASE_URL || "", // 基础 URL
      previousProcessingState: false, // 跟踪之前的处理状态
    };
  },

  // 计算属性
  computed: {
    // 过滤后的视频列表 - 处理中隐藏最新视频
    filteredVideos() {
      console.log(
        "过滤视频，处理中状态:",
        this.isVideoProcessing,
        "会话状态:",
        this.isVideoSession,
      );
      // 使用会话状态 OR 处理状态来决定是否过滤视频
      if (
        (this.isVideoProcessing || this.isVideoSession) &&
        this.videos.length > 0
      ) {
        // 隐藏最新视频
        console.log("隐藏最新视频，保留之前的视频");
        return this.videos.slice(1);
      }
      return this.videos;
    },
  },

  // 组件创建时执行 Execute when component is created
  created() {
    this.fetchVideos();
  },

  // 组件挂载后
  mounted() {
    // 添加状态变化检测，当处理状态变化时刷新视频列表
    this.statusCheckInterval = setInterval(() => {
      // 如果任一状态发生变化
      if (
        this.previousProcessingState !==
        (this.isVideoProcessing || this.isVideoSession)
      ) {
        const currentState = this.isVideoProcessing || this.isVideoSession;
        console.log(
          "视频处理/会话状态已变更:",
          currentState ? "处理中" : "已完成",
        );
        this.previousProcessingState = currentState;

        // 如果处理刚完成，则刷新列表以显示新视频
        if (!currentState) {
          console.log("视频处理会话已完成，刷新视频列表");
          this.fetchVideos();
        }
      }
    }, 3000); // 每3秒检查一次
  },

  // 组件卸载前
  beforeUnmount() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  },

  // 组件方法 Component methods
  methods: {
    // 获取视频列表 Fetch video list
    async fetchVideos() {
      try {
        // 构建API URL
        const apiEndpoint = this.apiUrl
          ? `${this.apiUrl}/videos`
          : "/api/videos";

        const response = await fetch(apiEndpoint);
        if (!response.ok) {
          throw new Error(
            `获取视频列表失败 Failed to get video list: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();

        // 验证和处理数据
        if (data && Array.isArray(data.videos)) {
          this.videos = data.videos;
          console.log(
            `获取到${this.videos.length}个视频${this.isVideoProcessing ? "，但最新视频不显示" : ""}`,
          );
        } else {
          this.videos = [];
        }
      } catch (error) {
        console.error("获取视频失败:", error.message);
        this.videos = [];
      }
    },

    // 播放视频 Play video
    playVideo(video) {
      this.selectedVideo = video;
      this.showPlayer = true;

      // 禁用背景滚动
      document.body.style.overflow = "hidden";
    },

    // 关闭播放器 Close player
    closePlayer() {
      if (this.$refs.videoPlayer) {
        this.$refs.videoPlayer.pause(); // 暂停视频播放 Pause video playback
      }
      this.showPlayer = false;
      this.selectedVideo = null;

      // 恢复背景滚动
      document.body.style.overflow = "";
    },

    // 处理缩略图加载错误 Handle thumbnail loading error
    handleThumbnailError(event, video) {
      // 设置为默认缩略图 Set default thumbnail
      event.target.src = `${this.baseUrl}/assets/default-video-thumbnail.jpg`;
    },

    // 处理视频加载错误 Handle video loading error
    handleVideoError(event) {
      alert("很抱歉，视频加载失败。可能是视频格式不兼容或文件损坏。");
    },

    // 格式化视频文件名 Format video filename
    formatVideoName(filename) {
      // 去除扩展名 Remove extension
      return filename
        ? filename.replace(/\.[^/.]+$/, "")
        : "未命名视频 Unnamed Video";
    },
  },
};
</script>

<style>
/* 处理提示样式 */
.processing-notice {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  color: #856404;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
  text-align: center;
}

.notice-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.processing-icon {
  font-size: 1.2em;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
