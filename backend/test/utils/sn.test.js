// 序号读写测试 SN read/write tests
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const { readSn, writeSn } = require("../../src/utils/sn");

test("序号文件不存在时回退为 000000 并创建", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-"));
  const snFile = path.join(dir, "sn.txt");
  const sn = await readSn(snFile);
  assert.equal(sn, "000000");
  assert.ok(await fs.pathExists(snFile));
  await fs.remove(dir);
});

test("读取已有序号并去除空白", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-"));
  const snFile = path.join(dir, "sn.txt");
  await fs.writeFile(snFile, " 000042 \n", "utf8");
  assert.equal(await readSn(snFile), "000042");
  await fs.remove(dir);
});

test("非法序号回退为 000000", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-"));
  const snFile = path.join(dir, "sn.txt");
  await fs.writeFile(snFile, "abc", "utf8");
  assert.equal(await readSn(snFile), "000000");
  await fs.remove(dir);
});

test("写入合法序号并回读一致", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-"));
  const snFile = path.join(dir, "sn.txt");
  await writeSn(snFile, "000042");
  assert.equal(await readSn(snFile), "000042");
  await fs.remove(dir);
});

test("写入非法序号抛错", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-"));
  const snFile = path.join(dir, "sn.txt");
  await assert.rejects(() => writeSn(snFile, "12a3"));
  await fs.remove(dir);
});
