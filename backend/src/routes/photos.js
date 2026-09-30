// 照片相关路由 Photo routes
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const { PATHS, BASE_URL } = require("../config");
const { readSn, writeSn } = require("../utils/sn");
const { processImage, processImagesBatch } = require("../services/imageProcessor");
const { isValidFilename, isAllowedImage } = require("../utils/validate");

const IMAGE_REGEX = /\.(jpg|jpeg|png|gif|webp)$/i;

// 获取已处理照片列表
router.get("/photos", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.PHOTOS);
    const photos = files
      .filter((file) => IMAGE_REGEX.test(file))
      .map((file) => ({
        filename: file,
        photo: `${BASE_URL}/photos/${file}`,
        thumbnail: `${BASE_URL}/photo_thumbnails/${file}`,
      }));
    res.json({ photos });
  } catch (error) {
    console.error("获取照片列表失败:", error);
    res.status(500).json({ error: "获取照片列表失败", message: error.message });
  }
});

// 获取待处理原始图片列表
router.get("/list-images", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    res.json({ images: files.filter((file) => IMAGE_REGEX.test(file)) });
  } catch (error) {
    console.error("获取待处理图片失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 读取照片序号
router.get("/read-sn", async (req, res) => {
  try {
    const sn = await readSn(PATHS.PHOTO_SN_FILE);
    res.json({ sn });
  } catch (error) {
    console.error(`读取序号出错: ${error.message}`);
    res.status(500).json({ error: `读取序号失败: ${error.message}` });
  }
});

// 写入照片序号
router.post("/write-sn", async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn || !/^\d+$/.test(String(sn))) {
      return res.status(400).json({ success: false, error: `无效的序号格式: "${sn}"` });
    }
    await writeSn(PATHS.PHOTO_SN_FILE, sn);
    res.json({ success: true, sn });
  } catch (error) {
    console.error(`写入序号出错: ${error.message}`);
    res.status(500).json({ success: false, error: `写入序号失败: ${error.message}` });
  }
});

// 批量处理图片
router.post("/process-images", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    const imageFiles = files.filter((file) => IMAGE_REGEX.test(file));

    if (imageFiles.length === 0) {
      return res.json({ message: "没有找到需要处理的图片", results: [] });
    }

    const currentSN = await readSn(PATHS.PHOTO_SN_FILE);
    const { results, nextSN } = await processImagesBatch(imageFiles, currentSN);
    await writeSn(PATHS.PHOTO_SN_FILE, nextSN);

    res.json({ message: "处理完成", results, nextSN });
  } catch (error) {
    console.error("处理过程出错:", error);
    res.status(500).json({ error: error.message });
  }
});

// 处理单张图片(修复 Bug #1:删除引用未定义变量的重复版本,保留本实现)
router.post("/process-single-image", async (req, res) => {
  try {
    const { filename = "", newName = "" } = req.body;

    // Fix Bug #6:所有接收文件名的路由统一校验
    if (!isAllowedImage(filename)) {
      return res.status(400).json({ success: false, error: "无效的文件名" });
    }
    if (!newName || !/^\d{6}$/.test(String(newName))) {
      return res.status(400).json({ success: false, error: "新文件名必须为 6 位序号" });
    }

    console.log(`开始处理图片: ${filename} -> ${newName}`);
    const startTime = Date.now();
    const result = await processImage(filename, newName);
    const processTime = Date.now() - startTime;

    res.json({
      success: true,
      originalName: filename,
      newName: result.newName,
      processTime,
      memoryUsage: process.memoryUsage(),
    });
  } catch (error) {
    console.error("处理图片失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除全部原始图片
router.post("/delete-all-original-images", async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ORIGINAL_IMAGES);
    let deletedCount = 0;
    const errorFiles = [];

    for (const file of files) {
      if (!isValidFilename(file)) {
        errorFiles.push(file);
        continue;
      }
      try {
        await fs.remove(path.join(PATHS.ORIGINAL_IMAGES, file));
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
    console.error("删除原始图片出错:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
