// 并发批量图片处理测试 Concurrent image batch tests
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const {
  processImagesBatchConcurrent,
  resolveImageConcurrency,
} = require("../../src/services/imageProcessor");
const { state } = require("../../src/state");

// 临时目录(不污染真实 data/、public/original/)
async function makePaths() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "img-conc-"));
  const paths = {
    ORIGINAL_IMAGES: path.join(root, "original"),
    PHOTOS: path.join(root, "photos"),
    PHOTO_THUMBNAILS: path.join(root, "thumbs"),
  };
  await Promise.all(Object.values(paths).map((p) => fs.ensureDir(p)));
  return { root, paths };
}

// 生成一张真实 JPEG 测试图
async function makeImage(filePath, width = 600, height = width) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toFile(filePath);
}

test("并发批处理按输入顺序分配连续序号并删除原图", async () => {
  const { root, paths } = await makePaths();
  const files = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
  for (const file of files) {
    // 大于 800x600,确保 compress 规格真的发生缩放
    await makeImage(path.join(paths.ORIGINAL_IMAGES, file), 1200, 900);
  }

  const { results, nextSN, cancelled } = await processImagesBatchConcurrent(files, "000000", paths, {
    concurrency: 3,
    variant: "compress",
    deleteOriginal: true,
  });

  assert.equal(cancelled, false);
  assert.equal(results.length, 6);
  // 序号与输入顺序严格一一对应(与串行版语义一致)
  files.forEach((file, index) => {
    const sn = String(index).padStart(6, "0");
    assert.equal(results[index].originalName, file);
    assert.equal(results[index].newName, `${sn}.jpg`);
    assert.equal(results[index].sn, sn);
  });
  assert.equal(nextSN, "000006");

  // 输出与缩略图存在,原图已删除
  for (let i = 0; i < files.length; i++) {
    const name = `${String(i).padStart(6, "0")}.jpg`;
    assert.ok(await fs.pathExists(path.join(paths.PHOTOS, name)));
    assert.ok(await fs.pathExists(path.join(paths.PHOTO_THUMBNAILS, name)));
  }
  // compress 规格:主图 800x600(inside)、缩略图 100x100,与历史批处理一致
  const photoMeta = await sharp(path.join(paths.PHOTOS, "000000.jpg")).metadata();
  const thumbMeta = await sharp(path.join(paths.PHOTO_THUMBNAILS, "000000.jpg")).metadata();
  assert.equal(photoMeta.width, 800);
  assert.equal(photoMeta.height, 600);
  assert.equal(thumbMeta.width, 100);
  assert.equal(thumbMeta.height, 100);
  assert.deepEqual(await fs.readdir(paths.ORIGINAL_IMAGES), []);
  // 临时目录已清理,不留中间产物
  assert.equal(await fs.pathExists(path.join(paths.PHOTOS, ".processing-tmp")), false);

  await fs.remove(root);
});

test("并发批处理单文件失败不中断整批且不产生序号空洞", async () => {
  const { root, paths } = await makePaths();
  await makeImage(path.join(paths.ORIGINAL_IMAGES, "good.jpg"));
  // 坏文件:纯文本伪装成 jpg
  await fs.writeFile(path.join(paths.ORIGINAL_IMAGES, "bad.jpg"), "not an image", "utf8");

  const { results, nextSN } = await processImagesBatchConcurrent(["bad.jpg", "good.jpg"], "000000", paths, {
    concurrency: 2,
  });

  assert.equal(results.length, 2);
  assert.equal(typeof results[0].error, "string");
  assert.equal(results[1].newName, "000000.jpg");
  assert.equal(nextSN, "000001"); // 失败文件不消耗序号
  // 失败文件保留原样,便于人工排查
  assert.ok(await fs.pathExists(path.join(paths.ORIGINAL_IMAGES, "bad.jpg")));

  await fs.remove(root);
});

test("并发批处理 ui 规格与原图一致且默认保留原图", async () => {
  const { root, paths } = await makePaths();
  await makeImage(path.join(paths.ORIGINAL_IMAGES, "a.jpg"), 1000);

  const { results, nextSN } = await processImagesBatchConcurrent(["a.jpg"], "000007", paths, {
    concurrency: 2,
    variant: "ui",
  });
  assert.equal(results[0].newName, "000007.jpg");
  assert.equal(nextSN, "000008");

  // ui 规格 = 原图直接复制(字节完全一致,不改分辨率)
  const originalBytes = await fs.readFile(path.join(paths.ORIGINAL_IMAGES, "a.jpg"));
  const outputBytes = await fs.readFile(path.join(paths.PHOTOS, "000007.jpg"));
  assert.ok(originalBytes.equals(outputBytes));

  // 缩略图 240x240,与单图接口 processImage 一致
  const thumbMeta = await sharp(path.join(paths.PHOTO_THUMBNAILS, "000007.jpg")).metadata();
  assert.equal(thumbMeta.width, 240);
  assert.equal(thumbMeta.height, 240);

  // 默认保留原图(未显式要求删除时不得删除用户素材)
  assert.ok(await fs.pathExists(path.join(paths.ORIGINAL_IMAGES, "a.jpg")));

  await fs.remove(root);
});

test("并发批处理收到中断信号后不启动新任务并保留原图", async () => {
  const { root, paths } = await makePaths();
  for (const name of ["a.jpg", "b.jpg", "c.jpg"]) {
    await makeImage(path.join(paths.ORIGINAL_IMAGES, name));
  }

  // 预置中断信号(模拟处理中调用 /api/cancel-processing)
  state.processingCancelled.images = true;
  const { results, nextSN, cancelled } = await processImagesBatchConcurrent(
    ["a.jpg", "b.jpg", "c.jpg"],
    "000005",
    paths,
    { concurrency: 2 },
  );

  assert.equal(cancelled, true);
  assert.equal(results.length, 0);
  assert.equal(nextSN, "000005"); // 序号不推进
  // 三张原图都保留
  assert.equal((await fs.readdir(paths.ORIGINAL_IMAGES)).length, 3);
  delete state.processingCancelled.images;

  await fs.remove(root);
});

test("并发批处理拒绝非法 startSN", async () => {
  const { root, paths } = await makePaths();
  await assert.rejects(() => processImagesBatchConcurrent([], "abc", paths), /无效的序号/);
  await fs.remove(root);
});

test("resolveImageConcurrency 支持显式覆盖并限制上下界", () => {
  assert.equal(resolveImageConcurrency(2), 2);
  assert.equal(resolveImageConcurrency("4"), 4);
  assert.equal(resolveImageConcurrency(0), 1); // 下界 1
  assert.equal(resolveImageConcurrency(999), 32); // 上界 32
  assert.equal(resolveImageConcurrency("abc"), 1); // 非法输入回落下界
  const fallback = resolveImageConcurrency(undefined);
  assert.ok(Number.isInteger(fallback) && fallback >= 1 && fallback <= 32);
});
