const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;  // 添加 Promise 风格的 fs
const cors = require('cors');

// 初始化全局变量
global.videoProgressData = {};
global.activeFFmpegProcesses = {};
global.processingCancelled = {};

const app = express();
const PORT = process.env.PORT || 3000;

// 启用 CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 提供 Vue 应用的静态文件
app.use(express.static(path.join(__dirname, 'dist')));

// 在其他中间件之后添加
app.use(express.json());  // 解析JSON请求体

// 数据目录路径 - 使用绝对路径避免混淆
const DATA_DIR = path.join(__dirname, 'data');
const photosDir = path.join(DATA_DIR, 'photos');
const thumbnailsDir = path.join(DATA_DIR, 'photo_thumbnails');
const videosDir = path.join(DATA_DIR, 'videos');
const videoThumbnailsDir = path.join(DATA_DIR, 'video_thumbnails');
const VIDEO_SN_FILE_PATH = path.join(__dirname, 'data', 'videos', 'sn.txt'); // 视频序号文件
const ORIGINAL_VIDEOS_DIR = path.join(__dirname, 'public', 'original', 'videos'); // 原始视频目录

// 确保所有目录存在
[DATA_DIR, photosDir, thumbnailsDir, videosDir, videoThumbnailsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
});

// 确保序号文件目录路径正确
const SN_FILE_PATH = path.join(__dirname, 'data', 'photos', 'sn.txt');
const ORIGINAL_IMAGES_DIR = path.join(__dirname, 'public', 'original', 'images');

// 确保原始图片目录存在
if (!fs.existsSync(ORIGINAL_IMAGES_DIR)) {
  fs.mkdirSync(ORIGINAL_IMAGES_DIR, { recursive: true });
  console.log('创建原始图片目录:', ORIGINAL_IMAGES_DIR);
}

// 确保原始视频目录存在
if (!fs.existsSync(ORIGINAL_VIDEOS_DIR)) {
  fs.mkdirSync(ORIGINAL_VIDEOS_DIR, { recursive: true });
  console.log('创建原始视频目录:', ORIGINAL_VIDEOS_DIR);
}

// 提供静态文件
app.use('/photos', express.static(photosDir));
app.use('/thumbnails', express.static(thumbnailsDir));
app.use('/videos', express.static(videosDir));
app.use('/video-thumbnails', express.static(videoThumbnailsDir));

// API 端点 - 获取照片列表
app.get('/api/photos', (req, res) => {
  try {
    console.log('请求照片 API，目录路径:', photosDir);
    console.log('目录是否存在:', fs.existsSync(photosDir));
    
    // 列出目录内容
    const dirContents = fs.readdirSync(photosDir);
    console.log('目录内容:', dirContents);
    
    const photos = dirContents
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

// 修复视频 API 端点
app.get('/api/videos', (req, res) => {
  try {
    // 获取查询参数，如果有 limit 参数，则限制返回的视频数量
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    
    console.log('请求视频 API，目录路径:', videosDir, '限制:', limit);
    console.log('目录是否存在:', fs.existsSync(videosDir));
    
    // 确保视频目录存在
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }
    
    // 确保缩略图目录存在
    if (!fs.existsSync(videoThumbnailsDir)) {
      fs.mkdirSync(videoThumbnailsDir, { recursive: true });
    }
    
    // 列出目录内容
    const files = fs.readdirSync(videosDir);
    const videos = [];
    
    for (const file of files) {
      // 检查是否是视频文件
      const ext = path.extname(file).toLowerCase();
      if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
        // 获取不带扩展名的文件名作为基础名
        const baseName = path.basename(file, ext);
        
        // 构建缩略图路径（jpg格式）
        const thumbnailFile = `${baseName}.jpg`;  // 不包含视频扩展名
        const thumbnailPath = path.join(videoThumbnailsDir, thumbnailFile);
        
        // 检查缩略图是否存在，如果不存在则创建
        if (!fs.existsSync(thumbnailPath)) {
          console.log(`缩略图不存在，正在为 ${file} 创建缩略图`);
          // 创建缩略图
          try {
            const videoPath = path.join(videosDir, file);
            createVideoThumbnail(thumbnailPath, videoPath);
          } catch (thumbError) {
            console.error(`为视频 ${file} 创建缩略图失败:`, thumbError);
          }
        }
        
        // 添加到视频列表（使用相对路径）
        videos.push({ 
          filename: file,
          path: `/videos/${file}`,
          thumbnailPath: `/video-thumbnails/${thumbnailFile}`,  // 使用正确的缩略图文件名
        });
      }
    }
    
    // 如果设置了 limit，则限制返回的视频数量，并按名称排序（通常是从最新到最旧）
    const sortedVideos = videos.sort((a, b) => b.filename.localeCompare(a.filename));
    const limitedVideos = limit ? sortedVideos.slice(0, limit) : sortedVideos;
    
    console.log(`从 ${videosDir} 找到 ${videos.length} 个视频，返回 ${limitedVideos.length} 个视频`);
    res.json({ videos: limitedVideos });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ error: '获取视频列表失败', message: error.message });
  }
});

