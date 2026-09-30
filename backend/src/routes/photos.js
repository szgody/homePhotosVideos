// 照片相关路由 Photo routes
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const { PATHS, BASE_URL } = require("../config");
const { readSn, writeSn } = require("../utils/sn");
// 单图接口保留原有实现,批量接口改用有界并发版本
const { processImage, processImagesBatchConcurrent } = require("../services/imageProcessor");
const { state } = require("../state");
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

// 构造「批量处理图片」路由处理器:有界并发 + 序号连续无空洞
// 两个入口只有「输出规格 / 是否删除原图」不同,其余(校验、守卫、序号、取消)完全共享
function createImageBatchHandler({ variant, deleteOriginal }) {
  return async (req, res) => {
    // 防重复提交:并发批处理期间再次提交会破坏序号连续性(与视频 409 守卫一致)
    if (state.imageProcessingActive) {
      return res.status(409).json({ success: false, error: "图片处理任务正在进行中" });
    }

    try {
      // 1) 解析并校验文件清单(所有接收文件名的接口都必须先校验,防路径遍历)
      const { files } = req.body || {};
      let imageFiles;

      if (files === undefined || files === null) {
        const all = await fs.readdir(PATHS.ORIGINAL_IMAGES);
        imageFiles = all.filter((file) => IMAGE_REGEX.test(file));
      } else if (!Array.isArray(files)) {
        return res.status(400).json({ success: false, error: "files 必须为文件名数组" });
      } else if (files.some((file) => !isAllowedImage(file))) {
        return res.status(400).json({ success: false, error: "无效的文件名" });
      } else {
        imageFiles = files;
      }

      if (imageFiles.length === 0) {
        return res.json({ message: "没有找到需要处理的图片", results: [], cancelled: false });
      }

      // 2) 序号由后端统一读写,保证并发下仍然连续
      const currentSN = await readSn(PATHS.PHOTO_SN_FILE);
      // 新批次开始,清除上次的中断标志
      state.processingCancelled.images = false;
      state.imageProcessingActive = true;

      try {
        const { results, nextSN, cancelled, concurrency } = await processImagesBatchConcurrent(
          imageFiles,
          currentSN,
          PATHS,
          { variant, deleteOriginal },
        );
        await writeSn(PATHS.PHOTO_SN_FILE, nextSN);

        console.log(
          `图片批处理结束(${variant}): 文件数 ${imageFiles.length}, 并发 ${concurrency}, ${cancelled ? "已中止" : "全部完成"}`,
        );

        res.json({
          message: cancelled ? "处理已中止" : "处理完成",
          results,
          nextSN,
          cancelled: !!cancelled,
          concurrency,
        });
      } finally {
        state.imageProcessingActive = false;
      }
    } catch (error) {
      console.error("处理过程出错:", error);
      res.status(500).json({ error: error.message });
    }
  };
}

// 批量处理图片(历史规格:压缩 800x600 + 100x100 缩略图,成功即删除原图)
// 可传 files 指定清单,缺省处理目录下全部图片
router.post("/process-images", createImageBatchHandler({ variant: "compress", deleteOriginal: true }));

// 批量处理图片(与单图接口 /process-single-image 规格一致:原图复制 + 240x240 缩略图,默认保留原图)
// 前端处理页分块调用本接口,以最小改动获得有界并发加速
router.post(
  "/process-images-batch",
  createImageBatchHandler({ variant: "ui", deleteOriginal: false }),
);

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
