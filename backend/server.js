// 导入必要的模块 Import required modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const Jimp = require('jimp');
const http = require('http');
const { Server } = require('socket.io');

// 创建Express应用和HTTP服务器 Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",  // 允许的跨域来源 Allowed CORS origin
    methods: ["GET", "POST"]          // 允许的HTTP方法 Allowed HTTP methods
  }
});

// 添加在服务器设置部分
app.use(cors({
  origin: '*',  // 或指定允许的域名
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 设置 ffmpeg 路径 Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// 定义路径常量 Define path constants
const PATHS = {
  ORIGINAL_IMAGES: path.join(__dirname, '../public/original/images'),    // 原始图片目录 Original images directory
  ORIGINAL_VIDEOS: path.join(__dirname, '../public/original/videos'),    // 原始视频目录 Original videos directory
  PHOTOS: path.join(__dirname, '../data/photos'),                       // 处理后的图片 Processed photos
  THUMBNAILS: path.join(__dirname, '../data/photo_thumbnails'),         // 图片缩略图 Photo thumbnails
  VIDEOS: path.join(__dirname, '../data/videos'),                       // 处理后的视频 Processed videos
  VIDEO_THUMBNAILS: path.join(__dirname, '../data/video_thumbnails'),   // 视频缩略图 Video thumbnails
  PHOTO_SN_FILE: path.join(__dirname, '../data/photos/sn.txt'),        // 照片序号文件 Photo serial number file
  VIDEO_SN_FILE: path.join(__dirname, '../data/videos/sn.txt')         // 视频序号文件 Video serial number file
};

// 启用中间件 Enable middleware
app.use(cors());                // 启用跨域支持 Enable CORS
app.use(express.json());        // 解析JSON请求体 Parse JSON request body

// 配置静态文件服务 Configure static file serving
app.use('/images', express.static(path.join(__dirname, '../public/images')));          // 静态图片 Static images
app.use('/photos', express.static(path.join(__dirname, '../data/photos')));           // 处理后的图片 Processed photos
app.use('/thumbnails', express.static(path.join(__dirname, '../data/photo_thumbnails'))); // 图片缩略图 Photo thumbnails
app.use('/videos', express.static(path.join(__dirname, '../data/videos')));           // 处理后的视频 Processed videos
app.use('/video-thumbnails', express.static(path.join(__dirname, '../data/video_thumbnails'))); // 视频缩略图 Video thumbnails

// 初始化目录和文件 Initialize directories and files
async function initializeDirectories() {
  try {
    // 确保所有必要的目录存在 Ensure all required directories exist
    await Promise.all([
      fs.ensureDir(PATHS.ORIGINAL_IMAGES),    // 原始图片目录 Original images directory
      fs.ensureDir(PATHS.ORIGINAL_VIDEOS),    // 原始视频目录 Original videos directory
      fs.ensureDir(PATHS.PHOTOS),             // 处理后的图片目录 Processed photos directory
      fs.ensureDir(PATHS.THUMBNAILS),         // 缩略图目录 Thumbnails directory
      fs.ensureDir(PATHS.VIDEOS),             // 处理后的视频目录 Processed videos directory
      fs.ensureDir(PATHS.VIDEO_THUMBNAILS)    // 视频缩略图目录 Video thumbnails directory
    ]);
    
    // 确保序号文件存在 Ensure serial number files exist
    if (!await fs.pathExists(PATHS.PHOTO_SN_FILE)) {
      await fs.writeFile(PATHS.PHOTO_SN_FILE, '000001');  // 创建照片序号文件 Create photo serial number file
    }
    if (!await fs.pathExists(PATHS.VIDEO_SN_FILE)) {
      await fs.writeFile(PATHS.VIDEO_SN_FILE, '000001');  // 创建视频序号文件 Create video serial number file
    }
    console.log('目录初始化完成 Directory initialization completed');
  } catch (error) {
    console.error('初始化失败 Initialization failed:', error);
    throw error;
  }
}

// 启动时初始化 Initialize on startup
initializeDirectories().catch(console.error);

// 修改图片处理路由 Modify image processing route
app.post('/api/process-images', async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));

    if (imageFiles.length === 0) {
      return res.json({ 
        message: '没有找到需要处理的图片', 
        results: [] 
      });
    }

    let currentSN = await fs.readFile(PATHS.PHOTO_SN_FILE, 'utf8');
    currentSN = currentSN.trim();
    const results = [];

    for (const file of imageFiles) {
      try {
        const ext = path.extname(file);
        const newName = `${currentSN}${ext}`;
        const originalPath = path.join(PATHS.ORIGINAL_IMAGES, file);
        
        // 使用 Jimp 处理图片 Use Jimp to process images
        const image = await Jimp.read(originalPath);
        
        // 处理原图 Process original image
        await image
          .clone()
          .scaleToFit(800, 600)
          .quality(80)
          .writeAsync(path.join(PATHS.PHOTOS, newName));

        // 生成缩略图 Generate thumbnail
        await image
          .clone()
          .cover(100, 100)
          .quality(60)
          .writeAsync(path.join(PATHS.THUMBNAILS, newName));

        // 删除原始文件 Delete original file
        await fs.remove(originalPath);

        results.push({
          originalName: file,
          newName: newName,
          sn: currentSN
        });

        currentSN = String(Number(currentSN) + 1).padStart(6, '0');
      } catch (error) {
        console.error(`处理图片 ${file} 失败:`, error);
        results.push({
          originalName: file,
          error: error.message
        });
      }
    }

    // 更新序号 Update serial number
    await fs.writeFile(PATHS.PHOTO_SN_FILE, currentSN);

    res.json({ 
      message: '处理完成', 
      results: results,
      nextSN: currentSN
    });

  } catch (error) {
    console.error('处理过程出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改视频处理路由 Modify video processing route
app.post('/api/process-videos', async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    const videoFiles = files.filter(file => /\.(mp4|avi|mov|wmv)$/i.test(file));

    if (videoFiles.length === 0) {
      return res.json({ 
        message: '没有找到需要处理的视频', 
        results: [] 
      });
    }

    let currentSN = await fs.readFile(PATHS.VIDEO_SN_FILE, 'utf8');
    currentSN = currentSN.trim();
    const results = [];

    // 立即发送响应，包含需要处理的视频数量 Immediately send response with the number of videos to be processed
    res.json({ 
      message: '开始处理视频',
      totalFiles: videoFiles.length,
      files: videoFiles
    });

  } catch (error) {
    console.error('处理过程出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改处理单个视频的路由 Modify route for processing a single video
app.post('/api/process-single-video', async (req, res) => {
  try {
    const { filename, sn } = req.body;
    const ext = '.mp4';
    const newName = `${sn}${ext}`;
    const originalPath = path.join(PATHS.ORIGINAL_VIDEOS, filename);
    const outputPath = path.join(PATHS.VIDEOS, newName);

    console.log('开始处理视频:', filename);

    // 处理视频 Process video
    await new Promise((resolve, reject) => {
      let lastProgress = 0;
      ffmpeg(originalPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 23',
          '-preset medium',
          '-c:a aac',
          '-b:a 128k'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg 命令:', commandLine);
          io.emit('videoProgress', {
            type: 'start',
            filename,
            command: commandLine
          });
        })
        .on('progress', (progress) => {
          if (progress.percent && Math.floor(progress.percent) > lastProgress) {
            lastProgress = Math.floor(progress.percent);
            console.log(`视频 ${filename} 处理进度: ${lastProgress}%`);
            io.emit('videoProgress', {
              type: 'progress',
              filename,
              percent: lastProgress,
              timemarks: progress.timemark
            });
          }
        })
        .on('end', () => {
          console.log(`视频 ${filename} 转换完成`);
          io.emit('videoProgress', {
            type: 'end',
            filename
          });
          resolve();
        })
        .on('error', (err) => {
          console.error(`视频 ${filename} 处理失败:`, err);
          io.emit('videoProgress', {
            type: 'error',
            filename,
            error: err.message
          });
          reject(err);
        })
        .save(outputPath);
    });

    // 生成缩略图 Generate thumbnail
    console.log(`生成视频 ${filename} 的缩略图`);
    await new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .screenshots({
          count: 1,
          filename: `${sn}.jpg`,
          folder: PATHS.VIDEO_THUMBNAILS,
          size: '100x100'
        })
        .on('end', () => {
          console.log(`视频 ${filename} 缩略图生成完成`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`视频 ${filename} 缩略图生成失败:`, err);
          reject(err);
        });
    });

    // 删除原始文件 Delete original file
    await fs.remove(originalPath);
    console.log(`删除原始视频: ${filename}`);

    res.json({
      success: true,
      originalName: filename,
      newName,
      sn,
      video: `/videos/${newName}`,
      thumbnail: `/video-thumbnails/${sn}.jpg`
    });

  } catch (error) {
    console.error('处理视频失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改获取照片列表的路由 Modify route for getting photo list
app.get('/api/photos', async (req, res) => {
  try {
    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.PHOTOS);
    
    // 读取目录中的文件 Read files in directory
    const files = await fs.readdir(PATHS.PHOTOS);
    console.log('读取到的文件列表:', files);
    
    // 过滤出图片文件并确保是数组 Filter out image files and ensure it's an array
    const photoFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));
    console.log('图片文件数量:', photoFiles.length);
    
    // 构建照片数组 Build photo array
    const photos = photoFiles.map(file => ({
      filename: file,
      thumbnail: `/thumbnails/${file}`
    }));
    
    // 返回结果，使用简化的格式 Return result in simplified format
    res.json({ 
      photos: photos,
      total: photoFiles.length 
    });

  } catch (error) {
    console.error('获取照片列表失败:', error);
    res.status(500).json({ 
      photos: [],
      total: 0,
      error: error.message 
    });
  }
});

// 读取照片序号API Read photo serial number API
app.get('/api/read-sn', async (req, res) => {
  try {
    console.log('读取序号文件:', PATHS.PHOTO_SN_FILE)
    
    // 设置响应头 Set response header
    res.setHeader('Content-Type', 'application/json')

    if (!await fs.pathExists(PATHS.PHOTO_SN_FILE)) {
      // 如果文件不存在，返回初始序号 If file does not exist, return initial serial number
      res.json({ sn: '000001' })
      return
    }

    const sn = await fs.readFile(PATHS.PHOTO_SN_FILE, 'utf8')
    const trimmedSN = sn.trim()

    // 验证序号格式 Validate serial number format
    if (!/^\d{6}$/.test(trimmedSN)) {
      res.status(400).json({ 
        error: '序号格式错误',
        sn: trimmedSN 
      })
      return
    }

    res.json({ sn: trimmedSN })

  } catch (error) {
    console.error('读取序号失败:', error)
    res.status(500).json({ 
      error: '读取序号失败',
      details: error.message 
    })
  }
})

// 写入照片序号API Write photo serial number API
app.post('/api/write-sn', async (req, res) => {
  try {
    const { sn } = req.body;
    
    if (!sn || !/^\d{6}$/.test(sn)) {
      throw new Error('无效的序号格式');
    }
    
    await fs.writeFile(PATHS.PHOTO_SN_FILE, sn, 'utf8');
    console.log('写入新序号:', sn);
    
    res.json({ success: true });
  } catch (error) {
    console.error('写入序号失败:', error);
    res.status(500).json({ error: '写入序号失败: ' + error.message });
  }
});

// 读取序号API Read serial number API
app.get('/api/read-sn', async (req, res) => {  // 修改为 GET 请求 Modify to GET request
  try {
    // 确保序号文件存在 Ensure serial number file exists
    if (!await fs.pathExists(PATHS.PHOTO_SN_FILE)) {
      await fs.ensureDir(path.dirname(PATHS.PHOTO_SN_FILE));
      await fs.writeFile(PATHS.PHOTO_SN_FILE, '000001');
      console.log('创建新的序号文件');
    }

    const sn = await fs.readFile(PATHS.PHOTO_SN_FILE, 'utf8');
    const trimmedSN = sn.trim();
    
    // 验证序号格式 Validate serial number format
    if (!/^\d{6}$/.test(trimmedSN)) {
      console.error('序号格式错误:', trimmedSN);
      res.status(400).json({ error: '序号格式错误' });
      return;
    }

    console.log('当前序号:', trimmedSN);
    res.json({ sn: trimmedSN });

  } catch (error) {
    console.error('读取序号失败:', error);
    res.status(500).json({ error: '读取序号失败: ' + error.message });
  }
});

// 写入序号文件 Write serial number file
app.post('/api/write-sn', async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn || !/^\d{6}$/.test(sn)) {
      throw new Error('无效的序号格式');
    }

    await fs.writeFile(PATHS.PHOTO_SN_FILE, sn);
    console.log('写入新序号:', sn);
    res.json({ success: true });
  } catch (error) {
    console.error('写入序号失败:', error);
    res.status(500).json({ error: '写入序号失败: ' + error.message });
  }
});

