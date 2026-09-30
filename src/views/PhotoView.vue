<template>
  <!-- 照片视图容器 Photo view container -->
  <div class="photo-view">
    <h2>照片库 Photo Gallery</h2>
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div
        v-for="photo in photos"
        :key="photo.filename"
        class="photo-item"
        @click="showLargePhoto(photo)"
      >
        <!-- 缩略图 Thumbnail - 使用API返回的thumbnail路径 -->
        <img
          :src="photo.thumbnail"
          :alt="photo.filename || '照片'"
          class="thumbnail"
          @error="handleThumbnailError"
        />
      </div>
    </div>

    <!-- 大图预览弹窗 Large photo preview modal -->
    <Transition name="photo-preview">
      <div
        v-if="showPreview"
        class="preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="照片预览"
        @click.self="closePreview"
      >
        <!-- 预览容器 Preview container -->
        <div class="preview-container" @click.stop>
          <!-- 关闭按钮 Close button:固定于容器右上角,始终可见 -->
          <button
            type="button"
            class="preview-close"
            aria-label="关闭预览"
            @click="closePreview"
          >
            &times;
          </button>

          <!-- 图片舞台 Image stage -->
          <div class="preview-stage">
            <!-- 加载中骨架 Loading skeleton -->
            <div v-if="imageLoading && !imageFailed" class="preview-skeleton">
              加载中… Loading…
            </div>
            <!-- 加载失败提示 Load error hint -->
            <div v-else-if="imageFailed" class="preview-error">
              图片加载失败,请检查文件是否存在,或稍后重试。
            </div>
            <!-- 大图 Large photo - 使用API返回的photo路径 -->
            <img
              v-show="!imageFailed"
              :src="currentPhoto?.photo"
              :alt="currentPhoto?.filename"
              class="featured-image"
              @load="handleImageLoad"
              @error="handleImageError"
            />
            <!-- 上一张 Previous photo(列表首尾循环 wraps around) -->
            <button
              v-if="photos.length > 1"
              type="button"
              class="preview-nav preview-nav--prev"
              aria-label="上一张照片"
              @click.stop="showPreviousPhoto"
            >
              &#8249;
            </button>
            <!-- 下一张 Next photo(列表首尾循环 wraps around) -->
            <button
              v-if="photos.length > 1"
              type="button"
              class="preview-nav preview-nav--next"
              aria-label="下一张照片"
              @click.stop="showNextPhoto"
            >
              &#8250;
            </button>
          </div>

          <!-- 底部信息栏 Bottom info bar:文件名 + 序号 -->
          <div class="preview-info">
            <span class="preview-filename" :title="currentPhoto?.filename">
              {{ currentPhoto?.filename }}
            </span>
            <!-- 移动端切换按钮 Mobile prev/next buttons -->
            <span v-if="photos.length > 1" class="preview-nav-inline">
              <button
                type="button"
                aria-label="上一张照片"
                @click.stop="showPreviousPhoto"
              >
                &#8249;
              </button>
              <button
                type="button"
                aria-label="下一张照片"
                @click.stop="showNextPhoto"
              >
                &#8250;
              </button>
            </span>
            <span class="preview-counter">{{ currentPosition }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
// 导入外部样式
import "../styles/views/photo-view.css";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";

// 占位图路径 Placeholder image path
const PLACEHOLDER_IMAGE = "/assets/placeholder.svg";

export default {
  name: "PhotoView",
  data() {
    return {
      photos: [],
      showPreview: false,
      currentPhoto: null,
      currentIndex: 0, // 当前照片在列表中的下标 Index of the current photo
      // 大图加载状态 Large image loading state
      imageLoading: false,
      imageFailed: false,
      imageStage: 0, // 0=原图 1=缩略图 2=占位图 Degrade stage
      // 打开预览前 body 的 overflow 原值 Original body overflow before opening
      previousBodyOverflow: "",
      bodyOverflowLocked: false,
    };
  },
  computed: {
    // 底部序号文本,如 3 / 12 Counter text such as 3 / 12
    currentPosition() {
      return this.photos.length
        ? `${this.currentIndex + 1} / ${this.photos.length}`
        : "0 / 0";
    },
  },
  created() {
    this.fetchPhotos();
  },
  mounted() {
    // 键盘事件在组件挂载后监听,未打开弹窗时内部直接返回
    // Keyboard events: listening while mounted, guarded by the preview state
    window.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount() {
    // 卸载时移除监听并还原滚动,避免内存泄漏与滚动锁定残留
    // Remove listeners and restore scroll on unmount to avoid leaks / stuck scroll lock
    window.removeEventListener("keydown", this.handleKeydown);
    this.unlockBodyScroll();
  },
  methods: {
    async fetchPhotos() {
      try {
        const data = await apiGet("/photos");

        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos;
        } else {
          this.photos = [];
        }
      } catch (error) {
        console.error("获取照片失败 Failed to fetch photos:", error.message);
        this.photos = [];
      }
    },
    // 打开大图预览 Open the large photo preview
    showLargePhoto(photo) {
      const index = this.photos.findIndex(
        (item) => item.filename === photo.filename,
      );
      this.currentIndex = index > -1 ? index : 0;
      this.openCurrentPhoto();
      this.showPreview = true;
      this.lockBodyScroll();
    },
    // 按当前下标装载大图 Load the photo for the current index
    openCurrentPhoto() {
      const nextPhoto = this.photos[this.currentIndex] || null;
      const previousSrc = this.currentPhoto ? this.currentPhoto.photo : null;
      this.currentPhoto = nextPhoto;
      // 同一张图不重复进入加载态(不会再次触发 load 事件)
      // Same source: keep it out of the loading state (no load event will fire)
      const isSameSource = Boolean(nextPhoto) && nextPhoto.photo === previousSrc;
      this.imageLoading = !isSameSource;
      this.imageFailed = false;
      this.imageStage = 0;
    },
    // 上一张,到首张后循环至末张 Previous photo, wraps to the last one
    showPreviousPhoto() {
      if (this.photos.length <= 1) return;
      this.currentIndex =
        (this.currentIndex - 1 + this.photos.length) % this.photos.length;
      this.openCurrentPhoto();
    },
    // 下一张,到末张后循环至首张 Next photo, wraps to the first one
    showNextPhoto() {
      if (this.photos.length <= 1) return;
      this.currentIndex = (this.currentIndex + 1) % this.photos.length;
      this.openCurrentPhoto();
    },
    closePreview() {
      this.showPreview = false;
      this.currentPhoto = null;
      this.imageLoading = false;
      this.imageFailed = false;
      this.imageStage = 0;
      this.unlockBodyScroll();
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
    // 键盘:Escape 关闭,左右方向键切换(弹窗未打开时不响应)
    // Keyboard: Escape closes, arrows navigate (ignored while the preview is closed)
    handleKeydown(event) {
      if (!this.showPreview) return;

      if (event.key === "Escape") {
        this.closePreview();
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
    handleThumbnailError(e) {
      console.error("缩略图加载失败 Thumbnail load failed:", e.target.src);
      e.target.src = PLACEHOLDER_IMAGE;
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
