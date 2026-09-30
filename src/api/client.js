// 统一 API 客户端:单一 VITE_API_URL,集中错误处理
export const API_URL = import.meta.env.VITE_API_URL || "/api";

export async function apiGet(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  ).toString();
  const url = `${API_URL}${path}${query ? `?${query}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API 请求失败: ${path} (${response.status})`);
  }
  return response.json();
}

export async function apiPost(path, body = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API 请求失败: ${path} (${response.status})`);
  }
  return response.json();
}
