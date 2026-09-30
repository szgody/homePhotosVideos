// 检查项目结构是否符合重构后布局 Check project structure
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const REQUIRED = [
  "backend/server.js",
  "backend/src/app.js",
  "backend/src/config.js",
  "backend/src/bootstrap.js",
  "backend/src/state.js",
  "backend/src/routes/photos.js",
  "backend/src/routes/videos.js",
  "backend/src/services/imageProcessor.js",
  "backend/src/services/videoProcessor.js",
  "backend/src/utils/validate.js",
  "backend/src/utils/sn.js",
  "backend/test/api.test.js",
  "src/api/client.js",
  "src/composables/useProcessing.js",
  "src/views/ProcessingView.vue",
  "vite.config.js",
];

const FORBIDDEN = [
  "server.js", // 旧版根后端已删除
  "backend/app.js",
  "backend/config/ffmpeg.js",
  "backend/controllers/videoController.js",
  "backend/ffmpeg-installer.js",
  "src/views/Home.vue",
  "src/views/Processing_Background.vue",
  "src/components/SessionStorage.vue",
  "src/assets",
  "home-photo_nginx.conf",
  "docker-compose/docker-compose.yml",
  "vue",
];

let failed = false;

for (const rel of REQUIRED) {
  const ok = fs.existsSync(path.join(ROOT, rel));
  console.log(`${ok ? "PASS" : "FAIL"} 必须存在: ${rel}`);
  if (!ok) failed = true;
}

for (const rel of FORBIDDEN) {
  const bad = fs.existsSync(path.join(ROOT, rel));
  console.log(`${bad ? "FAIL" : "PASS"} 应已删除: ${rel}`);
  if (bad) failed = true;
}

console.log(failed ? "结构检查未通过" : "结构检查通过");
process.exit(failed ? 1 : 0);