// 修改读取视频序号 API Modify read video serial number API
app.post('/api/read-video-sn', async (req, res) => {
  try {
    if (!await fs.pathExists(PATHS.VIDEO_SN_FILE)) {
      await fs.writeFile(PATHS.VIDEO_SN_FILE, '000001', 'utf8');
    }
    
    let sn = await fs.readFile(PATHS.VIDEO_SN_FILE, 'utf8');
    sn = sn.trim().replace(/^\uFEFF/, ''); // 移除 BOM Remove BOM
    
    // 验证序号格式 Validate serial number format
    if (!/^\d{6}$/.test(sn)) {
      sn = '000001';
      await fs.writeFile(PATHS.VIDEO_SN_FILE, sn, 'utf8');
    }
    
    console.log('读取到的序号:', sn);
    res.send(sn);
  } catch (error) {
    console.error('读取视频序号失败:', error);
    res.status(500).json({ error: '读取视频序号失败: ' + error.message });
  }
});

// 修改写入视频序号 API Modify write video serial number API
app.post('/api/write-video-sn', async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn || !/^\d{6}$/.test(sn)) {
      throw new Error('无效的序号格式');
    }
    
    await fs.writeFile(PATHS.VIDEO_SN_FILE, sn, 'utf8');
    console.log('写入新序号:', sn);
    res.json({ success: true });
  } catch (error) {
    console.error('写入视频序号失败:', error);
    res.status(500).json({ error: '写入视频序号失败: ' + error.message });
  }
});

