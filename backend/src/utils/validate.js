// 文件名校验:防路径遍历与非法类型 Filename validation: path traversal & type whitelist
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv"]);

// 必须是纯文件名:非绝对路径、无分隔符、无 ..、等于自身 basename
function isValidFilename(filename) {
  if (typeof filename !== "string" || filename.length === 0) return false;
  if (path.isAbsolute(filename)) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  if (filename.includes("..")) return false;
  if (filename !== path.basename(filename)) return false;
  return true;
}

function isAllowedImage(filename) {
  return isValidFilename(filename) && IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isAllowedVideo(filename) {
  return isValidFilename(filename) && VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

module.exports = { isValidFilename, isAllowedImage, isAllowedVideo, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS };
