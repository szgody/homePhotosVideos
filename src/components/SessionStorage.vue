<template>
  <!-- 隐藏组件，无UI元素 -->
</template>

<script>
import { onMounted, onUnmounted, ref, reactive } from "vue";

// 导出所有共享状态
export const processingState = reactive({
  processing: false,
  processingType: null,
  processStatus: 1, // 1: 初始状态, 21: 处理图片, 31: 处理视频
  progress: 0,
  totalCount: 0,
  processedCount: 0,
  currentFile: "",
  currentOriginalName: "",
  currentNewName: "",
  currentSN: "",
  currentStage: "",
  ffmpegProgress: 0,
  timemarks: "",
  memoryUsage: "0MB",
  stopRequested: false,
  logs: [],
  isFirstProgressCheck: false, // 添加此属性用于标记首次检查
  lastLoggedProgress: -1, // 添加此属性记录上次记录日志时的进度
});

// 专门用于视频显示的状态
export const isVideoProcessing = ref(false);
export const isVideoSession = ref(false);
export const processingStatus = ref({
  isActive: false,
  type: null,
  progress: 0,
  file: "",
  timestamp: 0,
  session: false,
});

// 轮询间隔
let progressPollingInterval = null;
let statusSavingInterval = null;

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

// 添加日志函数 - 由SessionStorage负责生成
export const addLog = (type, message) => {
  const logEntry = {
    type,
    message: `${new Date().toLocaleTimeString()} - ${message}`,
  };

  // 添加到状态中
  processingState.logs.unshift(logEntry);

  // 限制日志数量
  if (processingState.logs.length > 100) {
    processingState.logs = processingState.logs.slice(0, 100);
  }

  // 保存状态
  saveProcessingStatus();
};

// 启动视频进度轮询 - 移至SessionStorage
const startProgressPolling = () => {
  // 先停止已有的轮询
  stopProgressPolling();

  console.log("SessionStorage: 启动视频进度轮询");

  // 首先立即获取一次进度
  if (processingState.currentFile) {
    fetchVideoProgress();
  }

  // 设置定时器每2秒轮询一次
  progressPollingInterval = setInterval(() => {
    // 如果停止请求或不再处理，则停止轮询
    if (processingState.stopRequested || !processingState.processing) {
      stopProgressPolling();
      return;
    }

    // 检查文件名是否有效
    if (!processingState.currentFile) {
      return;
    }

    fetchVideoProgress();
  }, 2000);
};

// 改进 fetchVideoProgress 函数，确保总是能获取最新进度
const fetchVideoProgress = () => {
  // 如果当前文件为空或不是处理中状态，则不轮询
  if (!processingState.currentFile || !processingState.processing) {
    return;
  }

  const progressUrl = buildUrl(
    `/video-progress?filename=${encodeURIComponent(processingState.currentFile)}&force=1&t=${Date.now()}`,
  );

  console.log("获取视频进度:", processingState.currentFile);

  fetch(progressUrl, {
    headers: { "Cache-Control": "no-cache" },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data && data.percent !== undefined) {
        // 更新本地存储的上一次进度
        const prevProgress = processingState.ffmpegProgress;

        // 更新进度
        processingState.ffmpegProgress = data.percent;
        if (data.timemarks) {
          processingState.timemarks = data.timemarks;
        }

        if (data.memory) {
          processingState.memoryUsage = data.memory;
        }

        const currentProgress = Math.round(processingState.ffmpegProgress);

        // 确保第一个视频也有进度日志
        if (processingState.isFirstProgressCheck && currentProgress > 0) {
          // 首次进度检查且有进度时，记录一次日志
          addLog(
            "info",
            `视频处理开始: ${currentProgress}% (${processingState.currentFile})`,
          );
          processingState.isFirstProgressCheck = false;
          processingState.lastLoggedProgress = currentProgress;
        }
        // 当进度发生明显变化时记录日志 (≥5%)
        else if (
          Math.abs(processingState.lastLoggedProgress - currentProgress) >= 5
        ) {
          // 添加日志条目
          addLog(
            "info",
            `视频处理进度: ${currentProgress}% (${processingState.currentFile})`,
          );
          processingState.lastLoggedProgress = currentProgress;
        }

        // 更新阶段描述
        processingState.currentStage = `处理视频: ${processingState.currentFile} (${processingState.ffmpegProgress.toFixed(1)}%)`;

        // 更新总进度
        if (processingState.totalCount > 0) {
          const singleVideoContribution = 100 / processingState.totalCount;
          const completedContribution =
            processingState.processedCount * singleVideoContribution;
          const currentContribution =
            (processingState.ffmpegProgress / 100) * singleVideoContribution;
          processingState.progress = Math.min(
            99.9,
            completedContribution + currentContribution,
          );
        }

        // 更新视频处理状态
        updateVideoProcessingStatus();

        // 保存状态
        saveProcessingStatus();
      }
    })
    .catch((error) => {
      console.error("获取视频进度失败:", error);
    });
};

