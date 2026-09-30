// 有界并发工具:Bounded-concurrency helper
// 固定数量的 worker 依次领取下标,保证同时运行的任务数不超过 limit,
// 且 results[i] 恒对应 items[i](与任务完成先后无关)。
// 注意:禁止用无上限 Promise.all 处理大批量文件,避免句柄/内存爆掉。
async function mapWithConcurrency(items, limit, worker, shouldStop) {
  if (items.length === 0) {
    return [];
  }

  const size = Math.max(1, Math.min(Number(limit) || 1, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      // 停止条件成立(如用户取消)时不再领取新任务,已在跑的任务自然结束
      if (shouldStop && shouldStop()) {
        return;
      }
      const index = nextIndex;
      if (index >= items.length) {
        return;
      }
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  };

  // size 个 worker 并发,任一 worker 抛错都会结束整个池
  await Promise.all(Array.from({ length: size }, () => runWorker()));

  return results;
}

module.exports = { mapWithConcurrency };
