<template>
  <!-- 首页容器 Home container -->
  <div class="home">
    <!-- 主要内容区域 Main content area -->
    <div class="content">
      <!-- 最新视频部分 Latest videos section -->
      <div class="grid-section">
        <h3 class="section-title">最新视频 Latest Videos</h3>
        <VideoGrid :display-count="4" sort-by="date" />
      </div>

      <!-- 最新照片部分 Latest photos section -->
      <div class="grid-section">
        <h3 class="section-title">最新照片 Latest Photos</h3>
        <PhotoGrid />
      </div>

      <!-- 查看更多按钮 View more buttons -->
      <div class="view-more">
        <router-link to="/photo" class="button"
          >查看更多照片 View More Photos</router-link
        >
        <router-link to="/video" class="button"
          >查看更多视频 View More Videos</router-link
        >
      </div>
    </div>

    <!-- 精选照片区域 Featured photos area -->
    <div class="featured-photos">
      <h2>精选照片 Featured Photos</h2>
      <div class="featured-grid">
        <div
          v-for="(photo, index) in displayPhotos.slice(0, 2)"
          :key="photo.filename"
          class="featured-item"
          @click="openLightbox(index)"
        >
          <img
            :src="photo.photo || photo.thumbnail"
            :alt="photo.filename"
            class="featured-image"
            @load="handleImageLoad"
            @error="handleImageError"
          />
        </div>
      </div>
    </div>

    <!-- 精选照片预览:共享灯箱(支持 ←/→ 切换、Esc 关闭)Featured preview: shared lightbox -->
    <PhotoLightbox
      v-if="lightboxVisible"
      :photos="displayPhotos"
      :start-index="lightboxIndex"
      @close="closeLightbox"
    />
  </div>
</template>

<script>
// 导入所需的 Vue 功能和组件 Import required Vue features and components
import { ref, computed, onMounted } from "vue";
import AppHeader from "../components/AppHeader.vue";
import PhotoGrid from "../components/PhotoGrid.vue";
import VideoGrid from "../components/VideoGrid.vue";
// 导入共享照片灯箱 Import the shared photo lightbox
import PhotoLightbox from "../components/media/PhotoLightbox.vue";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";
// 导入外部样式文件
import "../styles/views/home-view.css";

export default {
  name: "HomeView", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    AppHeader, // 页头组件 Header component
    PhotoGrid, // 照片网格组件 Photo grid component
    VideoGrid, // 视频网格组件 Video grid component
    PhotoLightbox, // 共享灯箱组件 Shared lightbox component
  },

  // 组件设置 Component setup
  setup() {
    // 状态定义 State definitions
    const photos = ref([]); // 照片列表 Photo list
    const loadedImages = ref(0); // 已加载图片数 Loaded images count
    const errorImages = ref(0); // 加载失败图片数 Failed images count
    const debug = ref(false); // 调试模式关闭 Debug mode off
    const displayCount = ref(8); // 显示照片数量 Number of photos to display
    // 共享灯箱状态(挂载即打开,关闭由子组件通知父组件卸载)
    // Shared lightbox state (mounting opens it, closing is notified by the child)
    const lightboxVisible = ref(false); // 灯箱是否可见 Lightbox visibility
    const lightboxIndex = ref(0); // 被点击照片的下标 Index of the clicked photo

    // 计算属性：随机选择照片 Computed property: randomly select photos
    const displayPhotos = computed(() => {
      return [...photos.value]
        .sort(() => Math.random() - 0.5)
        .slice(0, displayCount.value);
    });

    // 组件挂载时获取照片 Fetch photos when component is mounted
    onMounted(async () => {
      try {
        const data = await apiGet("/photos");

        if (data && Array.isArray(data.photos)) {
          photos.value = data.photos;
        } else {
          photos.value = [];
        }
      } catch (error) {
        console.error("加载照片失败 Failed to load photos:", error.message);
        photos.value = [];
      }
    });

    // 图片加载成功处理 Handle successful image load
    const handleImageLoad = () => {
      loadedImages.value++;
      if (debug.value) {
        console.log(
          "图片加载成功，已加载 Image loaded successfully, total loaded:",
          loadedImages.value,
        );
      }
    };

    // 图片加载失败处理 Handle image load error
    const handleImageError = (e) => {
      errorImages.value++;
      console.error("图片加载失败 Image load failed:", e.target.src);
    };

    // 打开灯箱(滚动锁 / 键盘切换 / 图片降级由共享灯箱负责),打开的是被点击的那张
    // Open the lightbox at the clicked index (scroll lock / keys / degrade are shared)
    const openLightbox = (index) => {
      lightboxIndex.value = typeof index === "number" ? index : 0;
      lightboxVisible.value = true;
    };

    // 关闭灯箱 Close the lightbox
    const closeLightbox = () => {
      lightboxVisible.value = false;
    };

    // 返回组件数据和方法 Return component data and methods
    return {
      photos,
      displayPhotos,
      loadedImages,
      errorImages,
      debug,
      handleImageLoad,
      handleImageError,
      // 灯箱相关状态和方法 Lightbox state and methods
      lightboxVisible,
      lightboxIndex,
      openLightbox,
      closeLightbox,
    };
  },
};
</script>
