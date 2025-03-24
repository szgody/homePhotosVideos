const generateThumbnail = async (videoPath, thumbnailPath) => {
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .on("error", (err) => {
          console.error("生成缩略图失败:", err);
          reject(err);
        })
        .on("end", () => {
          console.log("缩略图生成成功");
          resolve();
        })
        .screenshots({
          timestamps: ["10%"],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: "320x180",
        });
    });
  } catch (error) {
    console.error("缩略图生成过程出错:", error);
    throw error;
  }
};
