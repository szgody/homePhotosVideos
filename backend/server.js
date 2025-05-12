// 在 server.js 顶部
require("dotenv").config();

// 导入必要的模块 Import required modules
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("./ffmpeg-installer");
const Jimp = require("jimp");
const http = require("http");
const { Server } = require("socket.io");

// 确保正确设置了 Socket.IO
const socketIO = require("socket.io");

// 在 server.js 或其他后端文件中
const dataDir = process.env.DATA_DIR || "data";
const publicDir = process.env.PUBLIC_DIR || "public";

// 使用 path.join 构建路径
const photosPath = path.join(__dirname, "..", dataDir, "photos");

// 创建Express应用和HTTP服务器 Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// 端口配置
const port = process.env.PORT || 3000;

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://192.168.23.56", "http://localhost:3000"];

// 使用一个统一的CORS配置
app.use(
  cors({
    origin: function (origin, callback) {
      // 允许没有源的请求或在白名单内的请求
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("CORS拒绝源:", origin);  // 记录被拒绝的源
        callback(null, true);  // 暂时允许所有源，便于调试
        // 如果需要恢复严格的CORS策略，请改回:
        // callback(new Error("不允许的来源"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

// Socket.io 配置
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 设置 ffmpeg 路径 Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

// 路径配置
const PATHS = {
  DATA_DIR: path.join(__dirname, "..", process.env.DATA_DIR || "data"),
  PUBLIC_DIR: path.join(__dirname, "..", process.env.PUBLIC_DIR || "public"),

  // 确保这些配置与 .env 文件一致
  ORIGINAL_IMAGES: path.join(
    __dirname,
    "..",
    process.env.PUBLIC_DIR || "public",
    "original",
    "images",
  ),
  ORIGINAL_VIDEOS: path.join(
    __dirname,
    "..",
    process.env.PUBLIC_DIR || "public",
    "original",
    "videos",
  ),

  PHOTOS: path.join(__dirname, "..", process.env.DATA_DIR || "data", "photos"),
  PHOTO_THUMBNAILS: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "photo_thumbnails",
  ),

  VIDEOS: path.join(__dirname, "..", process.env.DATA_DIR || "data", "videos"),
  VIDEO_THUMBNAILS: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "video_thumbnails",
  ),

  // 序列号文件存储路径
  PHOTO_SN_FILE: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "photos",
    "sn.txt",
  ),
  VIDEO_SN_FILE: path.join(
    __dirname,
    "..",
    process.env.DATA_DIR || "data",
    "videos",
    "sn.txt",
  ),
};

// 启用中间件 Enable middleware
app.use(cors()); // 启用跨域支持 Enable CORS
app.use(express.json()); // 解析JSON请求体 Parse JSON request body

// 配置静态文件服务 Configure static file serving
app.use(
  process.env.PHOTO_THUMBNAILS_PATH || "/photo_thumbnails",
  express.static(PATHS.PHOTO_THUMBNAILS),
); // 缩略图 Thumbnails
app.use(process.env.PHOTOS_PATH || "/photos", express.static(PATHS.PHOTOS)); // 照片 Photos
app.use(process.env.VIDEOS_PATH || "/videos", express.static(PATHS.VIDEOS)); // 视频 Videos
app.use(
  process.env.VIDEO_THUMBNAILS_PATH || "/video_thumbnails",
  express.static(PATHS.VIDEO_THUMBNAILS),
); // 视频缩略图 Video thumbnails

// 初始化目录和文件 Initialize directories and files
async function initializeDirectories() {
  try {
    await Promise.all([
      fs.ensureDir(PATHS.ORIGINAL_IMAGES),
      fs.ensureDir(PATHS.ORIGINAL_VIDEOS),
      fs.ensureDir(PATHS.PHOTOS),
      fs.ensureDir(PATHS.PHOTO_THUMBNAILS), // 确保使用正确的变量名
      fs.ensureDir(PATHS.VIDEOS),
      fs.ensureDir(PATHS.VIDEO_THUMBNAILS),
    ]);

    console.log("目录初始化完成 Directory initialization completed");
  } catch (error) {
    console.error("初始化失败 Initialization failed:", error);
    throw error;
  }
}

// 启动时初始化 Initialize on startup
initializeDirectories().catch(console.error);

// 修改图片处理路由 Modify image processing route
app.post("/api/process-images", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file),
    );

    if (imageFiles.length === 0) {
      return res.json({
        message: "没有找到需要处理的图片",
        results: [],
      });
    }

    let currentSN = await fs.readFile(PATHS.PHOTO_SN_FILE, "utf8");
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
          .writeAsync(path.join(PATHS.PHOTO_THUMBNAILS, newName));

        // 删除原始文件 Delete original file
        await fs.remove(originalPath);

        results.push({
          originalName: file,
          newName: newName,
          sn: currentSN,
        });

        currentSN = String(Number(currentSN) + 1).padStart(6, "0");
      } catch (error) {
        console.error(`处理图片 ${file} 失败:`, error);
        results.push({
          originalName: file,
          error: error.message,
        });
      }
    }

    // 更新序号 Update serial number
    await fs.writeFile(PATHS.PHOTO_SN_FILE, currentSN);

    res.json({
      message: "处理完成",
      results: results,
      nextSN: currentSN,
    });
  } catch (error) {
    console.error("处理过程出错:", error);
    res.status(500).json({ error: error.message });
  }
});

