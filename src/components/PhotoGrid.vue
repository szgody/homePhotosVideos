<template>
  <!-- 照片容器 Photo container -->
  <div class="photo-container">
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div
        v-for="(photo, index) in displayPhotos"
        :key="photo.filename"
        class="photo-item"
        @click="showLargePhoto(index)"
      >
        <!-- 照片缩略图 Photo thumbnail - 使用API返回的thumbnail路径 -->
        <img
          :src="photo.thumbnail"
          :alt="photo.filename"
          class="thumbnail-photo"
          @error="$emit('thumbnail-error', photo.filename)"
        />
      </div>
    </div>

    <!-- 大图预览弹窗:使用共享灯箱组件(支持 ←/→ 切换)Large photo preview: shared lightbox -->
    <PhotoLightbox
      v-if="showPreview"
      :photos="displayPhotos"
      :start-index="previewIndex"
      @close="closePreview"
    />
  </div>
</template>

<script>
// 导入外部 CSS 样式
import "../styles/components/photo-grid.css";
// 导入共享照片灯箱 Import the shared photo lightbox
import PhotoLightbox from "./media/PhotoLightbox.vue";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";

export default {
  name: "PhotoGrid", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    PhotoLightbox, // 共享灯箱组件 Shared lightbox component
  },

  // 组件数据 Component data
  data() {
    return {
      photos: [], // 照片数组 Array of photos
      displayCount: 8, // 显示照片数量 Number of photos to display
      totalPhotos: 0, // 照片总数 Total number of photos
      showPreview: false, // 是否显示预览 Whether to show preview
      previewIndex: 0, // 当前预览下标 Current preview index
    };
  },

  // 计算属性 Computed properties
  computed: {
    // 要显示的照片列表 Photos to display
    displayPhotos() {
      // 随机排序并截取指定数量的照片 Randomly sort and slice photos
      return [...this.photos]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.displayCount);
    },
  },

  // 组件创建时执行 Execute when component is created
  async created() {
    await this.fetchPhotos(); // 获取照片数据 Fetch photos data
  },

  // 组件方法 Component methods
  methods: {
    // 获取照片数据 Fetch photos data
    async fetchPhotos() {
      try {
        const data = await apiGet("/photos");

        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos;
          this.totalPhotos = data.total || data.photos.length;
        } else {
          console.warn("PhotoGrid: 数据格式不正确");
          this.photos = [];
        }
      } catch (error) {
        console.error("PhotoGrid: 获取照片失败:", error);
        this.photos = [];
      }
    },

    // 显示大图(用 displayPhotos 的下标,保证灯箱内可左右切换)
    // Show the large photo at the given displayPhotos index (enables prev/next)
    showLargePhoto(index) {
      this.previewIndex = typeof index === "number" ? index : 0;
      this.showPreview = true;
    },

    // 关闭预览 Close preview
    closePreview() {
      this.showPreview = false;
    },
  },
};
</script>
