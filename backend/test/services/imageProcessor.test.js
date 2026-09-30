// 图片处理服务测试 Image processor tests
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { processImage, processImagesBatch } = require("../../src/services/imageProcessor");

// 构造一套临时目录(替代真实 PATHS,不污染 data/)
async function makePaths() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "img-"));
  const paths = {
    ORIGINAL_IMAGES: path.join(root, "original"),
    PHOTOS: path.join(root, "photos"),
    PHOTO_THUMBNAILS: path.join(root, "thumbs"),
  };
  await Promise.all(Object.values(paths).map((p) => fs.ensureDir(p)));
  return { root, paths };
}

test("processImage 复制原图并生成缩略图", async () => {
  const { root, paths } = await makePaths();
  // 生成一张 500x400 的红色测试图
  const src = path.join(paths.ORIGINAL_IMAGES, "test.jpg");
  await sharp({ create: { width: 500, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .jpeg()
    .toFile(src);

  const result = await processImage("test.jpg", "000001", paths);

  assert.equal(result.newName, "000001.jpg");
  assert.ok(await fs.pathExists(result.targetPath));
  assert.ok(await fs.pathExists(result.thumbnailPath));
  // 缩略图为 240x240
  const meta = await sharp(result.thumbnailPath).metadata();
  assert.equal(meta.width, 240);
  assert.equal(meta.height, 240);
  await fs.remove(root);
});

test("源文件不存在时抛错", async () => {
  const { root, paths } = await makePaths();
  await assert.rejects(() => processImage("missing.jpg", "000001", paths), /源文件不存在/);
  await fs.remove(root);
});

test("processImagesBatch 批量处理并递增序号", async () => {
  const { root, paths } = await makePaths();
  // 生成两张测试图
  for (const name of ["a.jpg", "b.png"]) {
    await sharp({ create: { width: 1000, height: 800, channels: 3, background: { r: 0, g: 0, b: 255 } } })
      .toFormat(name.endsWith(".png") ? "png" : "jpeg")
      .toFile(path.join(paths.ORIGINAL_IMAGES, name));
  }

  const { results, nextSN } = await processImagesBatch(["a.jpg", "b.png"], "000000", paths);

  assert.equal(results.length, 2);
  assert.equal(results[0].newName, "000000.jpg");
  assert.equal(results[1].newName, "000001.png");
  assert.equal(nextSN, "000002");
  // 原文件已删除,输出与缩略图存在
  assert.ok(!(await fs.pathExists(path.join(paths.ORIGINAL_IMAGES, "a.jpg"))));
  assert.ok(await fs.pathExists(path.join(paths.PHOTOS, "000001.png")));
  assert.ok(await fs.pathExists(path.join(paths.PHOTO_THUMBNAILS, "000001.png")));
  await fs.remove(root);
});

test("processImagesBatch 单文件失败不中断且不产生序号空洞", async () => {
  const { root, paths } = await makePaths();
  await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } } })
    .jpeg()
    .toFile(path.join(paths.ORIGINAL_IMAGES, "good.jpg"));
  // 坏文件:纯文本伪装成 jpg
  await fs.writeFile(path.join(paths.ORIGINAL_IMAGES, "bad.jpg"), "not an image", "utf8");

  const { results, nextSN } = await processImagesBatch(["bad.jpg", "good.jpg"], "000000", paths);

  assert.equal(results.length, 2);
  assert.equal(results[0].error !== undefined, true);
  assert.equal(results[1].newName, "000000.jpg");
  assert.equal(nextSN, "000001");
  await fs.remove(root);
});

test("processImagesBatch 拒绝非法 startSN", async () => {
  const { root, paths } = await makePaths();
  await assert.rejects(() => processImagesBatch([], "abc", paths), /无效的序号/);
  await fs.remove(root);
});
