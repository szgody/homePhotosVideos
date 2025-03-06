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
        <!-- 缩略图 Thumbnail -->
        <img :src="`${baseUrl}/thumbnails/${photo.filename}`" 
             :alt="photo.filename || '照片'"
             class="thumbnail">
      </div>
    </div>

    <!-- 大图预览弹窗 Large photo preview modal -->
    <div v-if="showPreview" class="preview-overlay" @click="closePreview">
      <!-- 预览容器 Preview container -->
      <div class="preview-container" @click.stop>
        <!-- 大图 Large photo -->
        <img :src="`${baseUrl}/photos/${selectedPhoto.filename}`" 
             :alt="selectedPhoto.filename"
             class="large-photo">
        <!-- 关闭按钮 Close button -->
        <button class="close-button" @click="closePreview">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PhotoView', // 组件名称 Component name

  // 组件数据 Component data
  data() {
    return {
      photos: [],          // 照片列表 Photo list
      showPreview: false,  // 是否显示预览 Show preview flag
      selectedPhoto: null, // 选中的照片 Selected photo
      baseUrl: import.meta.env.VITE_BASE_URL || 
               import.meta.env.VITE_API_BASE_URL || 
               import.meta.env.VITE_API_URL || 
               process.env.VUE_APP_BASE_URL ||
               process.env.VUE_APP_API_BASE_URL || 
               '' // 从环境变量获取API URL
    }
  },

  // 组件创建时执行 Execute when component is created
  created() {
    // 打印 baseUrl 以检查是否正确设置
    console.log('Base URL:', this.baseUrl)
    this.fetchPhotos()
  },

  // 组件方法 Component methods
  methods: {
    // 获取照片列表 Fetch photo list
    async fetchPhotos() {
      try {
        // 修复 URL 构建逻辑，防止重复的 /api 路径
        const apiUrl = this.baseUrl ? `${this.baseUrl}/api/photos` : '/api/photos';
        console.log('正在从以下地址获取照片 Fetching photos from:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`获取照片列表失败 Failed to fetch photos: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        if (data && Array.isArray(data.photos)) {
          this.photos = data.photos;
          console.log('获取到的照片数量 Retrieved photos count:', this.photos.length);
        } else {
          console.warn('返回数据格式不完整，使用空数组 Invalid data format, using empty array');
          this.photos = [];
        }
      } catch (error) {
        console.error('获取照片失败 Failed to fetch photos:', error);
        this.photos = [];
      }
    },

    // 显示大图 Show large photo
    showLargePhoto(photo) {
      this.selectedPhoto = photo
      this.showPreview = true
    },

    // 关闭预览 Close preview
    closePreview() {
      this.showPreview = false
      this.selectedPhoto = null
    }
  }
}
</script>

<style scoped>
/* 照片视图容器样式 Photo view container styles */
.photo-view {
  padding: 20px;
}

/* 照片网格样式 Photo grid styles */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 100px)); /* 固定网格列宽 Fixed grid column width */
  gap: 10px; /* 网格间距 Grid gap */
  padding: 20px;
  justify-content: center; /* 网格居中 Center grid */
}

/* 照片项目样式 Photo item styles */
.photo-item {
  width: 100%;          /* 固定宽度 Fixed width */
  height: 100px;        /* 固定高度 Fixed height */
  cursor: pointer;      /* 鼠标指针 Mouse cursor */
  transition: transform 0.2s; /* 变换过渡效果 Transform transition */
  position: relative;   /* 相对定位 Relative positioning */
}

/* 照片项目悬停效果 Photo item hover effect */
.photo-item:hover {
  transform: scale(1.05); /* 放大效果 Scale up effect */
}

/* 缩略图样式 Thumbnail styles */
.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;    /* 图片填充方式 Image fill mode */
  border-radius: 8px;   /* 圆角边框 Rounded corners */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* 阴影效果 Shadow effect */
}

/* 预览遮罩层样式 Preview overlay styles */
.preview-overlay {
  position: fixed;      /* 固定定位 Fixed positioning */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9); /* 半透明背景 Semi-transparent background */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;       /* 层级 Z-index */
}

/* 预览容器样式 Preview container styles */
.preview-container {
  position: relative;   /* 相对定位 Relative positioning */
  padding: 20px;
  background: #fff;    /* 白色背景 White background */
  border-radius: 8px;  /* 圆角边框 Rounded corners */
}

/* 大图样式 Large photo styles */
.large-photo {
  max-width: 800px;    /* 最大宽度 Maximum width */
  max-height: 90vh;    /* 最大高度 Maximum height */
  object-fit: contain; /* 图片适应容器 Image fit container */
  display: block;
}

/* 关闭按钮样式 Close button styles */
.close-button {
  position: absolute;   /* 绝对定位 Absolute positioning */
  top: -15px;
  right: -15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;  /* 圆形按钮 Circular button */
  border: none;
  background: #fff;
  color: #333;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2); /* 按钮阴影 Button shadow */
}

/* 关闭按钮悬停效果 Close button hover effect */
.close-button:hover {
  background: #f0f0f0; /* 悬停背景色 Hover background color */
}
</style>