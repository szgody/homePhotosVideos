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

    <!-- 上传面板:图片/视频先经安全审查再进入待处理目录 Upload panel with security screening -->
    <div class="upload-panel">
      <h3>上传图片与视频 Upload Media</h3>
      <p class="upload-hint">
        上传的文件会先经过扩展名白名单与文件内容(魔数)安全审查,通过后放入待处理目录,随后可用上方「处理图片 / 处理视频」进行转换。
      </p>
      <div class="upload-row">
        <div class="upload-type-select">
          <label>
            <input type="radio" value="image" v-model="uploadType" />
            图片 Image
          </label>
          <label>
            <input type="radio" value="video" v-model="uploadType" />
            视频 Video
          </label>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="upload-file-input"
          :accept="uploadType === 'image' ? '.jpg,.jpeg,.png,.gif,.webp' : '.mp4,.mov,.avi,.mkv,.m4v,.wmv'"
          multiple
          :disabled="uploading || state.processing"
          @change="onFilesSelected"
        />
        <button
          class="upload-button"
          :disabled="uploading || state.processing || selectedFiles.length === 0"
          @click="uploadFiles"
        >
          {{ uploading ? "上传中... Uploading" : "上传 Upload" }}
        </button>
      </div>
      <div v-if="selectedFiles.length" class="upload-selected">
        已选择 {{ selectedFiles.length }} 个文件:
        <span v-for="(f, i) in selectedFiles" :key="i" class="upload-filename">{{ f.name }}</span>
      </div>
      <div v-if="uploadError" class="upload-error">⚠ {{ uploadError }}</div>
      <div class="upload-results" v-if="uploadResults.length">
        <div v-for="(r, i) in uploadResults" :key="i" :class="['upload-result', r.status]">
          {{ r.originalName }}:{{ r.message }}
        </div>
      </div>
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

    <!-- 页面内确认弹窗:替代 window.confirm,避免被沙箱/内嵌浏览器拦截 In-app confirm dialog -->
    <div class="confirm-dialog-overlay" v-if="confirmVisible" @click.self="onConfirm(false)">
      <div class="confirm-dialog">
        <h3>确认操作</h3>
        <p class="confirm-message">{{ confirmMessage }}</p>
        <div class="confirm-buttons">
          <button class="confirm-button cancel-button" @click="onConfirm(false)">
            取消
          </button>
          <button class="confirm-button delete-button" @click="onConfirm(true)">
            确认停止
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import "../styles/views/processing-background.css";
</style>

<script>
import { onMounted, ref, watch } from "vue";
import {
  processingState as state,
  addLog,
  clearProcessingState,
  startProcessing,
  loadProcessingStatus,
  switchToNextVideo,
  attachToVideoProcessing,
} from "../composables/useProcessing.js";
// 导入统一 API 客户端 Import unified API client
import { apiGet, apiPost, API_URL } from "../api/client";
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

