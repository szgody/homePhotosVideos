// 上传路由:接收图片/视频,安全审查后放入待处理目录 Upload route with security screening
const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const crypto = require("crypto");
const router = express.Router();
const { PATHS } = require("../config");
const { sniffImage } = require("../utils/sniff");
const { validateVideoFile } = require("../services/videoProcessor");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv"]);

// 磁盘暂存到系统临时目录(视频不占内存),文件名随机化
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `upload-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 单文件上限 3GB(图片另行限 50MB)
});

// 生成安全落盘文件名:时间戳-随机数.扩展名,永不使用用户文件名(阻断脚本路径)
function safeTargetName(ext) {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
}

router.post("/upload", upload.array("files", 20), async (req, res) => {
  const type = req.body.type === "video" ? "video" : "image";
  const files = req.files || [];
  const results = [];

  // 无论成败都清理临时文件
  const cleanup = () => {
    for (const f of files) {
      fs.remove(f.path).catch(() => {});
    }
  };

  try {
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: "未收到文件" });
    }

    for (const file of files) {
      const originalName = file.originalname || "未知";
      const ext = path.extname(originalName).toLowerCase();
      const targetDir = type === "video" ? PATHS.ORIGINAL_VIDEOS : PATHS.ORIGINAL_IMAGES;

      try {
        // 1) 扩展名白名单
        const allowed = type === "video" ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
        if (!allowed.has(ext)) {
          results.push({ originalName, rejected: `不允许的扩展名: ${ext || "无"}` });
          continue;
        }

        // 2) 图片大小限制 50MB
        if (type === "image") {
          const size = (await fs.stat(file.path)).size;
          if (size > 50 * 1024 * 1024) {
            results.push({ originalName, rejected: "图片超过 50MB 限制" });
            continue;
          }
        }

        // 3) 魔数嗅探:图片 sharp 解码,视频 ffprobe 验证含视频流(脚本/伪造内容被拒)
        if (type === "image") {
          const buffer = await fs.readFile(file.path);
          const { format } = await sniffImage(buffer);
          const matched =
            format === "jpeg" ? ext === ".jpg" || ext === ".jpeg" : ext === `.${format}`;
          if (!matched) {
            results.push({ originalName, rejected: `内容与扩展名不符(实际 ${format})` });
            continue;
          }
        } else {
          await validateVideoFile(file.path); // 无视频流会抛错
        }

        // 4) 改名落盘至待处理目录(该目录不对外提供静态服务,脚本无法执行)
        const targetExt = ext === ".jpeg" ? ".jpg" : ext;
        const targetName = safeTargetName(targetExt);
        await fs.move(file.path, path.join(targetDir, targetName), { overwrite: false });
        results.push({ originalName, success: true, savedAs: targetName });
      } catch (error) {
        results.push({ originalName, rejected: error.message });
      }
    }

    res.json({ success: true, type, results });
  } catch (error) {
    console.error("上传处理失败:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    cleanup();
  }
});

module.exports = router;