// 修改视频处理路由 Modify video processing route
app.post("/api/process-videos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    const videoFiles = files.filter((file) =>
      /\.(mp4|avi|mov|wmv)$/i.test(file),
    );

    if (videoFiles.length === 0) {
      return res.json({
        message: "没有找到需要处理的视频",
        results: [],
      });
    }

    let currentSN = await fs.readFile(PATHS.VIDEO_SN_FILE, "utf8");
    currentSN = currentSN.trim();
    const results = [];

    // 立即发送响应，包含需要处理的视频数量 Immediately send response with the number of videos to be processed
    res.json({
      message: "开始处理视频",
      totalFiles: videoFiles.length,
      files: videoFiles,
    });
  } catch (error) {
    console.error("处理过程出错:", error);
    res.status(500).json({ error: error.message });
  }
});

// 修改处理单个视频的路由 Modify route for processing a single video
app.post("/api/process-single-video", async (req, res) => {
  try {
    const { filename, newName, deleteOriginal } = req.body; // 添加 deleteOriginal 参数

    // 处理视频
    const result = await processVideo(filename, newName);

    // 只有当 deleteOriginal 为 true 时才删除原始文件
    if (deleteOriginal === true) {
      await fs.remove(result.originalPath);
      console.log(`已删除原始视频: ${result.originalPath}`);
    }

    const baseUrl = process.env.BASE_URL || "";
    res.json({
      success: true,
      originalName: filename,
      newName: result.newName,
      sn: newName,
      video: `${baseUrl}${process.env.VIDEOS_PATH || "/videos"}/${result.newName}`,
      thumbnail: `${baseUrl}${process.env.VIDEO_THUMBNAILS_PATH || "/video_thumbnails"}/${newName}.jpg`,
    });
  } catch (error) {
    console.error("处理视频失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 修改获取照片列表的路由 Modify route for getting photo list
app.get("/api/photos", async (req, res) => {
  try {
    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.PHOTOS);

    // 读取目录中的文件 Read files in directory
    const files = await fs.readdir(PATHS.PHOTOS);
    console.log("读取到的文件列表:", files);

    // 过滤出图片文件并确保是数组 Filter out image files and ensure it's an array
    const photoFiles = files.filter((file) => /\.(jpg|jpeg)$/i.test(file));
    console.log("图片文件数量:", photoFiles.length);

    // 构建照片数组 Build photo array
    const baseUrl = process.env.BASE_URL || "";
    const photos = photoFiles.map((file) => ({
      filename: file,
      thumbnail: `${baseUrl}${process.env.THUMBNAILS_PATH || "/photo_thumbnails"}/${file}`,
      photo: `${baseUrl}${process.env.PHOTOS_PATH || "/photos"}/${file}`,
    }));

    // 返回结果，使用简化的格式 Return result in simplified format
    res.json({
      photos: photos,
      total: photoFiles.length,
    });
  } catch (error) {
    console.error("获取照片列表失败:", error);
    res.status(500).json({
      photos: [],
      total: 0,
      error: error.message,
    });
  }
});

// 读取照片序号API Read photo serial number API
app.get("/api/read-sn", async (req, res) => {
  // 修改为 GET 请求 Modify to GET request
  try {
    // 确保序号文件存在 Ensure serial number file exists
    if (!(await fs.pathExists(PATHS.PHOTO_SN_FILE))) {
      await fs.ensureDir(path.dirname(PATHS.PHOTO_SN_FILE));
      await fs.writeFile(PATHS.PHOTO_SN_FILE, "000001");
      console.log("创建新的序号文件");
    }

    const sn = await fs.readFile(PATHS.PHOTO_SN_FILE, "utf8");
    const trimmedSN = sn.trim();

    // 验证序号格式 Validate serial number format
    if (!/^\d{6}$/.test(trimmedSN)) {
      console.error("序号格式错误:", trimmedSN);
      res.status(400).json({ error: "序号格式错误" });
      return;
    }

    console.log("当前序号:", trimmedSN);
    res.json({ sn: trimmedSN });
  } catch (error) {
    console.error("读取序号失败:", error);
    res.status(500).json({ error: "读取序号失败: " + error.message });
  }
});

// 修改写入序号的路由处理程序
app.post("/api/write-sn", async (req, res) => {
  try {
    const { sn } = req.body;

    console.log(`接收到写入序号请求: "${sn}"`);

    // 增强序号校验
    if (!sn) {
      return res.status(400).json({
        success: false,
        error: `序号不能为空`,
      });
    }

    // 确保序号是6位数字格式的字符串
    const formattedSN = String(sn).padStart(6, "0");

    // 检查序号格式
    if (!/^\d{6}$/.test(formattedSN)) {
      return res.status(400).json({
        success: false,
        error: `无效的序号格式: "${formattedSN}"`,
      });
    }

    console.log(`写入序号: ${formattedSN} 到文件: ${PATHS.PHOTO_SN_FILE}`);

    // 确保目录存在
    await fs.ensureDir(path.dirname(PATHS.PHOTO_SN_FILE));

    // 写入序号
    await fs.writeFile(PATHS.PHOTO_SN_FILE, formattedSN, "utf8");

    // 验证写入成功
    const verificationSn = await fs.readFile(PATHS.PHOTO_SN_FILE, "utf8");
    if (verificationSn.trim() !== formattedSN) {
      throw new Error(
        `写入验证失败: 期望 "${formattedSN}" 但得到 "${verificationSn.trim()}"`,
      );
    }

    res.json({ success: true, sn: formattedSN });
  } catch (error) {
    console.error(`写入序号出错: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `写入序号失败: ${error.message}`,
    });
  }
});

// 修改读取视频序号 API - 将POST改为GET
app.get("/api/read-video-sn", async (req, res) => {
  try {
    // 确保序号文件目录存在
    await fs.ensureDir(path.dirname(PATHS.VIDEO_SN_FILE));

    if (!(await fs.pathExists(PATHS.VIDEO_SN_FILE))) {
      await fs.writeFile(PATHS.VIDEO_SN_FILE, "000001", "utf8");
    }

    let sn = await fs.readFile(PATHS.VIDEO_SN_FILE, "utf8");
    sn = sn.trim().replace(/^\uFEFF/, ""); // 移除 BOM Remove BOM

    // 验证序号格式 Validate serial number format
    if (!/^\d{6}$/.test(sn)) {
      sn = "000001";
      await fs.writeFile(PATHS.VIDEO_SN_FILE, sn, "utf8");
    }

    console.log("读取到的视频序号:", sn);
    res.send(sn);
  } catch (error) {
    console.error("读取视频序号失败:", error);
    res.status(500).json({ error: "读取视频序号失败: " + error.message });
  }
});

// 修复写入视频序号 API 中的变量引用错误
app.post("/api/write-video-sn", async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn || !/^\d{6}$/.test(sn)) {
      throw new Error("无效的序号格式");
    }

    const formattedSn = sn.padStart(6, "0");
    // 修复变量名错误：videoSnPath -> PATHS.VIDEO_SN_FILE
    await fs.ensureDir(path.dirname(PATHS.VIDEO_SN_FILE)); // 确保目录存在
    await fs.writeFile(PATHS.VIDEO_SN_FILE, formattedSn, "utf8");

    console.log("视频序号已更新为:", formattedSn);
    res.json({ success: true, sn: formattedSn });
  } catch (error) {
    console.error("写入视频序号失败:", error);
    res
      .status(500)
      .json({ success: false, error: "写入视频序号失败: " + error.message });
  }
});

// 获取视频列表API Get video list API
app.get("/api/videos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.VIDEOS);
    const baseUrl = process.env.BASE_URL || "";
    const videos = files
      .filter((file) => /\.mp4$/i.test(file))
      .map((file) => {
        const basename = file.replace(".mp4", "");
        return {
          filename: basename, // 移除扩展名，只保留基本文件名
          name: basename, // 用于显示的名称
          thumbnailPath: `${baseUrl}${process.env.VIDEO_THUMBNAILS_PATH || "/video_thumbnails"}/${basename}.jpg`, // 添加缩略图路径
          videoPath: `${baseUrl}${process.env.VIDEOS_PATH || "/videos"}/${file}`, // 添加视频路径
        };
      });

    console.log("获取视频列表:", videos.length);
    res.json({ videos });
  } catch (error) {
    console.error("获取视频列表失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 获取待处理图片列表 Get list of images to be processed
app.get("/api/list-images", async (req, res) => {
  try {
    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.ORIGINAL_IMAGES);

    // 读取目录中的文件 Read files in directory
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    console.log("原始图片目录中的文件:", files);

    // 过滤图片文件 Filter image files
    const imageFiles = files.filter((file) => /\.(jpg|jpeg|png)$/i.test(file));
    console.log("找到的图片文件:", imageFiles);

    res.json({
      files: imageFiles,
      total: imageFiles.length,
      directory: PATHS.ORIGINAL_IMAGES,
    });
  } catch (error) {
    console.error("获取待处理图片列表失败:", error);
    res.status(500).json({
      error: error.message,
      directory: PATHS.ORIGINAL_IMAGES,
    });
  }
});

// 获取待处理视频列表 Get list of videos to be processed
app.get("/api/list-videos", async (req, res) => {
  try {
    console.log("读取视频目录:", PATHS.ORIGINAL_VIDEOS);

    // 确保目录存在 Ensure directory exists
    await fs.ensureDir(PATHS.ORIGINAL_VIDEOS);

    // 读取视频文件列表 Read video file list
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    const videoFiles = files.filter((file) =>
      /\.(mp4|avi|mov|wmv)$/i.test(file),
    );

    console.log("找到的视频文件:", videoFiles);

    // 返回标准格式的响应 Return response in standard format
    res.json({
      files: videoFiles,
      total: videoFiles.length,
      directory: PATHS.ORIGINAL_VIDEOS,
    });
  } catch (error) {
    console.error("获取视频列表失败:", error);
    res.status(500).json({
      error: error.message,
      files: [],
      total: 0,
      directory: PATHS.ORIGINAL_VIDEOS,
    });
  }
});

// 在文件顶部添加缺失的函数定义
const processImage = async (filename, newName) => {
  try {
    // 使用 ORIGINAL_IMAGES 替代 UNPROCESSED_PHOTOS
    const sourcePath = path.join(PATHS.ORIGINAL_IMAGES, filename);
    // 使用 PHOTOS 替代 PROCESSED_PHOTOS
    const targetPath = path.join(
      PATHS.PHOTOS,
      `${newName}${path.extname(filename)}`,
    );
    const thumbnailPath = path.join(
      PATHS.PHOTO_THUMBNAILS,
      `${newName}${path.extname(filename)}`,
    );

    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`源文件不存在: ${sourcePath}`);
    }

    // 复制文件到目标位置
    await fs.copy(sourcePath, targetPath);

    // 创建缩略图
    await sharp(sourcePath)
      .resize(240, 240, { fit: "cover" })
      .toFile(thumbnailPath);

    return {
      newName: `${newName}${path.extname(filename)}`,
      originalPath: sourcePath,
      targetPath: targetPath,
      thumbnailPath: thumbnailPath,
    };
  } catch (error) {
    console.error(`处理图片失败: ${filename}`, error);
    throw error;
  }
};

// 在 server.js 中添加 processVideo 函数定义
const processVideo = async (filename, newName) => {
  try {
    const ext = ".mp4";
    const finalNewName = `${newName}${ext}`;
    const originalPath = path.join(PATHS.ORIGINAL_VIDEOS, filename);
    const outputPath = path.join(PATHS.VIDEOS, finalNewName);
    const thumbnailPath = path.join(PATHS.VIDEO_THUMBNAILS, `${newName}.jpg`);

    console.log("开始处理视频:", {
      filename,
      newName: finalNewName,
      originalPath,
      outputPath,
      thumbnailPath,
    });

    // 先发送开始事件
    io.emit("videoProgress", {
      type: "start",
      filename,
      originalPath,
      outputPath,
    });

    // 检查源文件是否存在
    if (!fs.existsSync(originalPath)) {
      const error = `源文件不存在: ${originalPath}`;
      io.emit("videoProgress", {
        type: "error",
        filename,
        error,
      });
      throw new Error(error);
    }

    // 验证视频文件格式
    try {
      const videoInfo = await validateVideoFile(originalPath);
      console.log(`视频文件验证通过: ${filename}`, videoInfo);

      // 更新进度数据，包含视频信息
      global.videoProgressData[filename] = {
        percent: 0,
        timemarks: "",
        status: "validated",
        videoInfo,
      };
    } catch (validationError) {
      console.error(`视频文件验证失败: ${filename}`, validationError);
      io.emit("videoProgress", {
        type: "error",
        filename,
        error: `视频文件验证失败: ${validationError.message}`,
      });

      // 更新全局进度数据
      global.videoProgressData[filename] = {
        status: "error",
        error: `视频文件验证失败: ${validationError.message}`,
      };

      throw new Error(`视频文件验证失败: ${validationError.message}`);
    }

    // 初始化全局进程跟踪对象
    if (!global.activeFFmpegProcesses) {
      global.activeFFmpegProcesses = {};
    }

    // 存储视频处理进度的全局变量
    global.videoProgressData = {};

    // 初始化进度数据
    global.videoProgressData[filename] = {
      percent: 0,
      timemarks: "",
      status: "processing",
    };

    // 处理视频
    await new Promise((resolve, reject) => {
      let lastProgress = 0;
      let progressInterval;

      // 创建 ffmpeg 命令
      const ffmpegCommand = ffmpeg(originalPath)
        .outputOptions([
          "-c:v libx264",
          "-crf 23",
          "-preset medium",
          "-c:a aac",
          "-b:a 128k",
        ])
        .on("start", (commandLine) => {
          console.log("FFmpeg 命令:", commandLine);
          io.emit("videoProgress", {
            type: "start",
            filename,
            command: commandLine,
          });

          // 定期发送进度更新，即使 FFmpeg 没有报告进度
          progressInterval = setInterval(() => {
            io.emit("videoProgress", {
              type: "progress",
              filename,
              percent: lastProgress,
              timemarks: "处理中...",
            });
          }, 2000); // 每2秒发送一次
        })
        .on("progress", (progress) => {
          if (progress.percent && Math.floor(progress.percent) > lastProgress) {
            lastProgress = Math.floor(progress.percent);
            console.log(`视频 ${filename} 处理进度: ${lastProgress}%`);
            io.emit("videoProgress", {
              type: "progress",
              filename,
              percent: lastProgress,
              timemarks: progress.timemark || "处理中...",
            });

            // 更新全局进度数据
            if (!global.videoProgressData) global.videoProgressData = {};
            if (!global.videoProgressData[filename])
              global.videoProgressData[filename] = {};

            global.videoProgressData[filename].percent = lastProgress;
            global.videoProgressData[filename].timemarks =
              progress.timemark || "";
            global.videoProgressData[filename].status = "processing";
          }
        })
        .on("end", () => {
          if (progressInterval) clearInterval(progressInterval);

          console.log(`视频 ${filename} 转换完成`);
          io.emit("videoProgress", {
            type: "end",
            filename,
            percent: 100,
          });

          // 更新全局进度数据
          global.videoProgressData[filename] = {
            percent: 100,
            status: "completed",
          };
          resolve();
        })
        .on("error", (err) => {
          if (progressInterval) clearInterval(progressInterval);

          // 检查是否是因为用户取消导致的错误
          const isCancelError =
            err.message.includes("signal 15") ||
            err.message.includes("code 255") ||
            err.message.includes("SIGTERM");

          if (isCancelError) {
            console.log(`视频 ${filename} 处理被用户取消`);
            io.emit("videoProgress", {
              type: "cancelled",
              filename,
              message: "处理已被用户取消",
            });

            // 更新全局进度数据
            global.videoProgressData[filename] = {
              status: "cancelled",
              message: "处理已被用户取消",
            };

            // 不将取消视为错误
            resolve({ cancelled: true });
          } else {
            console.error(`视频 ${filename} 处理失败:`, err);
            io.emit("videoProgress", {
              type: "error",
              filename,
              error: err.message,
            });

            // 更新全局进度数据
            global.videoProgressData[filename] = {
              status: "error",
              error: err.message,
            };

            reject(err);
          }
        })
        .save(outputPath);

      // 存储 ffmpeg 命令实例，以便稍后可以终止它
      if (!global.activeFFmpegProcesses) global.activeFFmpegProcesses = {};
      global.activeFFmpegProcesses[filename] = ffmpegCommand;
    });

    // 生成缩略图
    console.log(`生成视频 ${filename} 的缩略图`);
    await new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .screenshots({
          count: 1,
          filename: `${newName}.jpg`,
          folder: PATHS.VIDEO_THUMBNAILS,
          size: "100x100",
        })
        .on("end", () => {
          console.log(`视频 ${filename} 缩略图生成完成`);
          resolve();
        })
        .on("error", (err) => {
          console.error(`视频 ${filename} 缩略图生成失败:`, err);
          reject(err);
        });
    });

    return {
      newName: finalNewName,
      originalPath,
      outputPath,
      thumbnailPath: `${newName}.jpg`,
    };
  } catch (error) {
    console.error(`处理视频失败: ${filename}`, error);
    io.emit("videoProgress", {
      type: "error",
      filename,
      error: error.message,
    });

    // 更新全局进度数据
    global.videoProgressData[filename] = {
      status: "error",
      error: error.message,
    };
    throw error;
  }
};

// 添加获取视频进度的 API 接口
app.get("/api/video-progress/:filename", (req, res) => {
  const filename = req.params.filename;

  if (global.videoProgressData && global.videoProgressData[filename]) {
    res.json(global.videoProgressData[filename]);
  } else {
    res.json({ status: "not_found", percent: 0 });
  }
});

// 图片处理路由
app.post("/api/process-single-image", async (req, res) => {
  const startTime = Date.now();
  const { filename, newName } = req.body;

  try {
    console.log(
      `开始处理图片: ${filename} -> ${newName}, 内存使用: ${JSON.stringify(process.memoryUsage())}`,
    );

    // 处理图片
    const result = await processImage(filename, newName);

    // 记录处理时间
    const processTime = Date.now() - startTime;
    console.log(
      `图片处理完成: ${filename}, 用时: ${processTime}ms, 内存使用: ${JSON.stringify(process.memoryUsage())}`,
    );

    res.json({
      success: true,
      originalName: filename,
      newName: result.newName,
      sn: newName,
      processTime,
    });
  } catch (error) {
    console.error(`处理图片失败: ${filename}`, error);

    res.status(500).json({
      success: false,
      error: error.message,
      memoryUsage: process.memoryUsage(),
    });
  }
});

// 健康检查接口增强
app.get("/api/health", async (req, res) => {
  try {
    // 基本信息
    const memoryUsage = process.memoryUsage();
    const health = {
      status: "ok",
      uptime: process.uptime(),
      memory: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      nodeVersion: process.version,
    };

    // 检查磁盘空间
    try {
      const { exec } = require("child_process");
      const diskSpaceCheck = await new Promise((resolve, reject) => {
        exec("df -h / | tail -1 | awk '{print $5}'", (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });
      health.diskSpace = diskSpaceCheck;
    } catch (error) {
      console.error("获取磁盘空间失败:", error);
      health.diskSpace = "unknown";
    }

    // 如果请求了详细信息
    if (req.query.detail === "true") {
      // 添加路径信息 - 只使用实际定义的路径
      health.paths = {
        root: process.cwd(),
        ORIGINAL_IMAGES: PATHS.ORIGINAL_IMAGES,
        PHOTOS: PATHS.PHOTOS,
        photoThumbnails: PATHS.PHOTO_THUMBNAILS,
        photoSN: PATHS.PHOTO_SN_FILE,
        ORIGINAL_VIDEOS: PATHS.ORIGINAL_VIDEOS,
        VIDEOS: PATHS.VIDEOS,
        videoThumbnails: PATHS.VIDEO_THUMBNAILS,
        videoSN: PATHS.VIDEO_SN_FILE,
      };

      // 检查路径是否存在
      health.pathExists = {};
      for (const [key, value] of Object.entries(health.paths)) {
        if (value) {
          // 确保路径有值
          health.pathExists[key] = await fs.pathExists(value);
        } else {
          health.pathExists[key] = false;
        }
      }

      // 检查环境变量
      health.env = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
      };

      // 检查函数定义
      health.functions = {
        processImage: typeof processImage === "function",
        processVideo: typeof processVideo === "function",
      };
    }

    res.json(health);
  } catch (error) {
    console.error("健康检查错误:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// 辅助函数：检查文件是否可写
async function isWritable(file) {
  try {
    if (await fs.pathExists(file)) {
      await fs.access(file, fs.constants.W_OK);
    } else {
      // 如果文件不存在，检查目录是否可写
      const directory = path.dirname(file);
      await fs.access(directory, fs.constants.W_OK);
    }
    return true;
  } catch {
    return false;
  }
}

// 改进读取序号接口
app.get("/api/read-sn", async (req, res) => {
  try {
    console.log(`读取序号文件: ${PATHS.PHOTO_SN_FILE}`);

    // 检查文件是否存在
    const exists = await fs.pathExists(PATHS.PHOTO_SN_FILE);
    if (!exists) {
      console.log(
        `序号文件不存在，创建默认文件 File doesn't exist, creating default`,
      );
      // 创建包含默认序号的文件
      await fs.ensureFile(PATHS.PHOTO_SN_FILE);
      await fs.writeFile(PATHS.PHOTO_SN_FILE, "000000", "utf8");
    }

    let sn = await fs.readFile(PATHS.PHOTO_SN_FILE, "utf8");
    sn = sn.trim();

    // 验证序号格式
    if (!/^\d+$/.test(sn)) {
      console.log(
        `序号格式无效: "${sn}", 使用默认值 Invalid SN format, using default`,
      );
      sn = "000000";
      // 写入默认值
      await fs.writeFile(PATHS.PHOTO_SN_FILE, sn, "utf8");
    }

    console.log(`读取到序号: ${sn}`);
    res.json({ sn });
  } catch (error) {
    console.error(`读取序号出错: ${error.message}`);
    res.status(500).json({ error: `读取序号失败: ${error.message}` });
  }
});

// 改进写入序号接口
app.post("/api/write-sn", async (req, res) => {
  try {
    const { sn } = req.body;

    if (!sn || !/^\d+$/.test(sn)) {
      return res.status(400).json({
        success: false,
        error: `无效的序号格式: "${sn}"`,
      });
    }

    console.log(`写入序号: ${sn} 到文件: ${PATHS.PHOTO_SN_FILE}`);

    // 确保目录存在
    await fs.ensureDir(path.dirname(PATHS.PHOTO_SN_FILE));

    // 写入序号
    await fs.writeFile(PATHS.PHOTO_SN_FILE, sn, "utf8");

    // 验证写入成功
    const verificationSn = await fs.readFile(PATHS.PHOTO_SN_FILE, "utf8");
    if (verificationSn.trim() !== sn) {
      throw new Error(
        `写入验证失败: 期望 "${sn}" 但得到 "${verificationSn.trim()}"`,
      );
    }

    res.json({ success: true, sn });
  } catch (error) {
    console.error(`写入序号出错: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `写入序号失败: ${error.message}`,
    });
  }
});

// 处理单个图片的路由处理程序
app.post("/api/process-single-image", async (req, res) => {
  try {
    // 解构请求体，提供默认值防止 undefined
    const {
      filename = "",
      newName = "",
      sourcePath,
      targetPath,
      extension,
    } = req.body;

    // 检查必要参数
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: "文件名不能为空",
      });
    }

    if (!newName) {
      return res.status(400).json({
        success: false,
        error: "新文件名不能为空",
      });
    }

    // 返回成功响应
    res.json({
      success: true,
      originalName: filename,
      newName: `${newName}.${fileExtension}`,
      sourcePath: sourceFilePath,
      targetPath: targetFilePath,
      thumbnailPath: thumbnailFilePath,
    });
  } catch (error) {
    console.error("处理图片失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      memoryUsage: process.memoryUsage(),
    });
  }
});

// 取消处理接口
app.post("/api/cancel-processing", async (req, res) => {
  try {
    const { type, file } = req.body;

    console.log(`收到取消处理请求: 类型=${type}, 文件=${file}`);

    // 如果是视频处理，需要终止 ffmpeg 进程
    if (type === "video") {
      // 标记为已取消
      global.processingCancelled = global.processingCancelled || {};
      global.processingCancelled[file] = true;

      // 更新进度数据
      if (global.videoProgressData && global.videoProgressData[file]) {
        global.videoProgressData[file] = {
          status: "cancelled",
          message: "处理已被用户取消",
          percent: 0,
        };
      }

      // 终止 ffmpeg 进程
      if (global.activeFFmpegProcesses && global.activeFFmpegProcesses[file]) {
        const process = global.activeFFmpegProcesses[file];

        try {
          process.kill("SIGTERM");
          console.log(`已终止处理视频的 FFmpeg 进程: ${file}`);

          delete global.activeFFmpegProcesses[file];

          return res.json({
            success: true,
            message: "处理已取消",
            file,
            type,
          });
        } catch (error) {
          console.error(`终止 FFmpeg 进程失败: ${error.message}`);
          return res.status(500).json({
            success: false,
            error: `终止处理失败: ${error.message}`,
          });
        }
      } else {
        return res.json({
          success: true,
          message: "没有找到正在处理的进程",
          file,
        });
      }
    }

    // 不是视频处理或无法识别的类型
    res.json({
      success: true,
      message: "处理请求已接收",
      file,
      type,
    });
  } catch (error) {
    console.error("取消处理失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加视频进度 API
app.get("/api/video-progress", (req, res) => {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: "缺少文件名参数" });
  }

  // 返回指定文件的进度，如果没有则返回空状态
  const progressData =
    global.videoProgressData && global.videoProgressData[filename]
      ? global.videoProgressData[filename]
      : { percent: 0, status: "unknown" };

  res.json(progressData);
});

// 添加视频文件验证函数
const validateVideoFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error(`视频文件验证失败: ${filePath}`, err);
        reject(new Error(`视频文件验证失败: ${err.message}`));
        return;
      }

      // 检查是否包含视频流
      const videoStreams = metadata.streams.filter(
        (stream) => stream.codec_type === "video",
      );
      if (videoStreams.length === 0) {
        reject(new Error("此文件不包含视频流"));
        return;
      }

      // 提取视频信息
      const videoInfo = {
        duration: metadata.format.duration || 0,
        size: metadata.format.size || 0,
        bitrate: metadata.format.bit_rate || 0,
        format: metadata.format.format_name || "",
        codec: videoStreams[0].codec_name || "",
        width: videoStreams[0].width || 0,
        height: videoStreams[0].height || 0,
      };

      resolve(videoInfo);
    });
  });
};

// 添加删除原始视频接口
app.post("/api/delete-original-video", async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: "文件名不能为空",
      });
    }

    // 安全检查：确保文件名不包含路径遍历尝试
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({
        success: false,
        error: "无效的文件名",
      });
    }

    const filePath = path.join(PATHS.ORIGINAL_VIDEOS, filename);

    // 检查文件是否存在
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: "文件不存在",
      });
    }

    // 删除文件
    await fs.remove(filePath);
    console.log(`已删除损坏的视频文件: ${filename}`);

    res.json({
      success: true,
      message: `文件 ${filename} 已被删除`,
    });
  } catch (error) {
    console.error(`删除视频文件失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `删除文件失败: ${error.message}`,
    });
  }
});

// 添加健全性检查函数
const ensureGlobals = () => {
  if (!global.videoProgressData) global.videoProgressData = {};
  if (!global.activeFFmpegProcesses) global.activeFFmpegProcesses = {};
  if (!global.processingCancelled) global.processingCancelled = {};

  console.log("全局变量已初始化:", {
    videoProgressData: !!global.videoProgressData,
    activeFFmpegProcesses: !!global.activeFFmpegProcesses,
    processingCancelled: !!global.processingCancelled,
  });
};

// 添加删除所有原始图片接口
app.post("/api/delete-all-original-images", async (req, res) => {
  try {
    // 确保目录存在
    await fs.ensureDir(PATHS.ORIGINAL_IMAGES);

    // 读取原始图片目录
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);

    // 过滤出图片文件
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file),
    );

    // 如果没有图片，直接返回
    if (imageFiles.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        message: "没有需要删除的原始图片",
      });
    }

    // 开始删除图片
    let deletedCount = 0;
    const errors = [];

    for (const file of imageFiles) {
      try {
        // 构建完整路径
        const filePath = path.join(PATHS.ORIGINAL_IMAGES, file);

        // 删除文件
        await fs.remove(filePath);
        deletedCount++;
      } catch (error) {
        console.error(`删除文件 ${file} 失败:`, error);
        errors.push({ file, error: error.message });
      }
    }

    // 返回结果
    res.json({
      success: true,
      deletedCount,
      totalFiles: imageFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `已成功删除 ${deletedCount} 张原始图片`,
    });
  } catch (error) {
    console.error("删除原始图片失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 调整 /api/delete-all-original-videos API，使其检查是否还有未处理的原始视频
app.post("/api/delete-all-original-videos", async (req, res) => {
  try {
    const { processedFiles } = req.body;
    let deletedCount = 0;
    let errorFiles = [];
    
    // 逐个删除文件
    for (const file of processedFiles) {
      try {
        // 修复这行 - 将 VIDEOS_DIR 改为 PATHS.ORIGINAL_VIDEOS
        const filePath = path.join(PATHS.ORIGINAL_VIDEOS, file);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          deletedCount++;
        }
      } catch (fileError) {
        errorFiles.push(file);
      }
    }
    
    // 即使部分文件删除失败，也返回成功状态
    res.json({ 
      success: true, 
      deletedCount,
      hasErrors: errorFiles.length > 0,
      errorCount: errorFiles.length,
      message: errorFiles.length > 0 ? `${errorFiles.length} 个文件删除失败` : ''
    });
  } catch (error) {
    console.error('删除视频出错:', error);
    res.json({ 
      success: false, 
      message: error.message,
      deletedCount: 0 // 确保前端能处理这种情况
    });
  }
});

// 修改服务器启动代码 Modify server startup code
server.listen(port, () => {
  console.log(`后端服务器运行在 端口: ${port}`);
  console.log("目录配置:");
  console.log("- 原始图片:", PATHS.ORIGINAL_IMAGES);
  console.log("- 处理后图片:", PATHS.PHOTOS);
  console.log("- 缩略图:", PATHS.PHOTO_THUMBNAILS);

  // 添加 URL 配置日志
  console.log("URL 配置:");
  console.log("- 基础 URL:", process.env.BASE_URL || "未设置");
  console.log("- 图片路径:", process.env.PHOTOS_PATH || "/photos");
  console.log(
    "- 缩略图路径:",
    process.env.THUMBNAILS_PATH || "/photo_thumbnails",
  );
  ensureGlobals();
});

// 全局错误处理
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});

