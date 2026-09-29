// 序号文件读写(照片/视频通用) SN file read/write (shared by photos & videos)
const fs = require("fs-extra");
const path = require("path");

const DEFAULT_SN = "000000";

// 读取序号:文件不存在或格式非法时回退为 000000
async function readSn(snFile) {
  if (!(await fs.pathExists(snFile))) {
    await fs.ensureFile(snFile);
    await fs.writeFile(snFile, DEFAULT_SN, "utf8");
  }
  let sn = (await fs.readFile(snFile, "utf8")).trim();
  if (!/^\d+$/.test(sn)) {
    sn = DEFAULT_SN;
    await fs.writeFile(snFile, sn, "utf8");
  }
  return sn;
}

// 写入序号:校验格式,写入后回读验证
async function writeSn(snFile, sn) {
  const value = String(sn);
  if (!/^\d+$/.test(value)) {
    throw new Error(`无效的序号格式: "${value}"`);
  }
  await fs.ensureDir(path.dirname(snFile));
  await fs.writeFile(snFile, value, "utf8");
  const verified = (await fs.readFile(snFile, "utf8")).trim();
  if (verified !== value) {
    throw new Error(`写入验证失败: 期望 "${value}" 但得到 "${verified}"`);
  }
  return value;
}

module.exports = { readSn, writeSn };
