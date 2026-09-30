// 视频处理服务测试 Video processor tests
// 重点:两阶段提交 —— 处理中的半成品不得出现在最终目录(/api/videos 列表来源)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const { spawnSync } = require("node:child_process");
const { processVideo } = require("../../src/services/videoProcessor");
const { state } = require("../../src/state");

// 列表接口的过滤规则(与 routes/videos.js 保持一致)
const VIDEO_REGEX = /\.(mp4|mov|avi|mkv|m4v|wmv)$/i;
const TEMP_DIR_NAME = ".processing-tmp";

// ffmpeg 是否可用(不可用时跳过依赖转码的用例,而不是让整个测试失败)
function hasFfmpeg() {
  try {
    return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

const FFMPEG_AVAILABLE = hasFfmpeg();

// 构造一套临时目录(替代真实 PATHS,不污染 data/ 与 public/)
async function makePaths() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "video-"));
  const paths = {
    ORIGINAL_VIDEOS: path.join(root, "original"),
    VIDEOS: path.join(root, "videos"),
    VIDEO_THUMBNAILS: path.join(root, "thumbs"),
  };
  await Promise.all(Object.values(paths).map((p) => fs.ensureDir(p)));
  return { root, paths };
}

// 生成测试视频:输入用 ultrafast 快速生成,处理时进程内用 medium 转码(窗口足够观测)
function makeTestVideo(targetPath, seconds) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-f", "lavfi",
      "-i", `testsrc=size=640x360:rate=25`,
      "-t", String(seconds),
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-y",
      targetPath,
    ],
    { stdio: "ignore" },
  );
  assert.equal(result.status, 0, "生成测试视频失败(ffmpeg)");
}

// 模拟列表接口:readdir + 正则过滤
async function listVideos(dir) {
  const files = await fs.readdir(dir);
  return files.filter((file) => VIDEO_REGEX.test(file));
}

async function waitFor(predicate, timeoutMs = 10000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

test("processVideo 成功后才把视频与缩略图落到最终目录", { skip: !FFMPEG_AVAILABLE }, async () => {
  const { root, paths } = await makePaths();
  makeTestVideo(path.join(paths.ORIGINAL_VIDEOS, "clip.mp4"), 2);

  try {
    const result = await processVideo("clip.mp4", "000001", paths);

    assert.equal(result.cancelled, undefined);
    assert.ok(await fs.pathExists(result.outputPath), "最终视频应存在");
    assert.ok(await fs.pathExists(result.thumbnailPath), "缩略图应存在");
    // 最终目录中只有成品能被列表接口看到
    assert.deepEqual(await listVideos(paths.VIDEOS), ["000001.mp4"]);
    // 临时目录不残留(清理后目录本身也被移除)
    assert.ok(!(await fs.pathExists(path.join(paths.VIDEOS, TEMP_DIR_NAME))), "视频临时目录应被清理");
    assert.ok(!(await fs.pathExists(path.join(paths.VIDEO_THUMBNAILS, TEMP_DIR_NAME))), "缩略图临时目录应被清理");
  } finally {
    delete state.videoProgressData["clip.mp4"];
    await fs.remove(root);
  }
});

test("processVideo 转码中途半成品不出现在最终目录,取消后无残留", { skip: !FFMPEG_AVAILABLE }, async () => {
  const { root, paths } = await makePaths();
  // 40 秒素材:输入生成快,但进程内以 medium 重编码需要数秒,足以观测中途状态
  makeTestVideo(path.join(paths.ORIGINAL_VIDEOS, "long.mp4"), 40);

  const targetPath = path.join(paths.VIDEOS, "000002.mp4");
  const tempPath = path.join(paths.VIDEOS, TEMP_DIR_NAME, "000002.mp4");

  try {
    const processing = processVideo("long.mp4", "000002", paths);

    // 等半成品在临时目录出现
    const staged = await waitFor(() => fs.pathExists(tempPath));
    assert.ok(staged, "转码应在临时目录产生半成品");

    // 关键断言:此刻最终目录里没有任何可被 /api/videos 列出的文件
    assert.deepEqual(await listVideos(paths.VIDEOS), [], "处理中的视频不应出现在最终目录");
    assert.ok(await fs.pathExists(targetPath) === false, "最终文件此时不应存在");

    // 模拟取消:与 /api/cancel-processing 一致地终止 ffmpeg
    const command = state.activeFFmpegProcesses["long.mp4"];
    assert.ok(command, "应记录活跃 ffmpeg 进程");
    command.kill("SIGTERM");

    const result = await processing;
    assert.equal(result.cancelled, true, "应返回取消标记");
    assert.ok(!(await fs.pathExists(targetPath)), "取消后最终文件不应存在");
    assert.ok(!(await fs.pathExists(tempPath)), "取消后临时半成品应被清理");
    assert.deepEqual(await listVideos(paths.VIDEOS), [], "取消后列表仍应为空");
  } finally {
    delete state.videoProgressData["long.mp4"];
    delete state.activeFFmpegProcesses["long.mp4"];
    await fs.remove(root);
  }
});
