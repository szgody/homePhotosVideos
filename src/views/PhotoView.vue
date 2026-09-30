<template>
  <!-- 照片视图容器 Photo view container -->
  <div class="photo-view">
    <h2>照片库 Photo Gallery</h2>
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div
        v-for="(photo, index) in photos"
        :key="photo.filename"
        class="photo-item"
        @click="showLargePhoto(index)"
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

    <!-- 大图预览弹窗:使用共享灯箱组件 Large photo preview: shared lightbox component -->
    <PhotoLightbox
      v-if="showPreview"
      :photos="photos"
      :start-index="currentIndex"
      @close="closePreview"
    />
  </div>
</template>

<script>
// 导入外部样式
import "../styles/views/photo-view.css";
// 导入共享照片灯箱 Import the shared photo lightbox
import PhotoLightbox from "../components/media/PhotoLightbox.vue";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";

// 占位图路径 Placeholder image path
const PLACEHOLDER_IMAGE = "/assets/placeholder.svg";

export default {
  name: "PhotoView",

  // 注册子组件 Register child components
  components: {
    PhotoLightbox, // 共享灯箱组件 Shared lightbox component
  },

  data() {
    return {
      photos: [],
      showPreview: false,
      currentIndex: 0, // 当前照片在列表中的下标 Index of the current photo
    };
  },
  created() {
    this.fetchPhotos();
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
    // 打开大图预览(滚动锁、键盘切换与图片降级由共享灯箱负责)
    // Open the large preview (scroll lock, keys and degrade are owned by the lightbox)
    showLargePhoto(index) {
      this.currentIndex = typeof index === "number" ? index : 0;
      this.showPreview = true;
    },
    // 关闭预览 Close the preview
    closePreview() {
      this.showPreview = false;
    },
    handleThumbnailError(e) {
      console.error("缩略图加载失败 Thumbnail load failed:", e.target.src);
      e.target.src = PLACEHOLDER_IMAGE;
    },
  },
};
</script>
