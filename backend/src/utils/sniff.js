// 上传文件魔数嗅探 Upload file magic-byte sniffing
const sharp = require("sharp");

// 允许的图片格式(以 sharp 解码结果为准,与扩展名白名单一致)
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "gif", "webp"]);

// 嗅探图片:用 sharp 解码 metadata,非图片内容(脚本/文本伪装)会抛错
async function sniffImage(buffer) {
  const metadata = await sharp(buffer).metadata();
  const format = metadata.format || "";
  if (!ALLOWED_IMAGE_FORMATS.has(format)) {
    throw new Error(`不允许的图片格式: ${format || "未知"}`);
  }
  return { format, width: metadata.width, height: metadata.height };
}

module.exports = { sniffImage, ALLOWED_IMAGE_FORMATS };
