// 图片处理服务 Image processing service
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const { PATHS, IMAGE_CONCURRENCY, MAX_IMAGE_CONCURRENCY } = require("../config");
const { state } = require("../state");
const { mapWithConcurrency } = require("../utils/concurrency");

// 并发处理的临时目录名(位于目标目录内,保证 rename 不跨卷;
// 以点开头,不会被列表接口的扩展名正则匹配到)
const TEMP_DIR_NAME = ".processing-tmp";

// 解析并发数:显式传入优先,否则用配置默认值;非法值回退 1,并限制上界
function resolveImageConcurrency(explicit) {
  const raw = explicit === undefined || explicit === null ? IMAGE_CONCURRENCY : explicit;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.min(value, MAX_IMAGE_CONCURRENCY);
}

// 输出规格:两套既有行为都保留,避免"优化"改变输出结果
// Output variants: both existing specs are preserved so tuning never changes output
// - ui:       与 /api/process-single-image(processImage)一致 —— 原图直接复制 + 240x240 缩略图
// - compress: 历史批处理 /api/process-images 的规格 —— 压缩 800x600 + 100x100 缩略图
const OUTPUT_VARIANTS = {
  ui: {
    photo: null, // null 表示直接复制原图,不做重编码
    thumbnail: { width: 240, height: 240, fit: "cover" },
  },
  compress: {
    photo: { width: 800, height: 600, fit: "inside", withoutEnlargement: true, quality: 80 },
    thumbnail: { width: 100, height: 100, fit: "cover", quality: 60 },
  },
};

// 解析输出规格:非法值回退 compress(保持历史默认)
function resolveVariant(name) {
  return OUTPUT_VARIANTS[name] || OUTPUT_VARIANTS.compress;
}

// 生成一套输出:主图(复制或压缩)+ 缩略图;JPEG 按规格质量编码,其它格式沿用 sharp 默认
async function buildImageVariants(sourcePath, photoPath, thumbnailPath, variant) {
  const isJpeg = /\.(jpg|jpeg)$/i.test(path.extname(sourcePath));

  if (variant.photo) {
    let resizeChain = sharp(sourcePath).resize(variant.photo.width, variant.photo.height, {
      fit: variant.photo.fit,
      withoutEnlargement: !!variant.photo.withoutEnlargement,
    });
    if (isJpeg && variant.photo.quality) {
      resizeChain = resizeChain.jpeg({ quality: variant.photo.quality });
    }
    await resizeChain.toFile(photoPath);
  } else {
    // 原图直接复制(保留原始分辨率,不做重编码)
    await fs.copy(sourcePath, photoPath);
  }

  let thumbChain = sharp(sourcePath).resize(variant.thumbnail.width, variant.thumbnail.height, {
    fit: variant.thumbnail.fit,
  });
  if (isJpeg && variant.thumbnail.quality) {
    thumbChain = thumbChain.jpeg({ quality: variant.thumbnail.quality });
  }
  await thumbChain.toFile(thumbnailPath);
}

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

  await buildImageVariants(sourcePath, targetPath, thumbnailPath, OUTPUT_VARIANTS.ui);

  return { newName: finalName, originalPath: sourcePath, targetPath, thumbnailPath };
}

// 批量处理(串行语义包装,保持历史行为不变):
// 压缩 800x600 + 100x100 缩略图 + 删除原文件 + 递增序号
// 实现复用并发版(concurrency=1),避免两套逻辑漂移
async function processImagesBatch(imageFiles, startSN, paths = PATHS) {
  const { results, nextSN, cancelled } = await processImagesBatchConcurrent(imageFiles, startSN, paths, {
    concurrency: 1,
    variant: "compress",
    deleteOriginal: true,
  });
  return { results, nextSN, cancelled };
}