// 获取视频列表API Get video list API
app.get('/api/videos', async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.VIDEOS);
    const videos = files
      .filter(file => /\.mp4$/i.test(file))
      .map(file => ({
        filename: file.replace('.mp4', ''), // 移除扩展名，只保留基本文件名 Remove extension, keep only base filename
        name: file.replace('.mp4', '')      // 用于显示的名称 Name for display
      }));
    
    res.json({ videos });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取待处理图片列表 Get list of images to be processed
app.get('/api/list-images', async (req, res) => {
  try {
    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.ORIGINAL_IMAGES);
    
    // 读取目录中的文件 Read files in directory
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    console.log('原始图片目录中的文件:', files);
    
    // 过滤图片文件 Filter image files
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
    console.log('找到的图片文件:', imageFiles);
    
    res.json({ 
      files: imageFiles,
      total: imageFiles.length,
      directory: PATHS.ORIGINAL_IMAGES 
    });
  } catch (error) {
    console.error('获取待处理图片列表失败:', error);
    res.status(500).json({ 
      error: error.message,
      directory: PATHS.ORIGINAL_IMAGES 
    });
  }
});

// 获取待处理视频列表 Get list of videos to be processed
app.get('/api/list-videos', async (req, res) => {
  try {
    console.log('读取视频目录:', PATHS.ORIGINAL_VIDEOS);
    
    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.ORIGINAL_VIDEOS);
    
    // 读取视频文件列表 Read video file list
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    const videoFiles = files.filter(file => /\.(mp4|avi|mov|wmv)$/i.test(file));
    
    console.log('找到的视频文件:', videoFiles);
    
    // 返回标准格式的响应 Return response in standard format
    res.json({
      files: videoFiles,
      total: videoFiles.length,
      directory: PATHS.ORIGINAL_VIDEOS
    });

  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ 
      error: error.message,
      files: [],
      total: 0,
      directory: PATHS.ORIGINAL_VIDEOS 
    });
  }
});

