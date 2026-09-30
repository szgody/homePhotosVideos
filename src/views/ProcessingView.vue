<template>
  <div class="processing-background">
    <h2>后台处理 Background Processing</h2>

    <div class="control-panel">
      <div class="image-control-group">
        <button @click="processImages" :disabled="state.processStatus !== 1">
          处理图片 Process Images
        </button>
        <div class="auto-delete-option" v-if="state.processStatus === 1">
          <input
            type="checkbox"
            id="auto-delete-images"
            v-model="deleteOriginalImages"
          />
          <label for="auto-delete-images">处理完成后自动删除原始图片</label>
        </div>
      </div>

      <div class="video-control-group">
        <button @click="processVideos" :disabled="state.processStatus !== 1">
          处理视频 Process Videos
        </button>
        <div class="auto-delete-option" v-if="state.processStatus === 1">
          <input
            type="checkbox"
            id="auto-delete-videos"
            v-model="deleteOriginalVideos"
          />
          <label for="auto-delete-videos">处理完成后自动删除原始视频</label>
        </div>
      </div>

      <button @click="stopProcessing" v-if="state.processing" class="stop-btn">
        停止处理 Stop Processing
      </button>

      <button
        @click="forceResetStatus"
        v-if="state.ffmpegProgress >= 95 && state.processing"
        class="reset-btn"
      >
        强制完成 Force Complete
      </button>
    </div>

    <ProcessingStatus :state="state" />

    <div class="logs">
      <h3>处理日志</h3>
      <div class="log-container">
        <div
          v-for="(log, index) in state.logs"
          :key="index"
          :class="['log-entry', log.type]"
        >
          {{ log.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import "../styles/views/processing-background.css";
</style>

<script>
import { onMounted, ref } from "vue";
import {
  processingState as state,
  addLog,
  clearProcessingState,
  startProcessing,
  loadProcessingStatus,
  switchToNextVideo,
} from "../composables/useProcessing.js";
// 导入统一 API 客户端 Import unified API client
import { apiGet, apiPost } from "../api/client";
// 导入进度面板子组件 Import progress panel sub-component
import ProcessingStatus from "../components/processing/ProcessingStatus.vue";

// 统一的超时时间常量
const TIMEOUT = {
  EMPTY_LIST: 2000,         // 空列表清理时间
  DELETE_RESULT: 3000,      // 删除操作后展示结果时间
  NORMAL_CLEANUP: 1500,     // 标准清理时间
  API_REQUEST: 3000,        // API请求超时时间
  FORCE_CLEANUP: 1000       // 强制清理时间
};

// 统一的清理调度函数
const scheduleCleanup = (type, keepLogs = true) => {
  let timeout;
  
  switch (type) {
    case 'empty':
      timeout = TIMEOUT.EMPTY_LIST;
      break;
    case 'delete':
      timeout = TIMEOUT.DELETE_RESULT;
      break;
    case 'force':
      timeout = TIMEOUT.FORCE_CLEANUP;
      break;
    case 'normal':
    default:
      timeout = TIMEOUT.NORMAL_CLEANUP;
  }
  
  return setTimeout(() => clearProcessingState(keepLogs), timeout);
};

// API请求超时控制函数:返回超时拒绝的 Promise,与 apiPost 竞争
const createRequestTimeout = (message) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message);
      error.name = "AbortError";
      reject(error);
    }, TIMEOUT.API_REQUEST);
  });
};

