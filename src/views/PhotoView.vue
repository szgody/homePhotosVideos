<template>
  <!-- 照片视图容器 Photo view container -->
  <div class="photo-view">
    <h2>照片库 Photo Gallery</h2>
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div v-for="photo in photos" 
           :key="photo.filename" 
           class="photo-item"
           @click="showLargePhoto(photo)">
        <!-- 缩略图 Thumbnail - 使用API返回的thumbnail路径 -->
        <img :src="photo.thumbnail" 
             :alt="photo.filename || '照片'"
             class="thumbnail"
             @error="handleThumbnailError">
      </div>
    </div>

    <!-- 大图预览弹窗 Large photo preview modal -->
    <div v-if="showPreview" class="preview-overlay" @click="closePreview">
      <!-- 预览容器 Preview container -->
      <div class="preview-container" @click.stop>
        <!-- 大图 Large photo - 使用API返回的photo路径 -->
        <img :src="currentPhoto?.photo" 
             :alt="currentPhoto?.filename" 
             class="featured-image"
             @error="handleImageError">
        <!-- 关闭按钮 Close button -->
        <button class="close-button" @click="closePreview">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
// 导入外部样式
import '../styles/views/photo-view.css'

export default {
  name: 'PhotoView',
  data() {
    return {
      photos: [],
      showPreview: false,
      currentPhoto: null,
      baseUrl: import.meta.env.VITE_BASE_URL || 
               import.meta.env.VITE_API_BASE_URL || 
               import.meta.env.VITE_API_URL || 
               '',
      apiUrl: import.meta.env.VITE_API_URL || ''
    }
  },
  created() {
    this.fetchPhotos()
  },
  methods: {
    async fetchPhotos() {
      try {
        const apiUrl = this.apiUrl ? `${this.apiUrl}/photos` : '/api/photos';
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`获取照片列表失败 Failed to fetch photos: ${response.status}`);
        }
        const data = await response.json();
        
        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos;
        } else {
          this.photos = [];
        }
      } catch (error) {
        console.error('获取照片失败 Failed to fetch photos:', error.message);
        this.photos = [];
      }
    },
    showLargePhoto(photo) {
      this.currentPhoto = photo;
      this.showPreview = true;
      // 禁用滚动
      document.body.style.overflow = 'hidden';
    },
    closePreview() {
      this.showPreview = false;
      this.currentPhoto = null;
      // 恢复滚动
      document.body.style.overflow = '';
    },
    handleThumbnailError(e) {
      console.error('缩略图加载失败 Thumbnail load failed:', e.target.src);
      e.target.src = `${this.baseUrl}/assets/default-thumbnail.jpg`;
    },
    handleImageError(e) {
      console.error('图片加载失败 Image load failed:', e.target.src);
      if (this.currentPhoto && this.currentPhoto.thumbnail) {
        e.target.src = this.currentPhoto.thumbnail;
      } else {
        e.target.src = `${this.baseUrl}/assets/default-photo.jpg`;
      }
    }
  }
}
</script>