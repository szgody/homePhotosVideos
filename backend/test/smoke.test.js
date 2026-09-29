// 测试基线:确认 node:test 运行器可用 Test baseline
const test = require("node:test");
const assert = require("node:assert");

test("测试基线可用", () => {
  assert.ok(true);
});