// 处理单张图片 Process a single image
app.post('/api/process-single-image', async (req, res) => {
  try {
    const { filename, newName } = req.body
    
    // 源文件路径 Source file path
    const sourcePath = path.join(PATHS.ORIGINAL_IMAGES, filename)
    // 目标文件路径 Destination file path
    const destPath = path.join(PATHS.PHOTOS, `${newName}.jpg`)
    // 缩略图路径 Thumbnail path
    const thumbnailPath = path.join(PATHS.THUMBNAILS, `${newName}.jpg`)

    // 处理图片 Process image
    const image = await Jimp.read(sourcePath)
    
    // 保存原图 Save original image
    await image
      .clone()
      .quality(80)
      .writeAsync(destPath)

    // 生成缩略图 Generate thumbnail
    await image
      .clone()
      .cover(100, 100)
      .quality(60)
      .writeAsync(thumbnailPath)

    // 删除原始文件 Delete original file
    await fs.remove(sourcePath)

    res.json({ success: true })
  } catch (error) {
    console.error('处理图片失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 修改服务器启动代码 Modify server startup code
const port = 3000;
server.listen(port, () => {
  console.log(`后端服务器运行在 http://localhost:${port}`);
  console.log('目录配置:');
  console.log('- 原始图片:', PATHS.ORIGINAL_IMAGES);
  console.log('- 处理后图片:', PATHS.PHOTOS);     // 修改这里
  console.log('- 缩略图:', PATHS.THUMBNAILS);
});