// 停止轮询
const stopProgressPolling = () => {
  if (progressPollingInterval) {
    clearInterval(progressPollingInterval);
    progressPollingInterval = null;
  }
};

// 更新视频处理状态 - 供VideoView使用
const updateVideoProcessingStatus = () => {
  // 检查状态有效性
  const now = Date.now();
  const statusTime = processingState.timestamp || now;
  const timeDiff = now - statusTime;
  const isExpired = timeDiff > 1800000; // 30分钟

  // 设置视频处理会话状态
  isVideoSession.value =
    processingState.processingType === "video" &&
    !isExpired &&
    !processingState.stopRequested;

  // 设置当前视频处理状态
  isVideoProcessing.value =
    processingState.processing === true &&
    processingState.processingType === "video" &&
    processingState.processStatus === 31 &&
    !isExpired &&
    !processingState.stopRequested;

  // 更新详细状态
  processingStatus.value = {
    isActive: isVideoProcessing.value,
    type: processingState.processingType || null,
    progress: processingState.progress || 0,
    file: processingState.currentFile || "",
    timestamp: statusTime,
    session: isVideoSession.value,
  };
};

// 保存处理状态到 sessionStorage
const saveProcessingStatus = () => {
  if (!processingState.processing) {
    return;
  }

  const status = {
    processing: processingState.processing,
    processingType: processingState.processingType,
    processStatus: processingState.processStatus,
    progress: processingState.progress,
    totalCount: processingState.totalCount,
    processedCount: processingState.processedCount,
    currentFile: processingState.currentFile,
    currentOriginalName: processingState.currentOriginalName,
    currentNewName: processingState.currentNewName,
    currentSN: processingState.currentSN,
    currentStage: processingState.currentStage,
    ffmpegProgress: processingState.ffmpegProgress,
    timemarks: processingState.timemarks,
    memoryUsage: processingState.memoryUsage,
    logs: processingState.logs.slice(0, 50), // 保存最近的50条日志
    stopRequested: processingState.stopRequested,
    timestamp: new Date().getTime(),
  };

  sessionStorage.setItem("processingStatus", JSON.stringify(status));
};

// 启动定时保存状态
const startStatusSaving = () => {
  if (statusSavingInterval) {
    clearInterval(statusSavingInterval);
  }

  saveProcessingStatus(); // 立即保存一次

  statusSavingInterval = setInterval(() => {
    if (processingState.processing) {
      saveProcessingStatus();
    } else {
      stopStatusSaving();
    }
  }, 2000);
};

// 停止定时保存状态
const stopStatusSaving = () => {
  if (statusSavingInterval) {
    clearInterval(statusSavingInterval);
    statusSavingInterval = null;
  }
};

// 从sessionStorage加载处理状态
export const loadProcessingStatus = () => {
  try {
    const savedStatus = sessionStorage.getItem("processingStatus");
    if (savedStatus) {
      const status = JSON.parse(savedStatus);

      // 检查状态有效性
      const now = Date.now();
      const statusTime = status.timestamp || 0;
      const timeDiff = now - statusTime;
      const isExpired = timeDiff > 1800000; // 30分钟

      if (status && !isExpired) {
        // 恢复所有状态，但不添加额外的日志
        Object.keys(processingState).forEach((key) => {
          if (status[key] !== undefined) {
            processingState[key] = status[key];
          }
        });

        // 如果正在处理视频，重启轮询
        if (
          processingState.processing &&
          processingState.processingType === "video" &&
          processingState.processStatus === 31
        ) {
          startProgressPolling();
          startStatusSaving();
        }

        // 更新视频显示状态
        updateVideoProcessingStatus();

        return true;
      } else if (isExpired) {
        // 清除过期状态
        clearProcessingState();
      }
    }
  } catch (error) {
    console.error("加载处理状态失败:", error);
    clearProcessingState();
  }

  return false;
};

