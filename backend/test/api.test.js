// API 集成冒烟测试:不依赖真实数据目录,验证路由装配正确
const test = require("node:test");
const assert = require("node:assert");
const { createApp } = require("../src/app");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test("GET /api/health 返回 ok", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
});

test("GET /api/photos 返回列表结构", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/photos`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.photos));
});

test("POST /api/write-sn 拒绝非法序号", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/write-sn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sn: "../evil" }),
  });
  assert.equal(response.status, 400);
});

test("POST /api/process-single-image 拒绝路径遍历文件名", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/process-single-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "../../etc/passwd", newName: "000001" }),
  });
  assert.equal(response.status, 400);
});

test("未知 API 返回 404", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/not-exist`);
  assert.equal(response.status, 404);
});

test("非白名单来源被 CORS 拒绝并返回 JSON", async (t) => {
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/photos`, {
    headers: { Origin: "http://evil.example" },
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "请求被拒绝");
});

test("POST /api/process-single-video 拒绝重复处理同一文件", async (t) => {
  const { state } = require("../src/state");
  // 预置一个“正在处理中”的文件,模拟并发重复提交
  state.activeFFmpegProcesses["dup-test.mp4"] = {};
  try {
    const server = await listen(createApp());
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const { port } = server.address();
    const response = await fetch(`http://localhost:${port}/api/process-single-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "dup-test.mp4", newName: "000000" }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error, "该文件正在处理中");
  } finally {
    delete state.activeFFmpegProcesses["dup-test.mp4"];
  }
});

test("POST /api/cancel-processing 支持图片中断(无需文件名)", async (t) => {
  const { state } = require("../src/state");
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/cancel-processing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "image" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(state.processingCancelled.images, true);
  // 清理,避免影响其他用例
  delete state.processingCancelled.images;
});
