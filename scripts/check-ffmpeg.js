// 检查 ffmpeg / ffprobe 是否可用 Check ffmpeg availability
const { execFile } = require("child_process");
const { FFMPEG_PATH, FFPROBE_PATH } = require("../backend/src/config");

function probe(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, (err, stdout) => {
      if (err) return resolve(null);
      resolve((stdout || "").split("\n")[0] || bin);
    });
  });
}

(async () => {
  const ffmpegBin = FFMPEG_PATH || "ffmpeg";
  const ffprobeBin = FFPROBE_PATH || "ffprobe";
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    probe(ffmpegBin, ["-version"]),
    probe(ffprobeBin, ["-version"]),
  ]);

  console.log(`${ffmpegVersion ? "PASS" : "FAIL"} ffmpeg: ${ffmpegVersion || "不可用"}`);
  console.log(`${ffprobeVersion ? "PASS" : "FAIL"} ffprobe: ${ffprobeVersion || "不可用"}`);

  if (!ffmpegVersion || !ffprobeVersion) {
    console.error("请安装 ffmpeg: sudo apt install -y ffmpeg");
    process.exit(1);
  }
})();
