<template>
  <div class="processing-manager">
    <h1>处理管理中心</h1>

    <div class="system-status">
      <div class="status-card">
        <h2>系统状态</h2>
        <div class="status-items">
          <div class="status-item">
            <span class="label">存储空间:</span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${storageUsage}%` }"
                :class="getUsageClass(storageUsage)"
              ></div>
            </div>
            <span class="value"
              >{{ storageUsage }}% 使用中 ({{ formatSize(storageInfo.used) }}/{{
                formatSize(storageInfo.total)
              }})</span
            >
          </div>
          <div class="status-item">
            <span class="label">系统内存:</span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${memoryUsage}%` }"
                :class="getUsageClass(memoryUsage)"
              ></div>
            </div>
            <span class="value"
              >{{ memoryUsage }}% 使用中 ({{ formatSize(memoryInfo.used) }}/{{
                formatSize(memoryInfo.total)
              }})</span
            >
          </div>
        </div>
      </div>
    </div>

    <div class="active-sessions">
      <div class="status-card">
        <div class="card-header">
          <h2>活动处理会话</h2>
          <button
            @click="refreshSessions"
            class="refresh-btn"
            :disabled="loading"
          >
            刷新
          </button>
        </div>

        <div v-if="loading" class="loading">
          <p>加载中...</p>
        </div>

        <div v-else-if="activeSessions.length === 0" class="no-sessions">
          <p>当前没有活动的处理会话</p>
        </div>

        <div v-else class="session-list">
          <div
            v-for="(session, index) in activeSessions"
            :key="index"
            class="session-item"
            :class="session.type"
          >
            <div class="session-header">
              <div class="session-title">
                <span class="session-type">{{
                  session.type === "image" ? "图片处理" : "视频处理"
                }}</span>
                <span class="session-status" :class="session.status">{{
                  getStatusText(session.status)
                }}</span>
              </div>
              <div class="session-info">
                <span>开始时间: {{ formatTime(session.startTime) }}</span>
              </div>
            </div>

            <div class="session-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${session.progress}%` }"
                  :class="session.type"
                ></div>
              </div>
              <span class="progress-text"
                >{{ session.progress }}% 完成 ({{ session.processed }}/{{
                  session.total
                }})</span
              >
            </div>

            <div class="session-details">
              <div v-if="session.currentFile" class="current-file">
                <span class="label">当前文件:</span>
                <span class="value">{{ session.currentFile }}</span>
              </div>

              <div
                v-if="session.type === 'video' && session.ffmpegProgress"
                class="ffmpeg-progress"
              >
                <div class="progress-bar small">
                  <div
                    class="progress-fill video"
                    :style="{ width: `${session.ffmpegProgress}%` }"
                  ></div>
                </div>
                <span class="progress-text"
                  >视频转码: {{ session.ffmpegProgress }}%</span
                >
              </div>
            </div>

            <div class="session-actions">
              <button
                @click="stopSession(session.id)"
                :disabled="session.stopping"
                class="stop-btn"
              >
                {{ session.stopping ? "停止中..." : "停止处理" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="video-memory">
      <div class="status-card">
        <h2>视频处理内存设置</h2>

        <div class="memory-settings">
          <div class="memory-slider">
            <label for="memory-slider">视频处理内存限制 (MB)</label>
            <input
              type="range"
              id="memory-slider"
              v-model.number="memoryLimit"
              :min="512"
              :max="maxMemoryLimit"
              step="128"
            />
            <div class="slider-range">
              <span>512MB</span>
              <span>{{ maxMemoryLimit }}MB</span>
            </div>
          </div>

          <div class="memory-input">
            <input
              type="number"
              v-model.number="memoryLimit"
              :min="512"
              :max="maxMemoryLimit"
              step="128"
            />
            <span class="unit">MB</span>
          </div>

          <div class="memory-presets">
            <button
              v-for="preset in memoryPresets"
              :key="preset.value"
              @click="memoryLimit = preset.value"
              :class="{ active: memoryLimit === preset.value }"
              class="preset-btn"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="actions">
            <button
              @click="saveMemorySettings"
              class="save-btn"
              :disabled="!memoryChanged"
            >
              保存设置
            </button>
            <button
              @click="resetMemorySettings"
              class="reset-btn"
              :disabled="!memoryChanged"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from "vue";

export default {
  name: "ProcessingManager",
  setup() {
    const loading = ref(false);
    const activeSessions = ref([]);
    const lastUpdated = ref(null);
    const storageInfo = ref({ total: 1, used: 0, free: 1 });
    const memoryInfo = ref({ total: 1, used: 0, free: 1 });
    const originalMemoryLimit = ref(1024);
    const memoryLimit = ref(1024);

    let refreshInterval = null;

    // 计算属性
    const storageUsage = computed(() => {
      return Math.round(
        (storageInfo.value.used / storageInfo.value.total) * 100,
      );
    });

    const memoryUsage = computed(() => {
      return Math.round((memoryInfo.value.used / memoryInfo.value.total) * 100);
    });

    const maxMemoryLimit = computed(() => {
      // 限制为系统内存的75%或8GB，取较小值
      const seventyFivePercent = Math.floor(
        (memoryInfo.value.total * 0.75) / (1024 * 1024),
      );
      return Math.min(seventyFivePercent, 8192);
    });

    const memoryChanged = computed(() => {
      return memoryLimit.value !== originalMemoryLimit.value;
    });

    const memoryPresets = [
      { label: "1GB", value: 1024 },
      { label: "2GB", value: 2048 },
      { label: "4GB", value: 4096 },
    ];

    // 方法
    const getBaseUrl = () => {
      return (
        import.meta.env.VITE_BASE_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_API_URL ||
        process.env.VUE_APP_BASE_URL ||
        process.env.VUE_APP_API_BASE_URL ||
        ""
      );
    };

    const buildUrl = (path) => {
      const baseUrl = getBaseUrl();

      // 移除 path 开头的 /api，避免重复
      let cleanPath = path;
      if (cleanPath.startsWith("/api/")) {
        cleanPath = cleanPath.substring(4); // 移除开头的 /api
      }

      // 确保路径正确拼接，避免双斜杠
      if (baseUrl) {
        if (baseUrl.endsWith("/") && cleanPath.startsWith("/")) {
          return baseUrl + cleanPath.substring(1);
        } else if (!baseUrl.endsWith("/") && !cleanPath.startsWith("/")) {
          return baseUrl + "/" + cleanPath;
        }
        return baseUrl + cleanPath;
      }

      return cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath;
    };

    const refreshSessions = async () => {
      loading.value = true;
      try {
        await Promise.all([fetchActiveSessions(), fetchSystemStatus()]);
        lastUpdated.value = new Date();
      } catch (error) {
        console.error("刷新数据失败:", error);
      } finally {
        loading.value = false;
      }
    };

    const fetchActiveSessions = async () => {
      try {
        const response = await fetch(buildUrl("/active-sessions"));
        if (!response.ok) {
          throw new Error(`获取会话失败: ${response.status}`);
        }

        const data = await response.json();
        activeSessions.value = Array.isArray(data) ? data : data.sessions || [];
      } catch (error) {
        console.error("获取会话失败:", error);
      }
    };

    const fetchSystemStatus = async () => {
      try {
        const response = await fetch(buildUrl("/system-status"));
        if (!response.ok) {
          throw new Error(`获取系统状态失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.storage) {
          storageInfo.value = data.storage;
        }

        if (data.memory) {
          memoryInfo.value = data.memory;
        }
      } catch (error) {
        console.error("获取系统状态失败:", error);
      }
    };

    const fetchMemorySettings = async () => {
      try {
        const response = await fetch(buildUrl("/memory-settings"));
        if (!response.ok) {
          throw new Error(`获取内存设置失败: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.videoMemory) {
          memoryLimit.value = data.videoMemory;
          originalMemoryLimit.value = data.videoMemory;
        }
      } catch (error) {
        console.error("获取内存设置失败:", error);
        // 尝试从本地存储获取
        const savedMemory = localStorage.getItem("videoMemoryLimit");
        if (savedMemory) {
          memoryLimit.value = parseInt(savedMemory, 10);
          originalMemoryLimit.value = memoryLimit.value;
        }
      }
    };

    const stopSession = async (sessionId) => {
      try {
        // 标记为停止中
        const session = activeSessions.value.find((s) => s.id === sessionId);
        if (session) {
          session.stopping = true;
        }

        const response = await fetch(buildUrl("/stop-processing"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error(`停止会话失败: ${response.status}`);
        }

        // 刷新会话列表
        await refreshSessions();
      } catch (error) {
        console.error("停止会话失败:", error);
        alert(`停止会话失败: ${error.message}`);

        // 恢复停止中状态
        const session = activeSessions.value.find((s) => s.id === sessionId);
        if (session) {
          session.stopping = false;
        }
      }
    };

    const saveMemorySettings = async () => {
      try {
        const response = await fetch(buildUrl("/memory-settings"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoMemory: memoryLimit.value }),
        });

        if (!response.ok) {
          throw new Error(`保存设置失败: ${response.status}`);
        }

        // 保存到本地存储，作为备份
        localStorage.setItem("videoMemoryLimit", memoryLimit.value.toString());
        originalMemoryLimit.value = memoryLimit.value;

        alert("内存设置已保存");
      } catch (error) {
        console.error("保存内存设置失败:", error);
        alert(`保存设置失败: ${error.message}`);
      }
    };

    const resetMemorySettings = () => {
      memoryLimit.value = originalMemoryLimit.value;
    };

    const formatSize = (bytes) => {
      if (bytes === 0) return "0 B";

      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return "未知";

      const date = new Date(timestamp);
      return date.toLocaleString();
    };

    const getStatusText = (status) => {
      const statusMap = {
        running: "处理中",
        paused: "已暂停",
        stopping: "正在停止",
        error: "错误",
      };

      return statusMap[status] || status;
    };

    const getUsageClass = (percentage) => {
      if (percentage >= 90) return "danger";
      if (percentage >= 70) return "warning";
      return "normal";
    };

    onMounted(() => {
      refreshSessions();
      fetchMemorySettings();

      // 设置自动刷新
      refreshInterval = setInterval(refreshSessions, 10000);
    });

    onUnmounted(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    });

    return {
      loading,
      activeSessions,
      lastUpdated,
      storageInfo,
      memoryInfo,
      storageUsage,
      memoryUsage,
      memoryLimit,
      maxMemoryLimit,
      memoryChanged,
      memoryPresets,
      refreshSessions,
      stopSession,
      saveMemorySettings,
      resetMemorySettings,
      formatSize,
      formatTime,
      getStatusText,
      getUsageClass,
    };
  },
};
</script>

<style scoped>
.processing-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
  color: #333;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

.status-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

h2 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label {
  font-weight: bold;
  color: #555;
}

.value {
  color: #666;
  font-size: 0.9em;
}

.progress-bar {
  height: 15px;
  background-color: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  margin: 5px 0;
}

.progress-bar.small {
  height: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.normal {
  background-color: #2ecc71;
}

.progress-fill.warning {
  background-color: #f39c12;
}

.progress-fill.danger {
  background-color: #e74c3c;
}

.progress-fill.image {
  background-color: #3498db;
}

.progress-fill.video {
  background-color: #9b59b6;
}

.progress-text {
  font-size: 0.9em;
  color: #666;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.session-item {
  background-color: #f9f9f9;
  border-radius: 6px;
  padding: 15px;
  border-left: 4px solid #ccc;
}

.session-item.image {
  border-left-color: #3498db;
}

.session-item.video {
  border-left-color: #9b59b6;
}

.session-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.session-type {
  font-weight: bold;
  margin-right: 10px;
}

.session-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  color: white;
}

.session-status.running {
  background-color: #2ecc71;
}

.session-status.paused {
  background-color: #f39c12;
}

.session-status.stopping {
  background-color: #e74c3c;
}

.session-status.error {
  background-color: #c0392b;
}

.session-info {
  font-size: 0.8em;
  color: #777;
}

.session-progress {
  margin-bottom: 12px;
}

.session-details {
  margin-bottom: 15px;
  font-size: 0.9em;
}

.current-file {
  margin-bottom: 8px;
  word-break: break-all;
}

.ffmpeg-progress {
  margin-top: 10px;
}

.session-actions {
  display: flex;
  justify-content: flex-end;
}

.stop-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 7px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.stop-btn:hover:not(:disabled) {
  background-color: #c0392b;
}

.stop-btn:disabled {
  background-color: #f5b7b1;
  cursor: not-allowed;
}

.refresh-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #999;
}

.no-sessions {
  text-align: center;
  padding: 30px;
  color: #999;
  font-style: italic;
}

/* 内存设置样式 */
.memory-settings {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.memory-slider {
  margin-bottom: 10px;
}

.memory-slider label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.memory-slider input[type="range"] {
  width: 100%;
  margin-bottom: 5px;
}

.slider-range {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: #777;
}

.memory-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memory-input input {
  width: 100px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.memory-input .unit {
  font-weight: bold;
  color: #555;
}

.memory-presets {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.preset-btn {
  background-color: #f0f0f0;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.preset-btn.active {
  background-color: #3498db;
  color: white;
}

.preset-btn:hover:not(.active) {
  background-color: #e0e0e0;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.save-btn,
.reset-btn {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.save-btn {
  background-color: #2ecc71;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background-color: #27ae60;
}

.reset-btn {
  background-color: #95a5a6;
  color: white;
}

.reset-btn:hover:not(:disabled) {
  background-color: #7f8c8d;
}

.save-btn:disabled,
.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .session-header {
    flex-direction: column;
    gap: 8px;
  }

  .actions {
    flex-direction: column;
  }

  .actions button {
    width: 100%;
  }
}
</style>