// 后端 server.js 或相关路由文件中

// 全局变量存储当前处理状态
global.processingStatus = {
  isProcessing: false,
  type: null, // 'image' 或 'video'
  progress: 0,
  currentFile: "",
  originalName: "",
  newName: "",
  currentSN: "",
  currentStage: "",
  processedCount: 0,
  totalCount: 0,
  ffmpegProgress: 0,
  timemarks: "",
  startTime: null,
};

// 在图片处理函数中
function processSingleImage(filename, newName) {
  // 更新处理状态
  global.processingStatus.currentFile = filename;
  global.processingStatus.originalName = filename;
  global.processingStatus.newName = newName;
  global.processingStatus.currentStage = "处理中";

  // 其他处理逻辑
}

// 在视频处理函数中
function processSingleVideo(filename, newName) {
  // 更新处理状态
  global.processingStatus.currentFile = filename;
  global.processingStatus.originalName = filename;
  global.processingStatus.newName = newName;
  global.processingStatus.currentStage = "处理中";

  // 更新 ffmpeg 进度时
  global.processingStatus.ffmpegProgress = percent;
  global.processingStatus.timemarks = timemarks;
}

// 停止图片处理
app.post("/api/stop-image-processing", (req, res) => {
  global.processingStatus.isProcessing = false;
  global.processingStatus.type = null;

  console.log("停止图片处理请求已接收");
  res.json({ success: true, message: "图片处理已停止" });
});

// 停止视频处理
app.post("/api/stop-video-processing", (req, res) => {
  global.processingStatus.isProcessing = false;
  global.processingStatus.type = null;

  console.log("停止视频处理请求已接收");
  res.json({
    success: true,
    message: "视频处理已停止（将在当前视频完成后生效）",
  });
});
