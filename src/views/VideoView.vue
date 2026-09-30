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
    <Transition name="video-modal">
      <div
        v-if="showPlayer"
        class="video-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="视频播放"
        @click.self="closePlayer"
      >
        <!-- 视频容器 Video container -->
        <div class="video-container" @click.stop>
          <!-- 顶部信息栏:文件名 + 关闭按钮(不遮挡控制条)Header: filename + close -->
          <div class="video-header">
            <span class="video-title" :title="selectedVideo?.filename">
              {{ selectedVideo?.filename }}
            </span>
            <button
              type="button"
              class="video-close"
              aria-label="关闭视频播放"
              @click="closePlayer"
            >
              &times;
            </button>
          </div>

          <!-- 播放器 stage Player stage -->
          <div class="video-stage">
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
          </div>

          <!-- 底部快捷键提示 Keyboard hint -->
          <div class="video-footer">
            <span class="video-hint"
              >空格 播放/暂停 · ← → 快退/快进 5 秒 · Esc 关闭</span
            >
          </div>
        </div>
      </div>
    </Transition>
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
} from "../composables/useProcessing.js";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";
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
      previousProcessingState: false, // 跟踪之前的处理状态
      // 打开播放器前 body 的 overflow 原值 Original body overflow before opening
      previousBodyOverflow: "",
      bodyOverflowLocked: false,
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
    // 键盘快捷键:仅弹窗打开时响应 Keyboard shortcuts: only active while playing
    window.addEventListener("keydown", this.handleKeydown);

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

    // 移除键盘监听,避免内存泄漏 Remove the key listener to avoid leaks
    window.removeEventListener("keydown", this.handleKeydown);

    // 卸载时停止播放并还原滚动 Stop playback and restore scroll on unmount
    const player = this.$refs.videoPlayer;
    if (player) {
      player.pause();
    }
    this.unlockBodyScroll();
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

    // 播放视频 Play video
    playVideo(video) {
      this.selectedVideo = video;
      this.showPlayer = true;

      // 禁用背景滚动并记录原值 Lock background scroll (remember original)
      this.lockBodyScroll();
    },

    // 关闭播放器:暂停 + 重置进度 Close player: pause and reset progress
    closePlayer() {
      const player = this.$refs.videoPlayer;
      if (player) {
        player.pause(); // 暂停视频播放 Pause video playback
        try {
          player.currentTime = 0; // 重置进度,避免后台继续播放/声音 Reset progress
        } catch (error) {
          // 元数据尚未就绪时忽略重置失败 Ignore failures before metadata is ready
          console.warn("重置视频进度失败 Reset video progress failed:", error.message);
        }
      }
      this.showPlayer = false;
      this.selectedVideo = null;

      // 还原背景滚动 Restore background scroll
      this.unlockBodyScroll();
    },

    // 播放 / 暂停 Toggle play / pause
    togglePlayback() {
      const player = this.$refs.videoPlayer;
      if (!player) return;

      if (player.paused) {
        // play() 返回 Promise,避免自动播放被拒时产生未捕获异常
        // play() returns a promise: swallow autoplay rejections
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((error) => {
            console.warn("播放被阻止 Playback blocked:", error.message);
          });
        }
      } else {
        player.pause();
      }
    },

    // 快退 / 快进指定秒数 Seek backwards / forwards by the given seconds
    seekBy(seconds) {
      const player = this.$refs.videoPlayer;
      if (!player || !Number.isFinite(player.duration)) return;

      const nextTime = Math.min(
        Math.max(player.currentTime + seconds, 0),
        player.duration,
      );
      player.currentTime = nextTime;
    },

    // 键盘:Esc 关闭、空格 播放/暂停、←/→ 快退/快进 5 秒
    // Keyboard: Esc close, Space play/pause, ←/→ seek ±5s
    handleKeydown(event) {
      if (!this.showPlayer) return;

      // 焦点在 <video> 上时交给原生控制条,避免与自身处理重复触发
      // When the video element is focused, let its native controls handle keys
      const isMediaTarget =
        event.target instanceof HTMLElement &&
        event.target.tagName === "VIDEO";

      if (event.key === "Escape") {
        this.closePlayer();
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        if (isMediaTarget) return;
        event.preventDefault(); // 阻止页面滚动 Prevent page scrolling
        this.togglePlayback();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (isMediaTarget) return;
        event.preventDefault();
        this.seekBy(-5);
        return;
      }
      if (event.key === "ArrowRight") {
        if (isMediaTarget) return;
        event.preventDefault();
        this.seekBy(5);
      }
    },

    // 锁定 body 滚动并记录原值 Lock body scroll and remember the original value
    lockBodyScroll() {
      if (this.bodyOverflowLocked) return;
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      this.bodyOverflowLocked = true;
    },

    // 还原 body 滚动为打开前的值 Restore the original body overflow value
    unlockBodyScroll() {
      if (!this.bodyOverflowLocked) return;
      document.body.style.overflow = this.previousBodyOverflow;
      this.bodyOverflowLocked = false;
    },

    // 处理缩略图加载错误 Handle thumbnail loading error
    handleThumbnailError(event, video) {
      // 设置为默认缩略图 Set default thumbnail
      event.target.src = "/assets/placeholder.svg";
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
