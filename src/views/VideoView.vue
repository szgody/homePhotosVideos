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
        v-for="video in videos"
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

    <!-- 视频播放弹窗:使用共享播放器组件(空格/←/→/Esc 快捷键)Shared video player modal -->
    <VideoPlayerModal
      v-if="showPlayer"
      :video="selectedVideo"
      @close="closePlayer"
    />
  </div>
</template>

<script>
// 导入共享视频播放器 Import the shared video player
import VideoPlayerModal from "../components/media/VideoPlayerModal.vue";
// 导入外部 CSS 样式文件
import "../styles/views/video-view.css";
// 导入视频处理状态
import {
  isVideoProcessing,
  isVideoSession,
} from "../composables/useProcessing.js";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";
import { computed } from "vue";

export default {
  name: "VideoView", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    VideoPlayerModal, // 共享播放器组件 Shared player component
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
      previousProcessingState: false, // 跟踪之前的处理状态
    };
  },

  // 计算属性
  // 说明:处理中的半成品不会再进入 /api/videos(后端两阶段提交),
  // 因此这里不再需要「处理中隐藏最新视频」的旧启发式 —— 那会把已完成的老视频一起隐藏
  computed: {},

  // 组件创建时执行 Execute when component is created
  created() {
    this.fetchVideos();
  },

  // 组件挂载后
  mounted() {
    // 弹窗快捷键(Esc/空格/←/→)由共享播放器组件自行监听
    // Modal shortcuts (Esc/Space/←/→) are owned by the shared player component

    // 添加状态变化检测,当处理状态变化时刷新视频列表
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
        const data = await apiGet("/videos");

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

    // 播放视频(滚动锁与暂停逻辑由共享播放器负责)
    // Play video (scroll lock and pause are owned by the shared player)
    playVideo(video) {
      this.selectedVideo = video;
      this.showPlayer = true;
    },

    // 关闭播放器(暂停 + 重置进度由共享播放器负责)
    // Close player (pause + reset are owned by the shared player)
    closePlayer() {
      this.showPlayer = false;
      this.selectedVideo = null;
    },

    // 处理缩略图加载错误 Handle thumbnail loading error
    handleThumbnailError(event, video) {
      // 设置为默认缩略图 Set default thumbnail
      event.target.src = "/assets/placeholder.svg";
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
