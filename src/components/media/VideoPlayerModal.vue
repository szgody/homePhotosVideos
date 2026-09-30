<template>
  <!-- 共享视频播放弹窗:挂载即打开,由父组件用 v-if 控制 Shared video player: opens on mount, toggled by the parent's v-if -->
  <Transition appear name="media-player" @after-leave="emitClose">
    <div
      v-if="!isClosing"
      class="media-player"
      role="dialog"
      aria-modal="true"
      aria-label="视频播放 Video player"
      @click.self="requestClose"
    >
      <!-- 播放器面板 Player panel -->
      <div class="media-player__panel" @click.stop>
        <!-- 顶部信息栏:文件名 + 关闭按钮(不遮挡控制条)Header: filename + close button -->
        <div class="media-player__header">
          <span class="media-player__title" :title="video?.filename">
            {{ video?.filename }}
          </span>
          <button
            type="button"
            class="media-player__close"
            aria-label="关闭视频播放 Close video player"
            @click="requestClose"
          >
            &times;
          </button>
        </div>

        <!-- 播放器舞台 16:9 Player stage -->
        <div class="media-player__stage">
          <video
            ref="videoPlayer"
            controls
            autoplay
            class="media-player__video"
            @error="handleVideoError"
          >
            <source :src="video?.videoPath" type="video/mp4" />
            您的浏览器不支持 HTML5 视频播放 Your browser does not support HTML5
            video
          </video>
        </div>

        <!-- 底部快捷键提示 Keyboard hint -->
        <div class="media-player__footer">
          <span class="media-player__hint"
            >空格 播放/暂停 · ← → 快退/快进 5 秒 · Esc 关闭</span
          >
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
// 导入共享播放器样式 Import shared player styles
import "../../styles/components/media-player.css";

// 快进/快退步长(秒) Seek step in seconds
const SEEK_STEP_SECONDS = 5;

// 离场动画兜底超时(毫秒),避免动画回调未触发时弹窗卡死
// Safety timeout for the leave animation, so the modal can never get stuck
const CLOSE_FALLBACK_MS = 500;

export default {
  name: "VideoPlayerModal", // 组件名称 Component name

  // 组件属性 Component props
  props: {
    // 视频对象,含 filename / videoPath Video object with filename / videoPath
    video: {
      type: Object,
      default: null,
    },
  },

  // 对外事件:请求父组件卸载本组件 Emitted when the parent should unmount this component
  emits: ["close"],

  data() {
    return {
      isClosing: false, // 是否正在播放离场动画 Whether the leave animation is running
      closeEmitted: false, // 是否已通知父组件关闭 Whether close has been emitted
      closeFallbackTimer: null, // 兜底定时器 Fallback timer
      // 打开前 body 的 overflow 原值 Original body overflow before opening
      previousBodyOverflow: "",
      bodyOverflowLocked: false,
    };
  },

  mounted() {
    window.addEventListener("keydown", this.handleKeydown);
    // 打开时锁定背景滚动 Opening locks the background scroll
    this.lockBodyScroll();
  },

  beforeUnmount() {
    // 卸载时移除监听、清理定时器、停止播放并还原滚动
    // Remove listeners / timers, stop playback and restore scroll on unmount
    window.removeEventListener("keydown", this.handleKeydown);
    if (this.closeFallbackTimer) {
      clearTimeout(this.closeFallbackTimer);
      this.closeFallbackTimer = null;
    }
    this.stopPlayback();
    this.unlockBodyScroll();
  },

  methods: {
    // 暂停并重置进度 Pause the video and reset its progress
    stopPlayback() {
      const player = this.$refs.videoPlayer;
      if (!player) return;
      player.pause(); // 暂停视频播放 Pause video playback
      try {
        player.currentTime = 0; // 重置进度,避免后台继续播放/声音 Reset progress
      } catch (error) {
        // 元数据尚未就绪时忽略重置失败 Ignore failures before metadata is ready
        console.warn(
          "重置视频进度失败 Reset video progress failed:",
          error.message,
        );
      }
    },

    // 请求关闭:先暂停视频并播放离场动画,动画结束后通知父组件卸载
    // Request close: pause first, play the leave animation, then ask the parent to unmount
    requestClose() {
      if (this.isClosing) return;
      this.stopPlayback();
      this.isClosing = true;
      this.closeFallbackTimer = setTimeout(
        this.emitClose,
        CLOSE_FALLBACK_MS,
      );
    },

    // 通知父组件关闭(幂等)Notify the parent to close (idempotent)
    emitClose() {
      if (this.closeFallbackTimer) {
        clearTimeout(this.closeFallbackTimer);
        this.closeFallbackTimer = null;
      }
      if (this.closeEmitted) return;
      this.closeEmitted = true;
      this.$emit("close");
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

    // 键盘:Esc 关闭、空格 播放/暂停、← / → 快退/快进 5 秒(关闭过程中忽略)
    // Keyboard: Esc close, Space play/pause, ←/→ seek ±5s (ignored while closing)
    handleKeydown(event) {
      if (this.isClosing) return;

      // 焦点在 <video> 上时交给原生控制条,避免与自身处理重复触发
      // When the video element is focused, let its native controls handle keys
      const isMediaTarget =
        event.target instanceof HTMLElement && event.target.tagName === "VIDEO";

      if (event.key === "Escape") {
        this.requestClose();
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
        this.seekBy(-SEEK_STEP_SECONDS);
        return;
      }
      if (event.key === "ArrowRight") {
        if (isMediaTarget) return;
        event.preventDefault();
        this.seekBy(SEEK_STEP_SECONDS);
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

    // 处理视频加载错误 Handle video loading error
    handleVideoError() {
      alert("很抱歉，视频加载失败。可能是视频格式不兼容或文件损坏。");
    },
  },
};
</script>