export default {
  name: "ProcessingView",

  components: {
    ProcessingStatus,
  },

  setup() {
    // 添加删除原始图片和视频选项的状态变量 - 可简化
    const deleteOriginalImages = ref(false);
    const deleteOriginalVideos = ref(false); 

    // 修改 processImages 函数中处理空列表的部分
    const processImages = async () => {
      startProcessing("image");

      try {
        addLog("info", "获取图片列表: /list-images");

        const data = await apiGet("/list-images");

        if (!data.images || !Array.isArray(data.images)) {
          throw new Error("服务器返回的图片列表格式不正确");
        }

        state.totalCount = data.images.length;

        if (state.totalCount === 0) {
          addLog("info", "没有需要处理的图片");
          // 添加延迟清理状态的代码
          scheduleCleanup('empty');
          return;
        }

        const snData = await apiGet("/read-sn");
        let currentNumber = parseInt(snData.sn, 10);

        for (const file of data.images) {
          if (state.stopRequested) {
            addLog("warning", "处理已被用户中断");
            break;
          }

          state.currentFile = file;
          state.currentOriginalName = file;
          state.currentNewName = String(currentNumber + 1).padStart(6, "0");
          state.currentSN = String(currentNumber).padStart(6, "0");

          const result = await apiPost("/process-single-image", {
            filename: file,
            newName: state.currentNewName,
          });

          if (result.success) {
            addLog("success", `处理完成: ${file} -> ${state.currentNewName}`);
            currentNumber++;
            state.processedCount++;
            state.progress = Math.round(
              (state.processedCount / state.totalCount) * 100,
            );
          }
        }

        if (state.processedCount > 0) {
          // 确保序号为 6 位补齐字符串 Ensure sn is 6-digit padded string
          await apiPost("/write-sn", {
            sn: String(currentNumber).padStart(6, "0"),
          });
        }
      } catch (error) {
        addLog("error", `处理过程出错: ${error.message}`);
      } finally {
        // 添加处理完成的日志
        if (!state.stopRequested && state.processedCount > 0) {
          if (state.processedCount >= state.totalCount) {
            addLog(
              "success",
              `✅ 所有图片处理已完成！共处理 ${state.processedCount} 个图片`,
            );

            // 如果用户选择了自动删除，则删除原始图片
            if (deleteOriginalImages.value) {
              // 直接删除原始图片，不再弹窗确认
              addLog("warning", "根据设置，正在删除原始图片...");

              try {
                const data = await apiPost("/delete-all-original-images");

                if (data.success) {
                  addLog(
                    "success",
                    `已删除 ${data.deletedCount || "0"} 张原始图片`,
                  );
                  addLog("info", "删除原始图片操作已完成");
                } else {
                  addLog(
                    "error",
                    `删除原始图片失败: ${data.message || "未知错误"}`,
                  );
                }
              } catch (error) {
                addLog("error", `删除原始图片出错: ${error.message}`);
              }

              // 延迟清理状态，但保留日志
              scheduleCleanup('delete');

              return; // 提前返回，让清理状态只在删除完成后执行
            } else {
              // 用户未选择删除
              addLog("info", "已保留原始图片，所有处理后的图片可在网站上查看");
            }
          } else {
            addLog(
              "info",
              `处理结束，已完成 ${state.processedCount}/${state.totalCount} 个图片`,
            );
          }
        }

        // 延迟清理状态 - 仅对不需要删除原始图片的情况执行
        if (
          !deleteOriginalImages.value ||
          state.processedCount < state.totalCount
        ) {
          scheduleCleanup('normal');
        }
      }
    };

    // 处理视频函数(逐文件处理)
    const processVideos = async () => {
      // 保存当前的删除选择状态，避免中途修改引起问题
      const shouldDeleteOriginals = deleteOriginalVideos.value;
      
      // 重置一些关键状态
      state.processedCount = 0;
      state.progress = 0;
      state.ffmpegProgress = 0;
      state.currentFile = '';
      state.currentNewName = '';
      
      startProcessing("video");
    
      try {
        addLog("info", "获取视频列表: /list-videos");
    
        const data = await apiGet("/list-videos");
    
        if (!data.videos || !Array.isArray(data.videos)) {
          throw new Error("服务器返回的视频列表格式不正确");
        }
    
        state.totalCount = data.videos.length;
    
        if (state.totalCount === 0) {
          addLog("info", "没有需要处理的视频");
          // 添加延迟清理状态的代码
          scheduleCleanup('empty');
          return;
        }
    
        // 后端现在返回 JSON:{ sn }
        const snData = await apiGet("/read-video-sn");
        let currentNumber = snData.sn;
    
        for (let i = 0; i < data.videos.length; i++) {
          if (state.stopRequested) {
            addLog("warning", "处理已被用户中断");
            break;
          }
    
          const file = data.videos[i];
    
          state.currentFile = file;
          state.currentOriginalName = file;
          state.currentNewName = String(Number(currentNumber) + 1).padStart(
            6,
            "0",
          );
          state.currentSN = currentNumber;
    
          const result = await apiPost("/process-single-video", {
            filename: file,
            newName: state.currentNewName,
            deleteOriginal: false, // 修改为false，留到最后统一删除
          });
    
          if (result.success) {
            state.currentNewName = result.newName;
            addLog("success", `处理完成: ${file} -> ${result.newName}`);
            if (result.thumbnail) {
              addLog("info", `生成缩略图: ${result.thumbnail}`);
            }
    
            currentNumber = String(Number(currentNumber) + 1).padStart(6, "0");
            state.processedCount++;
            state.progress = Math.floor(
              (state.processedCount / state.totalCount) * 100,
            );
    
            if (state.stopRequested) {
              addLog("warning", "用户请求已处理，停止处理后续视频");
              break;
            }
    
            if (i < data.videos.length - 1 && !state.stopRequested) {
              const nextFile = data.videos[i + 1];
              switchToNextVideo(nextFile);
            }
          }
        }
    
        if (state.processedCount > 0) {
          // 确保序号为 6 位补齐字符串 Ensure sn is 6-digit padded string
          await apiPost("/write-video-sn", {
            sn: String(currentNumber).padStart(6, "0"),
          });
        }
      } catch (error) {
        addLog("error", `处理过程出错: ${error.message}`);
      } finally {
        if (!state.stopRequested && state.processedCount > 0) {
          if (state.processedCount >= state.totalCount) {
            addLog("success", `✅ 所有视频处理已完成！共处理 ${state.processedCount} 个视频`);
            
            // 使用函数开始时保存的删除状态，而不是当前可能已变更的状态
            if (shouldDeleteOriginals) {
              // 先显示开始删除的消息
              addLog("warning", "根据设置，正在删除原始视频...");
              
              try {
                const result = await apiPost("/delete-all-original-videos");
                
                if (result.success) {
                  addLog("success", `已删除 ${result.deletedCount || "0"} 个原始视频`);
                  addLog("info", "删除原始视频操作已完成");
                } else {
                  addLog("error", `删除原始视频失败: ${result.message || "未知错误"}`);
                }
              } catch (error) {
                addLog("error", `删除原始视频出错: ${error.message}`);
              }
              
              // 延迟清理状态，但保留日志
              scheduleCleanup('delete');
              
              return; // 提前返回，后面的清理代码在删除完成后处理
            } else {
              // 用户未选择删除
              addLog("info", "已保留原始视频，所有处理后的视频可在网站上查看");
            }
          } else {
            addLog(
              "info",
              `处理结束，已完成 ${state.processedCount}/${state.totalCount} 个视频`,
            );
          }
        }
    
        // 延迟清理状态 - 仅对不需要删除原始视频的情况执行
        if (
          !deleteOriginalVideos.value ||
          state.processedCount < state.totalCount
        ) {
          scheduleCleanup('normal');
        }
      }
    };

    // 修改停止处理函数，处理卡住情况
    const stopProcessing = async () => {
      // 检测是否真的有任务在处理
      const hasActiveTask =
        state.currentFile &&
        (state.processingType === "video"
          ? state.ffmpegProgress > 0
          : state.progress > 0);

      // 根据处理类型确定消息
      const processTypeName =
        state.processingType === "video" ? "视频" : "图片";

      // 如果没有活动任务，直接清理状态
      if (!hasActiveTask && state.totalCount === 0) {
        const confirmStop = confirm(
          `似乎没有${processTypeName}在处理。是否重置系统状态？`,
        );
        if (confirmStop) {
          addLog("info", `重置${processTypeName}处理状态`);
          clearProcessingState(true);
        }
        return;
      }

      // 如果是视频处理且进度在中间，显示特殊确认
      let confirmMessage = "";
      if (
        state.processingType === "video" &&
        state.ffmpegProgress > 0 &&
        state.ffmpegProgress < 95
      ) {
        confirmMessage = `警告：当前${processTypeName}正在处理中(${state.ffmpegProgress}%)。\n\n必须等待当前${processTypeName}处理完成才能完全停止处理！\n\n确认停止后续${processTypeName}处理吗？`;
      } else {
        confirmMessage = `确认停止处理${processTypeName}吗？`;
      }

      const confirmStop = confirm(confirmMessage);
      if (!confirmStop) return;

      // 设置停止请求标志
      state.stopRequested = true;

      // 添加对应的日志信息 - 修复这一部分
      if (state.processingType === "video" && state.ffmpegProgress > 0) {
        addLog("warning", "正在停止视频处理...必须等待当前视频处理完成！");
      } else if (state.processingType === "image") {
        addLog("warning", "正在停止图片处理...");
      } else {
        addLog("warning", `正在停止${processTypeName}处理...`);
      }

      try {
        // 设置请求超时:与 apiPost 竞争,超时按 AbortError 处理
        const timeoutPromise = createRequestTimeout("停止处理请求超时");

        await Promise.race([
          apiPost("/cancel-processing", {
            type: state.processingType,
            file: state.currentFile,
          }),
          timeoutPromise,
        ]);

        addLog(
          "info",
          `已发送停止处理${processTypeName}请求，等待当前处理结束...`,
        );
      } catch (error) {
        if (error.name === "AbortError") {
          addLog("error", "停止处理请求超时，系统将尝试强制停止");
          scheduleCleanup('force');
        } else if (state.processingType === "video") {
          addLog("warning", "停止处理视频需要等待当前视频完成后才会生效！");
        } else {
          addLog("warning", `停止处理${processTypeName}请求失败！`);
        }
      }
    };

    // 强制重置状态
    const forceResetStatus = () => {
      addLog("warning", "强制重置系统状态...");
      clearProcessingState();
      addLog("warning", "系统状态已强制重置");
    };

    // 简化 onMounted 钩子
    onMounted(() => {
      loadProcessingStatus();
    });

    return {
      state,
      deleteOriginalImages,
      deleteOriginalVideos, 
      processImages,
      processVideos,
      stopProcessing,
      forceResetStatus,
    };
  },
};
</script>