// API: 获取待处理图片列表 - 使用原始图片目录
app.get('/api/list-images', async (req, res) => {
  try {
    // 确保目录存在
    if (!fs.existsSync(ORIGINAL_IMAGES_DIR)) {
      await fsPromises.mkdir(ORIGINAL_IMAGES_DIR, { recursive: true });
    }
    
    // 读取目录中的文件
    const files = await fsPromises.readdir(ORIGINAL_IMAGES_DIR);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
    
    console.log(`找到 ${imageFiles.length} 张待处理图片`);
    res.json({ files: imageFiles });
  } catch (error) {
    console.error('获取图片列表失败:', error);
    res.status(500).json({ error: '获取图片列表失败', message: error.message });
  }
});

// API: 读取序号 - 从 data/photos/sn.txt 读取
app.get('/api/read-sn', (req, res) => {
  try {
    console.log('请求读取序号，文件路径:', SN_FILE_PATH);
    
    // 确保序号文件存在
    if (!fs.existsSync(SN_FILE_PATH)) {
      // 创建目录（如果需要）
      const snDir = path.dirname(SN_FILE_PATH);
      if (!fs.existsSync(snDir)) {
        fs.mkdirSync(snDir, { recursive: true });
      }
      // 创建默认序号文件
      fs.writeFileSync(SN_FILE_PATH, '000000');
      console.log('创建默认序号文件:', SN_FILE_PATH);
    }
    
    // 读取序号文件(同步)
    const sn = fs.readFileSync(SN_FILE_PATH, 'utf8');
    console.log('读取到序号:', sn.trim());
    res.json({ sn: sn.trim() });
  } catch (error) {
    console.error('读取序号失败:', error);
    res.status(500).json({ error: '读取序号失败', message: error.message });
  }
});

// 更新写入序号端点
app.use(express.json());  // 添加这行来解析 JSON 请求体

app.post('/api/write-sn', (req, res) => {
  try {
    const { sn } = req.body;
    console.log('请求写入序号:', sn);
    
    if (!sn || typeof sn !== 'string') {
      return res.status(400).json({ error: '无效的序号' });
    }
    
    // 确保目录存在
    const snDir = path.dirname(SN_FILE_PATH);
    if (!fs.existsSync(snDir)) {
      fs.mkdirSync(snDir, { recursive: true });
    }
    
    // 写入序号文件(同步)
    fs.writeFileSync(SN_FILE_PATH, sn);
    console.log('写入序号成功:', sn);
    res.json({ success: true });
  } catch (error) {
    console.error('写入序号失败:', error);
    res.status(500).json({ error: '写入序号失败', message: error.message });
  }
});

// API: 处理单个图片 - 从原始目录移动到 data/photos 并重命名
app.post('/api/process-single-image', (req, res) => {
  try {
    const { filename, newName } = req.body;
    console.log('请求处理图片:', filename, '->', newName);
    
    if (!filename || !newName) {
      return res.status(400).json({ error: '文件名和新名称不能为空' });
    }
    
    // 构建文件路径
    const sourcePath = path.join(ORIGINAL_IMAGES_DIR, filename);
    const destPath = path.join(photosDir, `${newName}.jpg`);
    const destThumbPath = path.join(thumbnailsDir, `${newName}.jpg`);
    
    console.log('源路径:', sourcePath);
    console.log('目标路径:', destPath);
    console.log('缩略图路径:', destThumbPath);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      console.error('源文件不存在:', sourcePath);
      return res.status(404).json({ error: '源文件不存在', path: sourcePath });
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
    
    // 复制原图到目标位置(同步)
    fs.copyFileSync(sourcePath, destPath);
    
    // 为缩略图生成一个较小的版本
    try {
      fs.copyFileSync(sourcePath, destThumbPath);
      console.log('缩略图创建成功');
      
      // 处理完成后，删除原始文件
      fs.unlinkSync(sourcePath);
      console.log('已删除原始文件:', sourcePath);
      
    } catch (thumbError) {
      console.error('生成缩略图失败:', thumbError);
    }
    
    console.log(`处理图片成功: ${filename} -> ${newName}.jpg`);
    res.json({ 
      success: true,
      message: `处理成功: ${filename} -> ${newName}.jpg (已删除原始文件)` 
    });
  } catch (error) {
    console.error('处理图片失败:', error);
    res.status(500).json({ error: '处理图片失败', message: error.message });
  }
});

