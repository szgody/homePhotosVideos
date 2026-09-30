// 视频相关路由 Video routes
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const { PATHS, BASE_URL } = require("../config");
const { readSn, writeSn } = require("../utils/sn");
const { processVideo } = require("../services/videoProcessor");
const { state } = require("../state");
const { isValidFilename, isAllowedVideo } = require("../utils/validate");

const VIDEO_REGEX = /\.(mp4|mov|avi|mkv|m4v|wmv)$/i;

// 获取已处理视频列表(支持 limit)
router.get("/videos", async (req, res) => {
  try {
    let files = await fs.readdir(PATHS.VIDEOS);
    files = files.filter((file) => VIDEO_REGEX.test(file));
    const limit = parseInt(req.query.limit, 10);
    if (Number.isFinite(limit) && limit > 0) {
      files = files.slice(0, limit);
    }
    const videos = files.map((file) => {
      const basename = path.basename(file, path.extname(file));
      return {
        filename: file,
        videoPath: `${BASE_URL}/videos/${file}`,
        thumbnailPath: `${BASE_URL}/video_thumbnails/${basename}.jpg`,
      };
    });
    res.json({ videos });
  } catch (error) {
    console.error("获取视频列表失败:", error);
    res.status(500).json({ error: "获取视频列表失败", message: error.message });
  }
});

// 获取待处理原始视频列表
router.get("/list-videos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    res.json({ videos: files.filter((file) => VIDEO_REGEX.test(file)) });
  } catch (error) {
    console.error("获取待处理视频失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 读取视频序号
router.get("/read-video-sn", async (req, res) => {
  try {
    const sn = await readSn(PATHS.VIDEO_SN_FILE);
    res.json({ sn });
  } catch (error) {
    console.error(`读取视频序号出错: ${error.message}`);
    res.status(500).json({ error: `读取视频序号失败: ${error.message}` });
  }
});

// 写入视频序号
router.post("/write-video-sn", async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn || !/^\d+$/.test(String(sn))) {
      return res.status(400).json({ success: false, error: `无效的序号格式: "${sn}"` });
    }
    await writeSn(PATHS.VIDEO_SN_FILE, sn);
    res.json({ success: true, sn });
  } catch (error) {
    console.error(`写入视频序号出错: ${error.message}`);
    res.status(500).json({ success: false, error: `写入视频序号失败: ${error.message}` });
  }
});

// 批量处理视频(立即返回待处理清单)
router.post("/process-videos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    const videoFiles = files.filter((file) => VIDEO_REGEX.test(file));

    if (videoFiles.length === 0) {
      return res.json({ message: "没有找到需要处理的视频", results: [] });
    }

    res.json({ message: "开始处理视频", totalFiles: videoFiles.length, files: videoFiles });
  } catch (error) {
    console.error("处理过程出错:", error);
    res.status(500).json({ error: error.message });
  }
});

// 处理单个视频
router.post("/process-single-video", async (req, res) => {
  try {
    const { filename, newName, deleteOriginal } = req.body;

    // Fix Bug #6:统一文件名校验
    if (!isAllowedVideo(filename)) {
      return res.status(400).json({ success: false, error: "无效的文件名" });
    }
    if (!newName || !/^\d{6}$/.test(String(newName))) {
      return res.status(400).json({ success: false, error: "新文件名必须为 6 位序号" });
    }

    const result = await processVideo(filename, newName);

    if (deleteOriginal === true) {
      await fs.remove(result.originalPath);
      console.log(`已删除原始视频: ${result.originalPath}`);
    }

    res.json({
      success: true,
      originalName: filename,
      newName: result.newName,
      sn: newName,
      video: `${BASE_URL}/videos/${result.newName}`,
      thumbnail: `${BASE_URL}/video_thumbnails/${newName}.jpg`,
    });
  } catch (error) {
    console.error("处理视频失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 视频进度(轮询接口)
router.get("/video-progress", (req, res) => {
  const { filename } = req.query;

  if (!filename || !isValidFilename(filename)) {
    return res.status(400).json({ error: "缺少或非法文件名参数" });
  }

  const progressData = state.videoProgressData[filename] || { percent: 0, status: "unknown" };
  res.json(progressData);
});

// 视频进度(路径参数形式,保留兼容)
router.get("/video-progress/:filename", (req, res) => {
  const { filename } = req.params;
  if (!isValidFilename(filename)) {
    return res.status(400).json({ error: "非法文件名参数" });
  }
  const progressData = state.videoProgressData[filename] || { percent: 0, status: "unknown" };
  res.json(progressData);
});

// 取消处理
router.post("/cancel-processing", async (req, res) => {
  try {
    const { type, file } = req.body;
    if (!file || !isValidFilename(file)) {
      return res.status(400).json({ success: false, error: "缺少或非法文件名" });
    }

    state.processingCancelled[file] = true;

    const ffmpegCommand = state.activeFFmpegProcesses[file];
    if (ffmpegCommand) {
      console.log(`终止 ffmpeg 进程: ${file}`);
      ffmpegCommand.kill("SIGTERM");
      delete state.activeFFmpegProcesses[file];
    }

    if (state.videoProgressData[file]) {
      state.videoProgressData[file].status = "cancelled";
    }

    res.json({ success: true, message: `已发送取消信号${type ? ` (${type})` : ""}` });
  } catch (error) {
    console.error(`取消处理出错: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除原始视频(单文件)
router.post("/delete-original-video", async (req, res) => {
  try {
    const { filename } = req.body;

    if (!isValidFilename(filename)) {
      return res.status(400).json({ success: false, error: "无效的文件名" });
    }

    const filePath = path.join(PATHS.ORIGINAL_VIDEOS, filename);
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ success: false, error: "文件不存在" });
    }

    await fs.remove(filePath);
    console.log(`已删除损坏的视频文件: ${filename}`);
    res.json({ success: true, message: `文件 ${filename} 已被删除` });
  } catch (error) {
    console.error(`删除视频文件失败: ${error.message}`);
    res.status(500).json({ success: false, error: `删除文件失败: ${error.message}` });
  }
});

// 删除全部原始视频
router.post("/delete-all-original-videos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_VIDEOS);
    let deletedCount = 0;
    const errorFiles = [];

    for (const file of files) {
      if (!isValidFilename(file)) {
        errorFiles.push(file);
        continue;
      }
      try {
        await fs.remove(path.join(PATHS.ORIGINAL_VIDEOS, file));
        deletedCount++;
      } catch (fileError) {
        errorFiles.push(file);
      }
    }

    res.json({
      success: true,
      deletedCount,
      hasErrors: errorFiles.length > 0,
      errorCount: errorFiles.length,
      message: errorFiles.length > 0 ? `${errorFiles.length} 个文件删除失败` : "",
    });
  } catch (error) {
    console.error("删除视频出错:", error);
    res.json({ success: false, message: error.message, deletedCount: 0 });
  }
});

module.exports = router;
