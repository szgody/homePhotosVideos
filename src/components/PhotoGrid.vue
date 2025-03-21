<template>
  <!-- 照片容器 Photo container -->
  <div class="photo-container">
    <!-- 照片网格布局 Photo grid layout -->
    <div class="photo-grid">
      <!-- 遍历照片列表 Iterate through photos -->
      <div v-for="photo in displayPhotos" 
           :key="photo.filename" 
           class="photo-item"
           @click="showLargePhoto(photo)">
        <!-- 照片缩略图 Photo thumbnail -->
        <img :src="`${photoThumbnailsPath}/${photo.filename}`" 
          :alt="photo.filename"
          class="thumbnail-photo"
          @error="$emit('thumbnail-error', photo.filename)">
      </div>
    </div>
    
    <!-- 大图预览弹窗 Large photo preview modal -->
    <div v-if="showPreview" class="preview-overlay" @click="closePreview">
      <!-- 预览容器 Preview container -->
      <div class="preview-container" @click.stop>
        <!-- 大图 Large photo -->
        <img :src="currentPhoto?.photo || `${apiUrl}/photos/${currentPhoto?.filename}`" 
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
// 导入外部 CSS 样式
import '../styles/components/photo-grid.css'

// 组件配置 Component configuration
const apiUrl = import.meta.env.VITE_API_URL;
const baseUrl = import.meta.env.VITE_BASE_URL || '';
const mediaPath = import.meta.env.VITE_MEDIA_PATH;
const photosPath = import.meta.env.VITE_PHOTOS_PATH;

export default {
  name: 'PhotoGrid', // 组件名称 Component name

  // 组件数据 Component data
  data() {
    return {
      apiUrl: import.meta.env.VITE_API_URL || '',
      photoThumbnailsPath: import.meta.env.VITE_PHOTO_THUMBNAILS_PATH || '/photo_thumbnails',
      photosPath: import.meta.env.VITE_PHOTOS_PATH || '/photos',
      photos: [],          // 照片数组 Array of photos
      displayCount: 8,     // 显示照片数量 Number of photos to display
      totalPhotos: 0,      // 照片总数 Total number of photos
      showPreview: false,  // 是否显示预览 Whether to show preview
      currentPhoto: null,  // 当前照片 Current photo
      baseUrl: import.meta.env.VITE_BASE_URL || 
               import.meta.env.VITE_API_BASE_URL || 
               import.meta.env.VITE_API_URL || 
               ''
    }
  },

  // 计算属性 Computed properties
  computed: {
    // 要显示的照片列表 Photos to display
    displayPhotos() {
      // 随机排序并截取指定数量的照片 Randomly sort and slice photos
      return [...this.photos]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.displayCount)
    }
  },

  // 组件创建时执行 Execute when component is created
  async created() {
    await this.fetchPhotos() // 获取照片数据 Fetch photos data
  },

  // 组件方法 Component methods
  methods: {
    // 获取照片数据 Fetch photos data
    async fetchPhotos() {
      try {
        console.log('PhotoGrid: 开始获取照片')
        const response = await fetch(`${this.apiUrl}/photos`)
        console.log('PhotoGrid: API响应状态:', response.status)
        
        if (!response.ok) {
          throw new Error('获取照片列表失败')
        }

        const data = await response.json()
        console.log('PhotoGrid: 获取到的数据:', data)
        
        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos
          this.totalPhotos = data.total || data.photos.length
          console.log('PhotoGrid: 照片数量:', this.photos.length)
        } else {
          console.warn('PhotoGrid: 数据格式不正确')
          this.photos = []
        }
      } catch (error) {
        console.error('PhotoGrid: 获取照片失败:', error)
        this.photos = []
      }
    },
    
    // 显示大图 Show large photo
    showLargePhoto(photo) {
      this.currentPhoto = photo;
      this.showPreview = true;
      // 禁用滚动 Disable scrolling
      document.body.style.overflow = 'hidden';
    },
    
    // 关闭预览 Close preview
    closePreview() {
      this.showPreview = false;
      this.currentPhoto = null;
      // 恢复滚动 Restore scrolling
      document.body.style.overflow = '';
    },
    
    // 处理图片错误 Handle image error
    handleImageError(e) {
      console.error('图片加载失败 Image load failed:', e.target.src);
      if (this.currentPhoto && this.currentPhoto.thumbnail) {
        e.target.src = this.currentPhoto.thumbnail;
      } else if (this.currentPhoto && this.currentPhoto.filename) {
        e.target.src = `${this.apiUrl}${this.photoThumbnailsPath}/${this.currentPhoto.filename}`;
      } else {
        e.target.src = `${this.baseUrl}/assets/default-photo.jpg`;
      }
    }
  }
}
</script>