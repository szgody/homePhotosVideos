const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;  // 修改为 3000 或确保 PM2 环境变量设置正确

// 启用 CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 提供 Vue 应用的静态文件
app.use(express.static(path.join(__dirname, 'dist')));

// 确保 photos 和 thumbnails 目录存在
const photosDir = path.join(__dirname, 'data/photos');
const thumbnailsDir = path.join(__dirname, 'data/photo_thumbnails');
const videosDir = path.join(__dirname, 'data/videos');
const videoThumbnailsDir = path.join(__dirname, 'data/video_thumbnails');

if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
  console.log('创建照片目录:', photosDir);
}

if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
  console.log('创建缩略图目录:', thumbnailsDir);
}

// 确保视频目录存在
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
  console.log('创建视频目录:', videosDir);
}

if (!fs.existsSync(videoThumbnailsDir)) {
  fs.mkdirSync(videoThumbnailsDir, { recursive: true });
  console.log('创建视频缩略图目录:', videoThumbnailsDir);
}

// 提供照片和缩略图的静态文件
app.use('/photos', express.static(photosDir));
app.use('/thumbnails', express.static(thumbnailsDir));

// 提供视频和缩略图的静态文件
app.use('/videos', express.static(videosDir));
app.use('/video-thumbnails', express.static(videoThumbnailsDir));

// API 端点 - 获取照片列表
app.get('/api/photos', (req, res) => {
  try {
    console.log('请求照片 API，目录路径:', photosDir);
    const files = fs.readdirSync(photosDir);
    const photos = files
      .filter(file => {
        // 只包含图片文件
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(filename => ({ 
        filename,
        path: `/photos/${filename}`,
        thumbnailPath: `/thumbnails/${filename}`,
      }));
    
    console.log(`从 ${photosDir} 找到 ${photos.length} 张照片`);
    res.json({ photos });
  } catch (error) {
    console.error('获取照片列表失败:', error);
    res.status(500).json({ error: '获取照片列表失败', message: error.message });
  }
});

// API 端点 - 获取视频列表
app.get('/api/videos', (req, res) => {
  try {
    const files = fs.readdirSync(videosDir);
    const videos = files
      .filter(file => {
        // 只包含视频文件
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.webm', '.mov', '.avi'].includes(ext);
      })
      .map(filename => ({ 
        filename,
        path: `/videos/${filename}`,
        thumbnailPath: `/video-thumbnails/${filename.replace(/\.[^/.]+$/, ".jpg")}`,
      }));
    
    res.json({ videos });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ error: '获取视频列表失败' });
  }
});

// 添加测试 API 端点
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// 处理 SPA 路由 - 将所有其他请求重定向到 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 监听所有接口上的请求
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});
