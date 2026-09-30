// 视频处理服务:ffprobe 验证 + ffmpeg 转码 + 缩略图,进度写入 state
const path = require("path");
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const { PATHS, FFMPEG_PATH, FFPROBE_PATH, VIDEO_THREADS, VIDEO_PRESET } = require("../config");
const { state, resetFileState } = require("../state");

// 转码参数:preset 默认 medium(与历史一致),线程数按硬件推导并限制(见 config.js)
// 说明:x264 帧级并行收益在 8~12 线程后递减,固定线程数还能抑制内存随线程数上涨
const VIDEO_OUTPUT_OPTIONS = [
  "-c:v libx264",
  `-preset ${VIDEO_PRESET}`,
  `-threads ${VIDEO_THREADS}`,
  "-crf 23",
  "-c:a aac",
  "-b:a 128k",
];

// 应用环境变量中的 ffmpeg 路径(缺省走系统 PATH)
if (FFMPEG_PATH) ffmpeg.setFfmpegPath(FFMPEG_PATH);
if (FFPROBE_PATH) ffmpeg.setFfprobePath(FFPROBE_PATH);

// 视频文件验证(ffprobe) Validate video file with ffprobe
function validateVideoFile(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`视频文件验证失败: ${err.message}`));
      }
      const videoStreams = metadata.streams.filter((s) => s.codec_type === "video");
      if (videoStreams.length === 0) {
        return reject(new Error("此文件不包含视频流"));
      }
      resolve({
        duration: metadata.format.duration || 0,
        size: metadata.format.size || 0,
        bitrate: metadata.format.bit_rate || 0,
        format: metadata.format.format_name || "",
        codec: videoStreams[0].codec_name || "",
        width: videoStreams[0].width || 0,
        height: videoStreams[0].height || 0,
      });
    });
  });
}

// 判断是否为用户取消导致的错误(与 /api/cancel-processing 呼应)
function isCancelError(err) {
  return (
    err.message.includes("signal 15") ||
    err.message.includes("code 255") ||
    err.message.includes("SIGTERM")
  );
}

// 转码单个视频 + 生成缩略图。进度写入 state.videoProgressData[filename]
// Fix: 不再整体重置 videoProgressData,避免批量处理时清掉其他视频的进度(Bug #3)
async function processVideo(filename, newName, paths = PATHS) {
  const finalNewName = `${newName}.mp4`;
  const originalPath = path.join(paths.ORIGINAL_VIDEOS, filename);
  const outputPath = path.join(paths.VIDEOS, finalNewName);
  const thumbnailPath = path.join(paths.VIDEO_THUMBNAILS, `${newName}.jpg`);

  console.log("开始处理视频:", { filename, newName: finalNewName, originalPath, outputPath, thumbnailPath });

  if (!(await fs.pathExists(originalPath))) {
    throw new Error(`源文件不存在: ${originalPath}`);
  }

  // 仅初始化当前文件的进度条目
  state.videoProgressData[filename] = { percent: 0, status: "validating" };

  // ffprobe 失败时写入 error 状态再抛出(保持与原实现一致)
  let videoInfo;
  try {
    videoInfo = await validateVideoFile(originalPath);
  } catch (err) {
    state.videoProgressData[filename] = {
      status: "error",
      error: `视频文件验证失败: ${err.message}`,
    };
    throw err;
  }
  console.log(`视频文件验证通过: ${filename}`, videoInfo);
  state.videoProgressData[filename] = {
    percent: 0,
    timemarks: "",
    status: "processing",
    videoInfo,
  };

  let cancelled = false;
  try {
    await new Promise((resolve, reject) => {
      const ffmpegCommand = ffmpeg(originalPath)
        .outputOptions(VIDEO_OUTPUT_OPTIONS)
        .on("start", (commandLine) => {
          console.log("FFmpeg 命令:", commandLine);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            state.videoProgressData[filename] = {
              percent: Math.floor(progress.percent),
              timemarks: progress.timemark || "",
              status: "processing",
            };
          }
        })
        .on("end", () => {
          state.videoProgressData[filename] = { percent: 100, status: "completed" };
          resolve();
        })
        .on("error", (err) => {
          if (isCancelError(err)) {
            console.log(`视频 ${filename} 处理被用户取消`);
            state.videoProgressData[filename] = { status: "cancelled", message: "处理已被用户取消" };
            cancelled = true;
            // 清理被取消转码的部分输出,避免残留损坏文件 Clean up partial output on cancel
            fs.remove(outputPath)
              .catch(() => {})
              .then(() => resolve({ cancelled: true }));
          } else {
            console.error(`视频 ${filename} 处理失败:`, err);
            state.videoProgressData[filename] = { status: "error", error: err.message };
            reject(err);
          }
        })
        .save(outputPath);

      state.activeFFmpegProcesses[filename] = ffmpegCommand;
    });
  } finally {
    // 所有路径(end/error/cancel)都清理进程条目
    resetFileState(filename);
  }

  // 取消后不再生成缩略图,避免产生孤儿缩略图 Skip thumbnail generation when cancelled
  if (cancelled) {
    return { newName: finalNewName, originalPath, outputPath, thumbnailPath, cancelled: true };
  }

  // 生成缩略图 Generate thumbnail
  console.log(`生成视频 ${filename} 的缩略图`);
  await new Promise((resolve, reject) => {
    ffmpeg(originalPath)
      .screenshots({ count: 1, filename: `${newName}.jpg`, folder: paths.VIDEO_THUMBNAILS, size: "100x100" })
      .on("end", () => {
        console.log(`视频 ${filename} 缩略图生成完成`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`视频 ${filename} 缩略图生成失败:`, err);
        reject(err);
      });
  });

  return { newName: finalNewName, originalPath, outputPath, thumbnailPath };
}

module.exports = { processVideo, validateVideoFile, isCancelError };