// 图片批处理分块大小:与后端 IMAGE_CONCURRENCY 默认值一致,
// 块内由后端并发处理,块间串行以刷新进度并及时响应停止请求
// Image batch chunk size: parallel inside a chunk (server side), sequential between chunks
const IMAGE_BATCH_SIZE = 8;

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

    // ===== 页面内确认弹窗(替代 window.confirm,沙箱环境不拦截)=====
    const confirmVisible = ref(false);
    const confirmMessage = ref("");
    let confirmResolve = null;

    // 弹出确认框,返回 Promise<boolean>
    const askConfirm = (message) => {
      confirmMessage.value = message;
      confirmVisible.value = true;
      return new Promise((resolve) => {
        confirmResolve = resolve;
      });
    };

    // 用户点击弹窗按钮后结算 Promise
    const onConfirm = (result) => {
      confirmVisible.value = false;
      if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
      }
    };

    // ===== 上传状态(图片/视频,后端安全审查)=====
    const uploadType = ref("image");
    const selectedFiles = ref([]);
    const uploading = ref(false);
    const uploadResults = ref([]);
    const uploadError = ref("");
    const fileInput = ref(null);

    // 切换上传类型时清空已选文件
    watch(uploadType, () => {
      selectedFiles.value = [];
      uploadResults.value = [];
      uploadError.value = "";
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    });

    // 选择文件后仅记录到状态,不立刻上传
    const onFilesSelected = (event) => {
      selectedFiles.value = Array.from(event.target.files || []);
      uploadError.value = "";
      uploadResults.value = [];
    };

    // 以 FormData 上传至 /api/upload,后端完成扩展名白名单 + 魔数嗅探审查
    const uploadFiles = async () => {
      if (uploading.value || selectedFiles.value.length === 0) {
        return;
      }

      uploading.value = true;
      uploadError.value = "";
      uploadResults.value = [];

      try {
        const formData = new FormData();
        formData.append("type", uploadType.value);
        for (const file of selectedFiles.value) {
          formData.append("files", file);
        }

        const response = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        let data = null;
        try {
          data = await response.json();
        } catch {
          // 非 JSON 响应(如网关错误),统一走下方错误提示
        }

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error("文件过大:图片限 50MB,视频限 3GB");
          }
          throw new Error(
            (data && data.error) || `上传失败 (HTTP ${response.status})`,
          );
        }

        if (!data || !Array.isArray(data.results)) {
          throw new Error("服务器返回格式不正确");
        }

        uploadResults.value = data.results.map((r) => ({
          originalName: r.originalName,
          status: r.success ? "success" : "rejected",
          message: r.success
            ? ` 已通过安全审查,保存为 ${r.savedAs}`
            : ` 未通过审查,已拒绝:${r.rejected || "未知原因"}`,
        }));

        const okCount = data.results.filter((r) => r.success).length;
        if (okCount > 0) {
          addLog(
            "success",
            `上传完成:${okCount} 个文件已通过安全审查并放入待处理目录`,
          );
        }
      } catch (error) {
        uploadError.value = error.message || "上传失败";
        addLog("error", `上传失败: ${error.message}`);
      } finally {
        uploading.value = false;
        selectedFiles.value = [];
        if (fileInput.value) {
          fileInput.value.value = "";
        }
      }
    };

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

        // 分块调用后端有界并发批处理接口:块内并发、块间串行,便于刷新进度并及时响应停止
        // Chunked calls: parallel inside a chunk (server side), sequential between chunks
        // 序号(sn)由后端在批处理内统一分配与落盘,前端不再自行读写序号
        for (let i = 0; i < data.images.length; i += IMAGE_BATCH_SIZE) {
          if (state.stopRequested) {
            addLog("warning", "处理已被用户中断");
            break;
          }

          const chunk = data.images.slice(i, i + IMAGE_BATCH_SIZE);
          state.currentFile = chunk[0];
          state.currentOriginalName = chunk[0];

          const result = await apiPost("/process-images-batch", { files: chunk });

          for (const item of result.results || []) {
            if (item.error) {
              addLog("error", `处理失败: ${item.originalName} (${item.error})`);
              continue;
            }
            addLog("success", `处理完成: ${item.originalName} -> ${item.newName}`);
            state.currentNewName = item.newName;
            if (item.sn) {
              state.currentSN = item.sn;
            }
            state.processedCount++;
          }

          state.progress = Math.round(
            (state.processedCount / state.totalCount) * 100,
          );

          if (result.cancelled) {
            addLog("warning", "后端已中止图片处理");
            break;
          }
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
      // 是否已接管服务端正在运行的任务(此时不能清理状态)
      let attachedToRunning = false;
      
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
    
          let result;
          try {
            result = await apiPost("/process-single-video", {
              filename: file,
              newName: state.currentNewName,
              deleteOriginal: false, // 修改为false，留到最后统一删除
            });
          } catch (error) {
            // 409:该文件已在服务端处理中(多为上一次会话或其它标签页启动的同一任务)
            // 此时接管任务:恢复进度显示,并让「停止处理」可以中止这个任务
            if (error.status === 409) {
              addLog(
                "warning",
                `该视频已在服务端处理中,已接管进度显示: ${file}`,
              );
              attachToVideoProcessing(file);
              attachedToRunning = true;
              break;
            }
            throw error;
          }
    
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
        // 已接管服务端运行中的任务时不清理,否则进度与「停止处理」会立即消失
        if (
          !attachedToRunning &&
          (!deleteOriginalVideos.value ||
            state.processedCount < state.totalCount)
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
        const confirmStop = await askConfirm(
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

      const confirmStop = await askConfirm(confirmMessage);
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
      confirmVisible,
      confirmMessage,
      onConfirm,
      uploadType,
      selectedFiles,
      uploading,
      uploadResults,
      uploadError,
      fileInput,
      onFilesSelected,
      uploadFiles,
    };
  },
};
</script>