// 清除处理状态
export const clearProcessingState = (keepLogs = false) => {
  // 停止所有轮询
  stopProgressPolling();
  stopStatusSaving();

  // 保存原有日志（如果需要）
  const savedLogs = keepLogs ? [...processingState.logs] : [];

  // 重置所有状态
  Object.keys(processingState).forEach((key) => {
    if (key === "logs") {
      processingState[key] = keepLogs ? savedLogs : [];
    } else if (key === "processStatus") {
      processingState[key] = 1;
    } else if (typeof processingState[key] === "boolean") {
      processingState[key] = false;
    } else if (typeof processingState[key] === "number") {
      processingState[key] = 0;
    } else if (typeof processingState[key] === "string") {
      processingState[key] = "";
    }
  });

  // 清除会话存储
  sessionStorage.removeItem("processingStatus");

  // 重置视频显示状态
  isVideoProcessing.value = false;
  isVideoSession.value = false;
  processingStatus.value = {
    isActive: false,
    type: null,
    progress: 0,
    file: "",
    timestamp: 0,
    session: false,
  };
};

// 视频处理完成，切换到下一个视频
export const switchToNextVideo = (nextVideoFile) => {
  if (
    !processingState.processing ||
    processingState.processingType !== "video"
  ) {
    return;
  }

  // 停止当前轮询
  stopProgressPolling();

  // 更新状态
  processingState.ffmpegProgress = 0;
  processingState.currentFile = nextVideoFile;
  processingState.isFirstProgressCheck = true; // 标记为首次检查
  processingState.lastLoggedProgress = -1; // 重置上次记录的进度

  // 添加日志
  addLog("info", `准备处理下一个视频: ${nextVideoFile}`);

  // 保存状态并重启轮询
  saveProcessingStatus();

  // 延迟启动轮询，确保后端有时间准备
  setTimeout(() => {
    startProgressPolling();
  }, 1000);
};

export default {
  name: "SessionStorage",

  setup() {
    // 组件挂载时开始监控
    onMounted(() => {
      console.log("SessionStorage: 会话存储管理组件已激活");

      // 尝试恢复状态
      loadProcessingStatus();

      // 添加页面可见性变化事件监听
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          console.log("SessionStorage: 页面可见，检查处理状态");

          // 恢复状态但不添加额外日志
          loadProcessingStatus();

          // 如果正在处理视频，确保轮询是活跃的
          if (
            processingState.processing &&
            processingState.processingType === "video"
          ) {
            // 停止可能已存在的轮询
            stopProgressPolling();

            // 立即获取一次进度然后重启轮询
            fetchVideoProgress();

            // 延迟启动轮询，确保刷新不会冲突
            setTimeout(() => {
              startProgressPolling();
            }, 500);
          }
        }
      });
    });

    // 组件卸载时停止监控
    onUnmounted(() => {
      stopProgressPolling();
      stopStatusSaving();
      document.removeEventListener("visibilitychange");
    });

    return {
      // 状态已经通过export导出
    };
  },
};

// 提供开始处理方法
export const startProcessing = (type) => {
  processingState.processing = true;
  processingState.processingType = type;
  processingState.processStatus = type === "video" ? 31 : 21;
  processingState.progress = 0;
  processingState.totalCount = 0;
  processingState.processedCount = 0;
  processingState.currentFile = "";
  processingState.stopRequested = false;

  // 清空日志
  processingState.logs = [];

  processingState.isFirstProgressCheck = true; // 标记为首次检查
  processingState.lastLoggedProgress = -1; // 初始化上次记录的进度

  // 添加初始日志
  addLog("info", `开始处理${type === "video" ? "视频" : "图片"}...`);

  // 启动状态保存
  startStatusSaving();

  // 如果是视频处理，启动轮询
  if (type === "video") {
    startProgressPolling();
  }

  // 更新视频处理状态
  updateVideoProcessingStatus();
};
</script>
