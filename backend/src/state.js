// 集中处理状态(替代散落的 global.*) Centralized processing state (replaces global.*)
const state = {
  videoProgressData: {}, // 视频处理进度 { [filename]: { percent, status, ... } }
  activeFFmpegProcesses: {}, // 活跃 ffmpeg 命令 { [filename]: ffmpegCommand }
  processingCancelled: {}, // 取消标记 { [file]: true }
};

// 重置单个文件的运行时状态(处理完成后清理)
function resetFileState(filename) {
  delete state.activeFFmpegProcesses[filename];
  delete state.processingCancelled[filename];
}

module.exports = { state, resetFileState };
