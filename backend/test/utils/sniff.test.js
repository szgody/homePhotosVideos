// 上传魔数嗅探测试 Upload sniffing tests
const test = require("node:test");
const assert = require("node:assert");
const sharp = require("sharp");
const { sniffImage } = require("../../src/utils/sniff");

test("识别真实 JPEG 图片并返回格式信息", async () => {
  const buffer = await sharp({
    create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 128, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  const info = await sniffImage(buffer);
  assert.equal(info.format, "jpeg");
  assert.equal(info.width, 100);
});

test("拒绝伪装成图片的脚本/文本内容", async () => {
  const fake = Buffer.from('<script>alert("xss")</script>', "utf8");
  await assert.rejects(() => sniffImage(fake));
});
