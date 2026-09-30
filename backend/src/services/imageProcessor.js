// 图片处理服务 Image processing service
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const { PATHS } = require("../config");

// 处理单张图片:复制原图 + 生成 240x240 缩略图(默认路径,测试可注入)
async function processImage(filename, newName, paths = PATHS) {
  const ext = path.extname(filename).toLowerCase();
  const finalName = `${newName}${ext}`;
  const sourcePath = path.join(paths.ORIGINAL_IMAGES, filename);
  const targetPath = path.join(paths.PHOTOS, finalName);
  const thumbnailPath = path.join(paths.PHOTO_THUMBNAILS, finalName);

  if (!(await fs.pathExists(sourcePath))) {
    throw new Error(`源文件不存在: ${sourcePath}`);
  }

  await fs.copy(sourcePath, targetPath);
  await sharp(sourcePath).resize(240, 240, { fit: "cover" }).toFile(thumbnailPath);

  return { newName: finalName, originalPath: sourcePath, targetPath, thumbnailPath };
}

// 批量处理:压缩 800x600 原图 + 100x100 缩略图 + 删除原文件 + 递增序号
async function processImagesBatch(imageFiles, startSN, paths = PATHS) {
  if (!/^\d+$/.test(String(startSN))) {
    throw new Error(`无效的序号: "${startSN}"`);
  }
  let currentSN = startSN;
  const results = [];

  for (const file of imageFiles) {
    try {
      const ext = path.extname(file);
      const newName = `${currentSN}${ext}`;
      const originalPath = path.join(paths.ORIGINAL_IMAGES, file);
      const isJpeg = /\.(jpg|jpeg)$/i.test(newName);

      let resizeChain = sharp(originalPath).resize(800, 600, { fit: "inside", withoutEnlargement: true });
      if (isJpeg) resizeChain = resizeChain.jpeg({ quality: 80 });
      await resizeChain.toFile(path.join(paths.PHOTOS, newName));

      let thumbChain = sharp(originalPath).resize(100, 100, { fit: "cover" });
      if (isJpeg) thumbChain = thumbChain.jpeg({ quality: 60 });
      await thumbChain.toFile(path.join(paths.PHOTO_THUMBNAILS, newName));

      await fs.remove(originalPath);

      results.push({ originalName: file, newName, sn: currentSN });
      currentSN = String(Number(currentSN) + 1).padStart(6, "0");
    } catch (error) {
      console.error(`处理图片 ${file} 失败:`, error);
      results.push({ originalName: file, error: error.message });
    }
  }

  return { results, nextSN: currentSN };
}

module.exports = { processImage, processImagesBatch };
