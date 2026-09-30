// 有界并发工具测试 Bounded concurrency helper tests
const test = require("node:test");
const assert = require("node:assert");
const { mapWithConcurrency } = require("../../src/utils/concurrency");

// 短暂延迟,用于构造并发窗口 Short delay used to open a concurrency window
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("mapWithConcurrency 并发数不超过上限", async () => {
  let inFlight = 0;
  let maxInFlight = 0;

  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (item) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(10);
    inFlight--;
    return item * 2;
  });

  assert.equal(maxInFlight, 3); // 严格受限,绝不超过 3
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14, 16]);
});

test("mapWithConcurrency 结果顺序与输入顺序一致", async () => {
  // 先入队的任务耗时更长,仍必须按输入顺序返回
  const results = await mapWithConcurrency([30, 20, 10, 1], 4, async (ms) => {
    await delay(ms);
    return ms;
  });

  assert.deepEqual(results, [30, 20, 10, 1]);
});

test("mapWithConcurrency 空数组直接返回", async () => {
  const results = await mapWithConcurrency([], 4, async () => {
    throw new Error("不应被调用");
  });

  assert.deepEqual(results, []);
});

test("mapWithConcurrency 停止条件成立后不再启动新任务", async () => {
  const started = [];

  const results = await mapWithConcurrency(
    [1, 2, 3, 4, 5, 6],
    2,
    async (item) => {
      started.push(item);
      await delay(5);
      return item;
    },
    () => started.length >= 2, // 启动 2 个后请求停止
  );

  assert.equal(started.length, 2);
  assert.equal(results[0], 1);
  assert.equal(results[1], 2);
  // 未启动的任务下标保持空洞(undefined)
  assert.equal(results[2], undefined);
  assert.equal(results.length, 6);
});
