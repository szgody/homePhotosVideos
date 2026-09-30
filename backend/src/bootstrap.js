// 启动前初始化:确保所有数据目录存在 Ensure all data dirs exist
const fs = require("fs-extra");
const { PATHS } = require("./config");

const DIRS = [
  PATHS.DATA_DIR,
  PATHS.PUBLIC_DIR,
  PATHS.ORIGINAL_IMAGES,
  PATHS.ORIGINAL_VIDEOS,
  PATHS.PHOTOS,
  PATHS.PHOTO_THUMBNAILS,
  PATHS.VIDEOS,
  PATHS.VIDEO_THUMBNAILS,
];

async function ensureDirectories() {
  for (const dir of DIRS) {
    await fs.ensureDir(dir);
  }
}

module.exports = { ensureDirectories };