// 列出待处理视频的 API
app.get('/api/list-videos', (req, res) => {
  try {
    console.log('请求原始视频列表，目录路径:', ORIGINAL_VIDEOS_DIR);
    
    // 确保目录存在
    if (!fs.existsSync(ORIGINAL_VIDEOS_DIR)) {
      fs.mkdirSync(ORIGINAL_VIDEOS_DIR, { recursive: true });
    }
    
    // 读取目录中的文件
    const files = fs.readdirSync(ORIGINAL_VIDEOS_DIR);
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.webm', '.mov', '.avi'].includes(ext);
    });
    
    console.log(`找到 ${videoFiles.length} 个待处理视频:`, videoFiles);
    res.json({ files: videoFiles });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ error: '获取视频列表失败', message: error.message });
  }
});

// 修改读取视频序号的 API，改为使用 app.all 同时支持 GET 和 POST 请求
app.all('/api/read-video-sn', (req, res) => {
  try {
    console.log('请求读取视频序号，文件路径:', VIDEO_SN_FILE_PATH);
    console.log('请求方法:', req.method);
    
    // 确保序号文件存在
    if (!fs.existsSync(VIDEO_SN_FILE_PATH)) {
      // 创建目录（如果需要）
      const snDir = path.dirname(VIDEO_SN_FILE_PATH);
      if (!fs.existsSync(snDir)) {
        fs.mkdirSync(snDir, { recursive: true });
      }
      // 创建默认序号文件
      fs.writeFileSync(VIDEO_SN_FILE_PATH, '000000');
      console.log('创建默认视频序号文件:', VIDEO_SN_FILE_PATH);
    }
    
    // 读取序号文件(同步)
    const sn = fs.readFileSync(VIDEO_SN_FILE_PATH, 'utf8');
    console.log('读取到视频序号:', sn.trim());
    
    // 根据请求方法返回不同格式的响应
    if (req.method === 'POST') {
      res.send(sn.trim());  // 直接返回文本
    } else {
      res.json({ sn: sn.trim() });  // 返回 JSON
    }
  } catch (error) {
    console.error('读取视频序号失败:', error);
    
    if (req.method === 'POST') {
      res.status(500).send('读取视频序号失败');
    } else {
      res.status(500).json({ error: '读取视频序号失败', message: error.message });
    }
  }
});

// 写入视频序号的 API
app.post('/api/write-video-sn', (req, res) => {
  try {
    const { sn } = req.body;
    console.log('请求写入视频序号:', sn);
    
    if (!sn || typeof sn !== 'string') {
      return res.status(400).json({ error: '无效的序号' });
    }
    
    // 确保目录存在
    const snDir = path.dirname(VIDEO_SN_FILE_PATH);
    if (!fs.existsSync(snDir)) {
      fs.mkdirSync(snDir, { recursive: true });
    }
    
    // 写入序号文件(同步)
    fs.writeFileSync(VIDEO_SN_FILE_PATH, sn);
    console.log('写入视频序号成功:', sn);
    res.json({ success: true });
  } catch (error) {
    console.error('写入视频序号失败:', error);
    res.status(500).json({ error: '写入视频序号失败', message: error.message });
  }
});

// 修复处理单个视频的 API，确保使用正确的缩略图文件名
app.post('/api/process-single-video', (req, res) => {
  try {
    // 兼容两种参数格式
    const { filename, newName, sn } = req.body;
    const videoNewName = newName || sn;
    
    console.log('请求处理视频:', filename, '->', videoNewName);
    
    if (!filename || !videoNewName) {
      return res.status(400).json({ error: '文件名和新名称不能为空' });
    }
    
    // 构建文件路径
    const sourcePath = path.join(ORIGINAL_VIDEOS_DIR, filename);
    const destPath = path.join(videosDir, `${videoNewName}.mp4`);
    const destThumbPath = path.join(videoThumbnailsDir, `${videoNewName}.jpg`);  // 不要包含 .mp4
    
    console.log('源路径:', sourcePath);
    console.log('目标路径:', destPath);
    console.log('缩略图路径:', destThumbPath);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      console.error('源视频文件不存在:', sourcePath);
      return res.status(404).json({ error: '源视频文件不存在', path: sourcePath });
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }
    if (!fs.existsSync(videoThumbnailsDir)) {
      fs.mkdirSync(videoThumbnailsDir, { recursive: true });
    }
    
    // 复制视频到目标位置(同步)
    fs.copyFileSync(sourcePath, destPath);
    
    // 为视频生成一个缩略图 (使用 FFmpeg)
    createVideoThumbnail(destThumbPath, destPath);
    console.log('视频缩略图创建成功');
    
    // 处理完成后，删除原始文件
    fs.unlinkSync(sourcePath);
    console.log('已删除原始视频文件:', sourcePath);
    
    // 通知客户端处理完成
    if (io) {
      io.emit('videoProgress', {
        type: 'end',
        filename,
        newName: videoNewName
      });
    }
    
    console.log(`处理视频成功: ${filename} -> ${videoNewName}.mp4`);
    res.json({ 
      success: true,
      message: `处理成功: ${filename} -> ${videoNewName}.mp4 (已删除原始文件)` 
    });
  } catch (error) {
    console.error('处理视频失败:', error);
    
    // 通知客户端处理失败
    if (io) {
      io.emit('videoProgress', {
        type: 'error',
        filename: req.body?.filename || '未知文件',
        error: error.message
      });
    }
    
    res.status(500).json({ error: '处理视频失败', message: error.message });
  }
});

// 修改删除所有原始视频接口
app.post('/api/delete-all-original-videos', async (req, res) => {
  try {
    console.log('收到删除所有原始视频请求');
    
    // 确保目录存在
    const originalVideosDir = PATHS.ORIGINAL_VIDEOS;
    console.log(`原始视频目录路径: ${originalVideosDir}`);
    
    await fs.ensureDir(originalVideosDir);
    
    // 读取原始视频目录
    const files = await fs.readdir(originalVideosDir);
    console.log(`找到 ${files.length} 个文件`);
    
    // 过滤出视频文件
    const videoFiles = files.filter(file => /\.(mp4|avi|mov|wmv|mkv)$/i.test(file));
    console.log(`其中 ${videoFiles.length} 个是视频文件`);
    
    // 如果没有视频，直接返回
    if (videoFiles.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        alreadyClean: true,
        message: '原始视频目录已经是空的，没有需要删除的视频'
      });
    }
    
    // ... 其余代码保持不变 ...
  } catch (error) {
    console.error('删除原始视频失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 修改删除所有原始图片接口
app.post('/api/delete-all-original-images', async (req, res) => {
  try {
    // 确保目录存在
    await fs.ensureDir(PATHS.ORIGINAL_IMAGES);
    
    // 读取原始图片目录
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    
    // 过滤出图片文件
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
    
    // 如果没有图片，直接返回
    if (imageFiles.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        alreadyClean: true,
        message: '原始图片目录已经是空的，没有需要删除的图片'
      });
    }
    
    // ... 其余代码保持不变 ...
  } catch (error) {
    console.error('删除原始图片失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 增强创建视频缩略图的函数，使用更安全的路径处理
function createVideoThumbnail(thumbPath, videoPath) {
  const { execSync } = require('child_process');
  
  try {
    console.log('尝试为视频创建缩略图:', videoPath);
    
    // 使用 FFmpeg 从视频的第 1 秒提取一帧作为缩略图
    // 使用单引号而不是双引号，避免特殊字符问题
    const command = `ffmpeg -i '${videoPath.replace(/'/g, "'\\''")}' -ss 00:00:01 -vframes 1 -s 320x240 -f image2 '${thumbPath.replace(/'/g, "'\\''")}' -y`;
    console.log('执行命令:', command);
    
    execSync(command);
    console.log('使用 FFmpeg 创建视频缩略图成功');
    return true;
  } catch (error) {
    console.error('使用 FFmpeg 创建视频缩略图失败:', error);
    
    // 失败后创建一个简单的占位缩略图
    try {
      // 创建一个更有意义的缩略图数据
      // 这里使用一个简单的 1x1 像素的 JPEG 图像数据
      const dummyData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 
        0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
        0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 
        0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xC4, 0x00, 
        0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
        0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 
        0x00, 0x37, 0xFF, 0xD9
      ]);
      fs.writeFileSync(thumbPath, dummyData);
      console.log('创建简单占位缩略图成功');
      return true;
    } catch (fallbackError) {
      console.error('创建简单占位缩略图也失败:', fallbackError);
      return false;
    }
  }
}

// 添加测试 API 端点
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// 替换为直接提供 index.html，如果您想使用 Vue Router 处理根路径
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 处理 SPA 路由 - 将所有其他请求重定向到 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 创建 HTTP 服务器
const server = require('http').createServer(app);

// 设置 Socket.IO
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 处理 Socket.IO 连接
io.on('connection', (socket) => {
  console.log('Socket.IO 客户端已连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Socket.IO 客户端已断开:', socket.id);
  });
});

// 使用 server 而不是 app 监听端口
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`照片目录: ${photosDir}`);
});
