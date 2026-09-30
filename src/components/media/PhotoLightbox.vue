<template>
  <!-- 共享照片灯箱:挂载即打开,由父组件用 v-if 控制 Shared photo lightbox: opens on mount, toggled by the parent's v-if -->
  <Transition appear name="media-lightbox" @after-leave="emitClose">
    <div
      v-if="!isClosing"
      class="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="照片预览 Photo preview"
      @click.self="requestClose"
    >
      <!-- 灯箱面板 Lightbox panel -->
      <div class="media-lightbox__panel" @click.stop>
        <!-- 关闭按钮 Close button:固定于面板右上角,始终可见 -->
        <button
          type="button"
          class="media-lightbox__close"
          aria-label="关闭预览 Close preview"
          @click="requestClose"
        >
          &times;
        </button>

        <!-- 图片舞台 Image stage -->
        <div class="media-lightbox__stage">
          <!-- 加载中骨架 Loading skeleton -->
          <div
            v-if="imageLoading && !imageFailed"
            class="media-lightbox__skeleton"
          >
            加载中… Loading…
          </div>
          <!-- 加载失败提示 Load error hint -->
          <div v-else-if="imageFailed" class="media-lightbox__error">
            图片加载失败,请检查文件是否存在,或稍后重试。
          </div>
          <!-- 大图 Large photo - 使用 API 返回的 photo 路径 -->
          <img
            v-show="!imageFailed"
            :src="currentPhoto?.photo"
            :alt="currentPhoto?.filename"
            class="media-lightbox__image"
            @load="handleImageLoad"
            @error="handleImageError"
          />
          <!-- 上一张 Previous photo(列表首尾循环 wraps around) -->
          <button
            v-if="hasMultiple"
            type="button"
            class="media-lightbox__nav media-lightbox__nav--prev"
            aria-label="上一张照片 Previous photo"
            @click.stop="showPreviousPhoto"
          >
            &#8249;
          </button>
          <!-- 下一张 Next photo(列表首尾循环 wraps around) -->
          <button
            v-if="hasMultiple"
            type="button"
            class="media-lightbox__nav media-lightbox__nav--next"
            aria-label="下一张照片 Next photo"
            @click.stop="showNextPhoto"
          >
            &#8250;
          </button>
        </div>

        <!-- 底部信息栏:文件名 + 序号 Bottom info bar: filename + counter -->
        <div class="media-lightbox__info">
          <span class="media-lightbox__filename" :title="currentPhoto?.filename">
            {{ currentPhoto?.filename }}
          </span>
          <!-- 移动端切换按钮 Mobile prev/next buttons -->
          <span v-if="hasMultiple" class="media-lightbox__nav-inline">
            <button
              type="button"
              aria-label="上一张照片 Previous photo"
              @click.stop="showPreviousPhoto"
            >
              &#8249;
            </button>
            <button
              type="button"
              aria-label="下一张照片 Next photo"
              @click.stop="showNextPhoto"
            >
              &#8250;
            </button>
          </span>
          <span class="media-lightbox__counter">{{ currentPosition }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
// 导入共享灯箱样式 Import shared lightbox styles
import "../../styles/components/media-lightbox.css";

// 占位图路径 Placeholder image path
const PLACEHOLDER_IMAGE = "/assets/placeholder.svg";

// 离场动画兜底超时(毫秒),避免动画回调未触发时弹窗卡死
// Safety timeout for the leave animation, so the modal can never get stuck
const CLOSE_FALLBACK_MS = 500;

export default {
  name: "PhotoLightbox", // 组件名称 Component name

  // 组件属性 Component props
  props: {
    // 照片列表,元素含 filename / photo / thumbnail Photo list
    photos: {
      type: Array,
      default: () => [],
    },
    // 初始下标 Initial index
    startIndex: {
      type: Number,
      default: 0,
    },
  },

  // 对外事件:请求父组件卸载本组件 Emitted when the parent should unmount this component
  emits: ["close"],

  data() {
    return {
      // 当前照片(用 data 保存,便于与上一张比较来源是否相同)
      // Current photo stored in data, so the previous source can be compared
      currentPhoto: null,
      currentIndex: 0, // 当前下标 Current index
      imageLoading: false, // 大图加载中 Large image loading
      imageFailed: false, // 大图加载失败 Large image failed
      imageStage: 0, // 0=原图 1=缩略图 2=占位图 Degrade stage
      isClosing: false, // 是否正在播放离场动画 Whether the leave animation is running
      closeEmitted: false, // 是否已通知父组件关闭 Whether close has been emitted
      closeFallbackTimer: null, // 兜底定时器 Fallback timer
      // 打开前 body 的 overflow 原值 Original body overflow before opening
      previousBodyOverflow: "",
      bodyOverflowLocked: false,
    };
  },

  computed: {
    // 是否有多张照片可切换 Whether there is more than one photo
    hasMultiple() {
      return this.photos.length > 1;
    },

    // 底部序号文本,如 3 / 12 Counter text such as 3 / 12
    currentPosition() {
      return this.photos.length
        ? `${this.currentIndex + 1} / ${this.photos.length}`
        : "0 / 0";
    },
  },

  watch: {
    // startIndex 变化时同步当前索引 Sync the index when startIndex changes
    startIndex(value) {
      this.goToIndex(value);
    },
  },

  created() {
    // 组件挂载即打开:初始化下标并装载大图
    // Mounted means opened: initialise the index and load the large photo
    this.currentIndex = this.clampIndex(this.startIndex);
    this.openCurrentPhoto();
  },

  mounted() {
    window.addEventListener("keydown", this.handleKeydown);
    // 打开时锁定背景滚动 Opening locks the background scroll
    this.lockBodyScroll();
  },

  beforeUnmount() {
    // 卸载时移除监听、清理定时器并还原滚动,避免内存泄漏与滚动锁定残留
    // Remove listeners / timers and restore scroll on unmount to avoid leaks
    window.removeEventListener("keydown", this.handleKeydown);
    if (this.closeFallbackTimer) {
      clearTimeout(this.closeFallbackTimer);
      this.closeFallbackTimer = null;
    }
    this.unlockBodyScroll();
  },

  methods: {
    // 把任意下标收敛到合法范围 Clamp any index into the valid range
    clampIndex(index) {
      if (!this.photos.length) return 0;
      const parsed = Number(index);
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      return Math.min(Math.floor(parsed), this.photos.length - 1);
    },

    // 跳转到指定下标并装载大图 Jump to the index and load its photo
    goToIndex(index) {
      const nextIndex = this.clampIndex(index);
      if (nextIndex === this.currentIndex) return;
      this.currentIndex = nextIndex;
      this.openCurrentPhoto();
    },

    // 按当前下标装载大图 Load the photo for the current index
    openCurrentPhoto() {
      const nextPhoto = this.photos[this.currentIndex] || null;
      const previousSrc = this.currentPhoto ? this.currentPhoto.photo : null;
      this.currentPhoto = nextPhoto;
      // 同一张图不重复进入加载态(不会再次触发 load 事件)
      // Same source: keep it out of the loading state (no load event will fire)
      const isSameSource =
        Boolean(nextPhoto) && nextPhoto.photo === previousSrc;
      this.imageLoading = !isSameSource && Boolean(nextPhoto);
      this.imageFailed = false;
      this.imageStage = 0;
    },

    // 上一张,到首张后循环至末张 Previous photo, wraps to the last one
    showPreviousPhoto() {
      if (!this.hasMultiple) return;
      this.currentIndex =
        (this.currentIndex - 1 + this.photos.length) % this.photos.length;
      this.openCurrentPhoto();
    },

    // 下一张,到末张后循环至首张 Next photo, wraps to the first one
    showNextPhoto() {
      if (!this.hasMultiple) return;
      this.currentIndex = (this.currentIndex + 1) % this.photos.length;
      this.openCurrentPhoto();
    },

    // 请求关闭:先播放离场动画,动画结束后再通知父组件卸载
    // Request close: play the leave animation first, then ask the parent to unmount
    requestClose() {
      if (this.isClosing) return;
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

    // 键盘:Escape 关闭,← / → 切换(关闭过程中忽略)
    // Keyboard: Escape closes, arrows navigate (ignored while closing)
    handleKeydown(event) {
      if (this.isClosing) return;

      if (event.key === "Escape") {
        this.requestClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.showPreviousPhoto();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.showNextPhoto();
      }
    },

    // 大图加载完成 Mark the large photo as loaded
    handleImageLoad() {
      this.imageLoading = false;
      this.imageFailed = false;
    },

    // 大图加载失败:依次降级 原图 → 缩略图 → 占位图,并给出中文提示
    // Image error: degrade original → thumbnail → placeholder with a friendly hint
    handleImageError(e) {
      console.error("图片加载失败 Image load failed:", e.target.src);
      if (this.imageStage === 0 && this.currentPhoto?.thumbnail) {
        this.imageStage = 1;
        e.target.src = this.currentPhoto.thumbnail;
        return;
      }
      this.imageStage = 2;
      this.imageLoading = false;
      this.imageFailed = true;
      e.target.src = PLACEHOLDER_IMAGE;
    },
  },
};
</script>