// 批量处理(有界并发):两阶段提交,保证序号语义与串行版完全一致
// Concurrent batch: two-phase commit keeps SN semantics identical to the serial version
// 阶段一:用 worker pool 并发「解码 + 压缩」到临时目录,不消耗序号,单文件失败互不影响
// 阶段二:按输入顺序串行落盘命名 —— 序号连续无空洞、失败文件不消耗序号、取消后原图保留
async function processImagesBatchConcurrent(imageFiles, startSN, paths = PATHS, options = {}) {
  if (!/^\d+$/.test(String(startSN))) {
    throw new Error(`无效的序号: "${startSN}"`);
  }

  const concurrency = resolveImageConcurrency(options.concurrency);
  const variant = resolveVariant(options.variant);
  // 默认保留原图(由调用方显式决定是否删除,避免误删用户原始素材)
  const deleteOriginal = options.deleteOriginal === true;

  if (imageFiles.length === 0) {
    return { results: [], nextSN: String(startSN), cancelled: false, concurrency };
  }

  const photosTmp = path.join(paths.PHOTOS, TEMP_DIR_NAME);
  const thumbsTmp = path.join(paths.PHOTO_THUMBNAILS, TEMP_DIR_NAME);
  await fs.ensureDir(photosTmp);
  await fs.ensureDir(thumbsTmp);

  const results = [];
  let currentSN = startSN;

  try {
    // ===== 阶段一:并发压缩到临时目录(不含序号)=====
    const staged = await mapWithConcurrency(
      imageFiles,
      concurrency,
      async (file, index) => {
        const ext = path.extname(file);
        const sourcePath = path.join(paths.ORIGINAL_IMAGES, file);
        const tempName = `part${String(index).padStart(6, "0")}${ext}`;

        try {
          await buildImageVariants(
            sourcePath,
            path.join(photosTmp, tempName),
            path.join(thumbsTmp, tempName),
            variant,
          );
          return { file, ext, tempName };
        } catch (error) {
          return { file, error: error.message };
        }
      },
      // 取消信号:不再领取新任务,已在处理的文件自然收尾
      () => state.processingCancelled.images === true,
    );

    // ===== 阶段二:按输入顺序落盘并分配序号 =====
    for (let index = 0; index < imageFiles.length; index++) {
      const item = staged[index];
      if (!item) {
        // 被取消而未启动的文件:原图保留,不计入结果
        break;
      }

      if (item.error) {
        console.error(`处理图片 ${item.file} 失败:`, item.error);
        results.push({ originalName: item.file, error: item.error });
        continue;
      }

      const finalName = `${currentSN}${item.ext}`;
      const targetPath = path.join(paths.PHOTOS, finalName);
      const thumbnailPath = path.join(paths.PHOTO_THUMBNAILS, finalName);
      const originalPath = path.join(paths.ORIGINAL_IMAGES, item.file);

      try {
        // 同卷 rename,代价远低于重新编码
        await fs.move(path.join(photosTmp, item.tempName), targetPath, { overwrite: true });
        await fs.move(path.join(thumbsTmp, item.tempName), thumbnailPath, { overwrite: true });
        if (deleteOriginal) {
          await fs.remove(originalPath);
        }
      } catch (error) {
        // 回滚已落盘的输出,避免留下没有序号的孤儿文件
        await fs.remove(targetPath).catch(() => {});
        await fs.remove(thumbnailPath).catch(() => {});
        console.error(`处理图片 ${item.file} 失败:`, error);
        results.push({ originalName: item.file, error: error.message });
        continue;
      }

      results.push({ originalName: item.file, newName: finalName, sn: currentSN });
      currentSN = String(Number(currentSN) + 1).padStart(6, "0");
    }
  } finally {
    // 清理临时目录(成功、失败、取消路径都要清)
    await fs.remove(photosTmp).catch(() => {});
    await fs.remove(thumbsTmp).catch(() => {});
  }

  // 结果数少于文件数即表示中途被取消(未启动的文件被跳过)
  const cancelled = results.length < imageFiles.length;

  return { results, nextSN: currentSN, cancelled, concurrency };
}

module.exports = { processImage, processImagesBatch, processImagesBatchConcurrent, resolveImageConcurrency };

