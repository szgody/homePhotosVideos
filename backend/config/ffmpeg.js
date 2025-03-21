const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// 配置 FFmpeg 路径
const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const ffprobePath = 'C:\\ffmpeg\\bin\\ffprobe.exe';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = ffmpeg;