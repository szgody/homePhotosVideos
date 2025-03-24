<template>
  <div class="processing-manager">
    <h2>处理管理中心</h2>

    <!-- 系统状态概览 -->
    <div class="system-status">
      <div class="status-card">
        <h3>系统状态</h3>
        <div class="status-info">
          <div class="info-row">
            <span>存储空间:</span>
            <div class="progress-bar">
              <div
                class="progress"
                :style="{ width: `${storageUsage}%` }"
                :class="getStorageClass(storageUsage)"
              ></div>
            </div>
            <span
              >{{ storageUsage }}% ({{ formatSize(usedStorage) }}/{{
                formatSize(totalStorage)
              }})</span
            >
          </div>
          <div class="info-row">
            <span>内存使用:</span>
            <div class="progress-bar">
              <div
                class="progress"
                :style="{ width: `${memoryUsage}%` }"
                :class="getMemoryClass(memoryUsage)"
              ></div>
            </div>
            <span>{{ memoryUsage }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 活动会话 -->
    <div class="active-sessions">
      <h3>活动处理会话</h3>

      <div v-if="loadingActiveSessions" class="loading">加载会话信息...</div>

      <div v-else-if="activeSessions.length === 0" class="no-sessions">
        <p>当前没有活动的处理会话</p>
      </div>

      <div v-else class="session-list">
        <!-- 图片处理会话 -->
        <div v-if="imageSession" class="session-card">
          <div class="session-header">
            <h4>图片处理</h4>
            <span class="session-status active">活动中</span>
          </div>

          <div class="session-body">
            <div class="session-info">
              <div>当前文件: {{ imageSession.currentFile || "无" }}</div>
              <div>
                处理进度: {{ imageSession.progress }}% ({{
                  imageSession.processed
                }}/{{ imageSession.total }})
              </div>
              <div>开始时间: {{ formatTime(imageSession.startTime) }}</div>
            </div>

            <div class="session-progress">
              <div class="progress-bar">
                <div
                  class="progress"
                  :style="{ width: `${imageSession.progress}%` }"
                ></div>
              </div>
            </div>

            <div class="session-actions">
              <button
                @click="stopProcessing('image')"
                :disabled="stoppingImage"
                class="stop-btn"
              >
                {{ stoppingImage ? "正在停止..." : "停止图片处理" }}
              </button>
            </div>
          </div>
        </div>

        <!-- 视频处理会话 -->
        <div v-if="videoSession" class="session-card video">
          <div class="session-header">
            <h4>视频处理</h4>
            <span class="session-status active">活动中</span>
          </div>

          <div class="session-body">
            <div class="session-info">
              <div>当前文件: {{ videoSession.currentFile || "无" }}</div>
              <div>
                处理进度: {{ videoSession.progress }}% ({{
                  videoSession.processed
                }}/{{ videoSession.total }})
              </div>
              <div>开始时间: {{ formatTime(videoSession.startTime) }}</div>
            </div>

            <div class="session-progress">
              <div class="progress-bar">
                <div
                  class="progress"
                  :style="{ width: `${videoSession.progress}%` }"
                ></div>
              </div>
            </div>

            <div
              v-if="videoSession.ffmpegProgress !== undefined"
              class="ffmpeg-progress"
            >
              <div>转码进度: {{ videoSession.ffmpegProgress }}%</div>
              <div class="progress-bar">
                <div
                  class="progress ffmpeg"
                  :style="{ width: `${videoSession.ffmpegProgress}%` }"
                ></div>
              </div>
            </div>

            <div class="session-actions">
              <button
                @click="stopProcessing('video')"
                :disabled="stoppingVideo"
                class="stop-btn"
              >
                {{ stoppingVideo ? "正在停止..." : "停止视频处理" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内存设置 -->
    <div class="memory-settings">
      <h3>视频处理内存设置</h3>

      <div class="settings-form">
        <div class="form-group">
          <label for="memory-limit">FFmpeg内存限制 (MB):</label>
          <div class="input-group">
            <input
              type="number"
              id="memory-limit"
              v-model.number="memoryLimit"
              min="512"
              max="8192"
              step="128"
            />
            <button
              @click="saveMemorySettings"
              :disabled="savingMemory"
              class="save-btn"
            >
              {{ savingMemory ? "保存中..." : "保存" }}
            </button>
          </div>
          <p class="form-help">
            建议值: 低清视频 512-1024MB, 高清视频 1024-2048MB, 4K视频
            2048-4096MB
          </p>
        </div>
      </div>
    </div>

    <div class="refresh-control">
      <button @click="refreshAll" :disabled="refreshing" class="refresh-btn">
        {{ refreshing ? "刷新中..." : "刷新状态" }}
      </button>
      <span v-if="lastRefresh" class="refresh-time">
        最后更新: {{ formatTime(lastRefresh) }}
      </span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from "vue";

export default {
  name: "ProcessingManager",
  setup() {
    // 状态变量
    const activeSessions = ref([]);
    const loadingActiveSessions = ref(true);
    const stoppingImage = ref(false);
    const stoppingVideo = ref(false);
    const savingMemory = ref(false);
    const refreshing = ref(false);
    const lastRefresh = ref(null);

    // 系统状态
    const totalStorage = ref(0);
    const usedStorage = ref(0);
    const storageUsage = ref(0);
    const memoryUsage = ref(0);

    // 内存限制设置
    const memoryLimit = ref(1024); // 默认1GB

    // 计算属性：获取图片处理和视频处理会话
    const imageSession = computed(() => {
      return activeSessions.value.find((session) => session.type === "image");
    });

    const videoSession = computed(() => {
      return activeSessions.value.find((session) => session.type === "video");
    });

    // 轮询定时器
    let pollingInterval = null;

    // 获取API基础路径
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

    // 构建完整API路径
    const buildUrl = (path) => {
      const baseUrl = getBaseUrl();

      // 移除 path 开头的 /api，避免重复
      let cleanPath = path;
      if (cleanPath.startsWith("/api/")) {
        cleanPath = cleanPath.substring(4);
      }

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

    // 获取活动会话
    const fetchActiveSessions = async () => {
      try {
        loadingActiveSessions.value = true;
        const response = await fetch(buildUrl("/active-sessions"), {
          headers: { "Cache-Control": "no-cache" },
        });

        if (!response.ok) {
          console.error("获取活动会话失败:", response.status);
          return;
        }

        const data = await response.json();
        activeSessions.value = Array.isArray(data.sessions)
          ? data.sessions
          : [];
      } catch (error) {
        console.error("获取活动会话出错:", error);
      } finally {
        loadingActiveSessions.value = false;
      }
    };

    // 获取系统状态
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch(buildUrl("/system-status"), {
          headers: { "Cache-Control": "no-cache" },
        });

        if (!response.ok) {
          console.error("获取系统状态失败:", response.status);
          return;
        }

        const data = await response.json();

        // 更新存储信息
        if (data.storage) {
          totalStorage.value = data.storage.total || 0;
          usedStorage.value = data.storage.used || 0;
          storageUsage.value = data.storage.usedPercentage || 0;
        }

        // 更新内存信息
        if (data.memory) {
          memoryUsage.value = data.memory.usedPercentage || 0;
        }
      } catch (error) {
        console.error("获取系统状态出错:", error);
      }
    };

    // 获取内存设置
    const fetchMemorySettings = async () => {
      try {
        const response = await fetch(buildUrl("/processing-settings"));

        if (!response.ok) {
          console.error("获取内存设置失败:", response.status);
          return;
        }

        const data = await response.json();
        if (data.ffmpegMemory) {
          memoryLimit.value = data.ffmpegMemory;
        }
      } catch (error) {
        console.error("获取内存设置出错:", error);
      }
    };

    // 保存内存设置
    const saveMemorySettings = async () => {
      try {
        savingMemory.value = true;

        // 验证内存值
        const memValue = parseInt(memoryLimit.value);
        if (isNaN(memValue) || memValue < 512 || memValue > 8192) {
          alert("请输入512-8192之间的有效内存值");
          return;
        }

        const response = await fetch(buildUrl("/processing-settings"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ffmpegMemory: memValue,
          }),
        });

        if (!response.ok) {
          throw new Error(`保存失败: ${response.status}`);
        }

        alert("内存设置已保存");
      } catch (error) {
        console.error("保存内存设置出错:", error);
        alert(`保存设置失败: ${error.message}`);
      } finally {
        savingMemory.value = false;
      }
    };

    // 停止处理
    const stopProcessing = async (type) => {
      if (type === "image") {
        stoppingImage.value = true;
      } else if (type === "video") {
        stoppingVideo.value = true;
      }

      try {
        // 获取会话ID
        const session =
          type === "image" ? imageSession.value : videoSession.value;
        if (!session || !session.id) {
          throw new Error("无法获取会话ID");
        }

        const response = await fetch(buildUrl("/stop-processing"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            sessionId: session.id,
          }),
        });

        if (!response.ok) {
          throw new Error(`停止失败: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          alert(`已成功停止${type === "image" ? "图片" : "视频"}处理`);
          await fetchActiveSessions();
        } else {
          throw new Error(result.error || "未知错误");
        }
      } catch (error) {
        console.error(`停止${type}处理出错:`, error);
        alert(`停止处理失败: ${error.message}`);
      } finally {
        if (type === "image") {
          stoppingImage.value = false;
        } else if (type === "video") {
          stoppingVideo.value = false;
        }
      }
    };

    // 刷新所有数据
    const refreshAll = async () => {
      refreshing.value = true;
      try {
        await Promise.all([
          fetchActiveSessions(),
          fetchSystemStatus(),
          fetchMemorySettings(),
        ]);
        lastRefresh.value = new Date();
      } catch (error) {
        console.error("刷新数据出错:", error);
      } finally {
        refreshing.value = false;
      }
    };

    // 格式化大小
    const formatSize = (bytes) => {
      if (bytes === 0) return "0 B";

      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (
        parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i]
      );
    };

    // 格式化时间
    const formatTime = (time) => {
      if (!time) return "";

      let date;
      if (typeof time === "number") {
        date = new Date(time);
      } else if (time instanceof Date) {
        date = time;
      } else {
        date = new Date(time);
      }

      return date.toLocaleString();
    };

    // 获取存储状态类别
    const getStorageClass = (percentage) => {
      if (percentage >= 90) return "danger";
      if (percentage >= 70) return "warning";
      return "normal";
    };

    // 获取内存状态类别
    const getMemoryClass = (percentage) => {
      if (percentage >= 85) return "danger";
      if (percentage >= 65) return "warning";
      return "normal";
    };

    // 设置轮询
    const startPolling = () => {
      // 清除现有的轮询
      stopPolling();

      // 开始轮询
      pollingInterval = setInterval(() => {
        fetchActiveSessions();
        fetchSystemStatus();
      }, 5000); // 每5秒更新一次
    };

    // 停止轮询
    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    // 组件挂载
    onMounted(() => {
      // 初始化数据
      refreshAll();

      // 开始轮询
      startPolling();
    });

    // 组件卸载
    onUnmounted(() => {
      // 停止轮询
      stopPolling();
    });

    return {
      activeSessions,
      loadingActiveSessions,
      stoppingImage,
      stoppingVideo,
      savingMemory,
      refreshing,
      lastRefresh,
      totalStorage,
      usedStorage,
      storageUsage,
      memoryUsage,
      memoryLimit,
      imageSession,
      videoSession,
      stopProcessing,
      saveMemorySettings,
      refreshAll,
      formatSize,
      formatTime,
      getStorageClass,
      getMemoryClass,
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

.processing-manager h2 {
  margin-bottom: 20px;
  color: #333;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

.processing-manager h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #555;
  font-size: 1.2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.system-status,
.active-sessions,
.memory-settings {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.status-info .info-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.status-info .info-row > span:first-child {
  width: 100px;
  flex-shrink: 0;
}

.status-info .info-row > span:last-child {
  margin-left: 10px;
  min-width: 80px;
  text-align: right;
}

.progress-bar {
  height: 16px;
  background-color: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  flex-grow: 1;
}

.progress {
  height: 100%;
  transition: width 0.3s ease;
}

.progress.normal {
  background-color: #2ecc71;
}

.progress.warning {
  background-color: #f39c12;
}

.progress.danger {
  background-color: #e74c3c;
}

.progress.ffmpeg {
  background-color: #9b59b6;
}

.session-card {
  background-color: #f9f9f9;
  border-radius: 8px;
  border-left: 4px solid #3498db;
  margin-bottom: 15px;
  overflow: hidden;
}

.session-card.video {
  border-left-color: #9b59b6;
}

.session-header {
  background-color: #f5f5f5;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-header h4 {
  margin: 0;
  color: #333;
}

.session-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.session-status.active {
  background-color: #2ecc71;
  color: white;
}

.session-body {
  padding: 15px;
}

.session-info {
  margin-bottom: 10px;
}

.session-info > div {
  margin-bottom: 5px;
}

.session-progress {
  margin-bottom: 15px;
}

.ffmpeg-progress {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.ffmpeg-progress > div:first-child {
  margin-bottom: 5px;
}

.session-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}

.stop-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.stop-btn:hover {
  background-color: #c0392b;
}

.stop-btn:disabled {
  background-color: #e74c3c;
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #7f8c8d;
}

.no-sessions {
  background-color: #f9f9f9;
  padding: 20px;
  text-align: center;
  border-radius: 4px;
  color: #7f8c8d;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

.input-group {
  display: flex;
}

.input-group input {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  max-width: 200px;
}

.save-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 0 15px;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.save-btn:hover {
  background-color: #2980b9;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-help {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-top: 5px;
}

.refresh-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.refresh-btn {
  background-color: #7f8c8d;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background-color: #6c7a89;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-time {
  color: #7f8c8d;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .status-info .info-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-info .info-row > span:first-child {
    width: auto;
    margin-bottom: 5px;
  }

  .status-info .info-row > span:last-child {
    margin-left: 0;
    margin-top: 5px;
    text-align: left;
  }

  .input-group {
    flex-direction: column;
  }

  .input-group input {
    max-width: 100%;
    border-radius: 4px;
  }

  .save-btn {
    margin-top: 10px;
    border-radius: 4px;
    width: 100%;
    padding: 8px 0;
  }

  .refresh-control {
    flex-direction: column;
    align-items: stretch;
  }

  .refresh-time {
    margin-top: 10px;
    text-align: center;
  }
}
</style>
