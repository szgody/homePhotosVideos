// 文件名校验测试 Filename validation tests
const test = require("node:test");
const assert = require("node:assert");
const { isValidFilename, isAllowedImage, isAllowedVideo } = require("../../src/utils/validate");

test("合法纯文件名通过", () => {
  assert.ok(isValidFilename("IMG_001.jpg"));
  assert.ok(isValidFilename("视频-01.MP4"));
});

test("路径遍历被拒绝", () => {
  assert.ok(!isValidFilename("../etc/passwd"));
  assert.ok(!isValidFilename("..\\..\\secret.jpg"));
  assert.ok(!isValidFilename("a/b.jpg"));
  assert.ok(!isValidFilename("C:\\abs\\path.jpg"));
  assert.ok(!isValidFilename("/etc/passwd"));
});

test("空值与非字符串被拒绝", () => {
  assert.ok(!isValidFilename(""));
  assert.ok(!isValidFilename(null));
  assert.ok(!isValidFilename(undefined));
  assert.ok(!isValidFilename(123));
});

test("扩展名白名单", () => {
  assert.ok(isAllowedImage("a.JPG"));
  assert.ok(isAllowedImage("b.webp"));
  assert.ok(!isAllowedImage("c.exe"));
  assert.ok(!isAllowedImage("d.jpg.sh"));
  assert.ok(isAllowedVideo("v.mp4"));
  assert.ok(isAllowedVideo("v2.mov"));
  assert.ok(!isAllowedVideo("bad.txt"));
});

test("带扩展名校验的文件名同样拒绝路径字符", () => {
  assert.ok(!isAllowedImage("../x.jpg"));
});
