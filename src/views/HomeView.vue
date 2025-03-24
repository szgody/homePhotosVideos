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
          v-for="photo in displayPhotos.slice(0, 2)"
          :key="photo.filename"
          class="featured-item"
          @click="showPreview(photo)"
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

    <!-- 照片预览模态框 Photo preview modal -->
    <div v-if="previewVisible" class="preview-overlay" @click="closePreview">
      <div class="preview-container">
        <img
          :src="
            previewPhoto?.photo ||
            `${apiUrl.value}${photosPath.value}/${previewPhoto?.filename}`
          "
          :alt="previewPhoto?.filename"
          class="preview-image"
          @error="handlePreviewError"
        />
        <button class="close-button" @click="closePreview">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
// 导入所需的 Vue 功能和组件 Import required Vue features and components
import { ref, computed, onMounted } from "vue";
import AppHeader from "../components/AppHeader.vue";
import PhotoGrid from "../components/PhotoGrid.vue";
import VideoGrid from "../components/VideoGrid.vue";
// 导入外部样式文件
import "../styles/views/home-view.css";

export default {
  name: "HomeView", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    AppHeader, // 页头组件 Header component
    PhotoGrid, // 照片网格组件 Photo grid component
    VideoGrid, // 视频网格组件 Video grid component
  },

  // 组件设置 Component setup
  setup() {
    // 环境变量设置 Environment variable settings
    const apiUrl = ref(import.meta.env.VITE_API_URL || "");
    const photosPath = ref(import.meta.env.VITE_PHOTOS_PATH || "/photos");
    const videosPath = ref(import.meta.env.VITE_VIDEOS_PATH || "/videos");
    const videoThumbnailsPath = ref(
      import.meta.env.VITE_VIDEO_THUMBNAILS_PATH || "/video_thumbnails",
    );
    const photoThumbnailsPath = ref(
      import.meta.env.VITE_PHOTO_THUMBNAILS_PATH || "/photo_thumbnails",
    );
    // 状态定义 State definitions
    const photos = ref([]); // 照片列表 Photo list
    const loadedImages = ref(0); // 已加载图片数 Loaded images count
    const errorImages = ref(0); // 加载失败图片数 Failed images count
    const debug = ref(false); // 调试模式关闭 Debug mode off
    const displayCount = ref(8); // 显示照片数量 Number of photos to display
    const latestVideos = ref([]); // 最新视频 Latest videos
    // 添加预览相关状态
    const previewVisible = ref(false); // 预览是否可见
    const previewPhoto = ref(null); // 当前预览的照片

    // 计算属性：随机选择照片 Computed property: randomly select photos
    const displayPhotos = computed(() => {
      return [...photos.value]
        .sort(() => Math.random() - 0.5)
        .slice(0, displayCount.value);
    });

    // 组件挂载时获取照片 Fetch photos when component is mounted
    onMounted(async () => {
      try {
        const response = await fetch(`${apiUrl.value}/photos`);

        if (!response.ok) {
          throw new Error("获取照片列表失败 Failed to get photo list");
        }

        const data = await response.json();

        if (data && Array.isArray(data.photos)) {
          photos.value = data.photos;
        } else {
          photos.value = [];
        }
      } catch (error) {
        console.error("加载照片失败 Failed to load photos:", error.message);
        photos.value = [];
      }

      // 获取最新视频 Fetch latest videos
      fetchLatestVideos();
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

    // 获取最新视频的方法 Fetch latest videos method
    const fetchLatestVideos = async () => {
      try {
        // 使用相对路径或完整路径 Use relative or complete path
        const response = await fetch(`${apiUrl.value}/videos?limit=4`);
        if (!response.ok) {
          throw new Error(
            `获取视频失败 Failed to get videos: ${response.status}`,
          );
        }

        const data = await response.json();
        latestVideos.value = data.videos || [];

        // 检查并修复缩略图路径 Check and fix thumbnail paths
        latestVideos.value.forEach((video) => {
          if (
            video.thumbnailPath &&
            video.thumbnailPath.startsWith(apiUrl.value)
          ) {
            // 替换为相对路径 Replace with relative path
            video.thumbnailPath = video.thumbnailPath.replace(
              new RegExp(`^${apiUrl.value}`),
              "",
            );
          }
        });
      } catch (error) {
        console.error(
          "获取最新视频失败 Failed to fetch latest videos:",
          error.message,
        );
        latestVideos.value = [];
      }
    };

    // 格式化缩略图路径 Format thumbnail path
    const formatThumbnailPath = (path) => {
      // 首先，移除可能的 API 基础 URL 前缀 First, remove possible API base URL prefix
      let newPath = path.replace(new RegExp(`^${apiUrl.value}`), "");

      // 然后，修复文件名，将 .mp4.jpg 替换为 .jpg Then, fix filename, replace .mp4.jpg with .jpg
      return newPath.replace(/\.(mp4|webm|avi|mov)\.jpg$/i, ".jpg");
    };

    // 处理缩略图加载错误 Handle thumbnail load error
    const handleThumbnailError = (event, video) => {
      if (video && video.thumbnailPath) {
        const fixedPath = formatThumbnailPath(video.thumbnailPath);
        if (event.target.src !== `${apiUrl.value}${fixedPath}`) {
          event.target.src = `${apiUrl.value}${fixedPath}`;
        } else {
          // 如果修复后仍然失败，使用默认图片 If still fails after fixing, use default image
          event.target.src = `${apiUrl.value}/assets/default-video-thumbnail.jpg`;
        }
      } else {
        // 没有视频对象时使用默认图片 Use default image when no video object
        event.target.src = `${apiUrl.value}/assets/default-video-thumbnail.jpg`;
      }
    };

    // 显示照片预览 Show photo preview
    const showPreview = (photo) => {
      previewPhoto.value = photo;
      previewVisible.value = true;
      // 禁止背景滚动
      document.body.style.overflow = "hidden";
    };

    // 关闭照片预览 Close photo preview
    const closePreview = () => {
      previewVisible.value = false;
      previewPhoto.value = null;
      // 恢复背景滚动
      document.body.style.overflow = "";
    };

    // 处理预览图片加载错误 Handle preview image load error
    const handlePreviewError = (e) => {
      console.error(
        "预览图片加载失败 Preview image load failed:",
        e.target.src,
      );
      // 尝试使用缩略图
      if (previewPhoto.value && previewPhoto.value.thumbnail) {
        e.target.src = previewPhoto.value.thumbnail;
      }
    };

    // 返回组件数据和方法 Return component data and methods
    return {
      photos,
      displayPhotos,
      loadedImages,
      errorImages,
      debug,
      latestVideos,
      handleImageLoad,
      handleImageError,
      fetchLatestVideos,
      formatThumbnailPath,
      handleThumbnailError,
      apiUrl,
      photosPath,
      videosPath,
      videoThumbnailsPath,
      photoThumbnailsPath,
      // 添加预览相关状态和方法
      previewVisible,
      previewPhoto,
      showPreview,
      closePreview,
      handlePreviewError,
    };
  },
};
</script>
