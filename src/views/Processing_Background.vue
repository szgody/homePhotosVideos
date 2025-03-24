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

    <div class="processing-status">
      <div v-if="state.processingType === 'video'" class="video-progress">
        <div class="progress-details">
          <div v-if="state.currentFile" class="current-file">
            <p>当前处理: {{ state.currentFile }}</p>
            <div
              v-if="state.ffmpegProgress === 0 && state.processedCount > 0"
              class="switching-notice"
            >
              <span class="spinner">⟳</span> 正在切换到下一个视频...
            </div>

            <div class="progress-bar">
              <div
                :style="{ width: `${state.ffmpegProgress}%` }"
                class="progress ffmpeg"
              ></div>
            </div>
            <p>视频转码进度: {{ state.ffmpegProgress }}%</p>
            <p>
              已完成: {{ state.processedCount }}/{{ state.totalCount }} 个视频
            </p>
            <p>处理时间: {{ state.timemarks }}</p>
          </div>
        </div>
      </div>

      <div v-if="state.processingType === 'image'" class="image-progress">
        <div class="progress-details">
          <div v-if="state.currentFile" class="current-file">
            <p>当前处理: {{ state.currentFile }}</p>

            <div class="progress-bar">
              <div
                :style="{ width: `${state.progress}%` }"
                class="progress"
              ></div>
            </div>
            <p>处理进度: {{ state.progress }}%</p>
            <p>
              已完成: {{ state.processedCount }}/{{ state.totalCount }} 张图片
            </p>
            <p v-if="state.currentNewName">
              新文件名: {{ state.currentNewName }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="state.stopRequested" class="stop-requested-notice">
        <div class="warning-icon">⚠️</div>
        <div class="warning-message">
          <template v-if="state.processingType === 'video'">
            <strong>正在等待当前视频处理完成后停止！</strong>
            <p>请不要关闭页面，等待当前视频处理完成</p>
          </template>
          <template v-else>
            <strong>正在停止处理图片！</strong>
            <p>请等待当前操作完成</p>
          </template>
        </div>
      </div>
    </div>

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
} from "../components/SessionStorage.vue";

// 简化为
const getBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || '';
};

// 修改buildUrl函数
const buildUrl = (path) => {
  const baseUrl = getBaseUrl();

  // 确保路径有/api/前缀
  let apiPath = path;
  if (!apiPath.startsWith('/api/')) {
    apiPath = `/api/${apiPath.startsWith('/') ? apiPath.substring(1) : apiPath}`;
  }
  
  if (baseUrl) {
    if (baseUrl.endsWith("/") && apiPath.startsWith("/")) {
      return baseUrl + apiPath.substring(1);
    } else if (!baseUrl.endsWith("/") && !apiPath.startsWith("/")) {
      return baseUrl + "/" + apiPath;
    }
    return baseUrl + apiPath;
  }

  return apiPath;
};

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

// API请求超时控制函数
const createRequestTimeout = (controller) => {
  return setTimeout(() => controller.abort(), TIMEOUT.API_REQUEST);
};

export default {
  name: "ProcessingBackground",

  setup() {
    // 添加删除原始图片和视频选项的状态变量 - 可简化
    const deleteOriginalImages = ref(false);
    const deleteOriginalVideos = ref(false); 

    // 修改 processImages 函数中处理空列表的部分
    const processImages = async () => {
      startProcessing("image");

      try {
        const listImagesUrl = buildUrl("/list-images");
        addLog("info", `获取图片列表: ${listImagesUrl}`);

        const response = await fetch(listImagesUrl);
        if (!response.ok)
          throw new Error(`获取图片列表失败: ${response.status}`);

        const data = await response.json();

        if (!data.files || !Array.isArray(data.files)) {
          throw new Error("服务器返回的图片列表格式不正确");
        }

        state.totalCount = data.files.length;

        if (state.totalCount === 0) {
          addLog("info", "没有需要处理的图片");
          // 添加延迟清理状态的代码
          scheduleCleanup('empty');
          return;
        }

        const readSnUrl = buildUrl("/read-sn");
        const snResponse = await fetch(readSnUrl);
        if (!snResponse.ok)
          throw new Error(`读取序号失败: ${snResponse.status}`);

        const snData = await snResponse.json();
        let currentNumber = parseInt(snData.sn, 10);

        for (const file of data.files) {
          if (state.stopRequested) {
            addLog("warning", "处理已被用户中断");
            break;
          }

          state.currentFile = file;
          state.currentOriginalName = file;
          state.currentNewName = String(currentNumber + 1).padStart(6, "0");
          state.currentSN = String(currentNumber).padStart(6, "0");

          const processResponse = await fetch(
            buildUrl("/process-single-image"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file,
                newName: state.currentNewName,
              }),
            },
          );

          if (!processResponse.ok)
            throw new Error(`处理失败: ${processResponse.status}`);

          const result = await processResponse.json();
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
          await fetch(buildUrl("/write-sn"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sn: String(currentNumber).padStart(6, "0"),
            }),
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

              // 使用 async/await 确保日志按顺序显示
              fetch(buildUrl("/delete-all-original-images"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              })
                .then((response) => response.json())
                .then((data) => {
                  if (data.success) {
                    addLog(
                      "success",
                      `已删除 ${data.deletedCount || "0"} 张原始图片`,
                    );
                    addLog("info", "删除原始图片操作已完成");

                    // 延迟清理状态，但保留日志
                    scheduleCleanup('delete');
                  } else {
                    addLog(
                      "error",
                      `删除原始图片失败: ${data.message || "未知错误"}`,
                    );

                    // 延迟清理状态，但保留日志
                    scheduleCleanup('delete');
                  }
                })
                .catch((error) => {
                  addLog("error", `删除原始图片出错: ${error.message}`);

                  // 延迟清理状态，但保留日志
                  scheduleCleanup('delete');
                });

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

    // 修改 processVideos 函数，保存处理过的文件列表
    const processVideos = async () => {
      // 保存当前的删除选择状态，避免中途修改引起问题
      const shouldDeleteOriginals = deleteOriginalVideos.value;
      
      // 添加一个数组来记录已处理的文件
      const processedFiles = [];
      
      // 重置一些关键状态
      state.processedCount = 0;
      state.progress = 0;
      state.ffmpegProgress = 0;
      state.currentFile = '';
      state.currentNewName = '';
      
      startProcessing("video");
    
      try {
        const listVideosUrl = buildUrl("/list-videos");
        addLog("info", `获取视频列表: ${listVideosUrl}`);
    
        const response = await fetch(listVideosUrl);
        if (!response.ok)
          throw new Error(`获取视频列表失败: ${response.status}`);
    
        const data = await response.json();
    
        if (!data.files || !Array.isArray(data.files)) {
          throw new Error("服务器返回的视频列表格式不正确");
        }
    
        state.totalCount = data.files.length;
    
        if (state.totalCount === 0) {
          addLog("info", "没有需要处理的视频");
          // 添加延迟清理状态的代码
          scheduleCleanup('empty');
          return;
        }
    
        const readSnUrl = buildUrl("/read-video-sn");
        const snResponse = await fetch(readSnUrl);
        if (!snResponse.ok)
          throw new Error(`读取视频序号失败: ${snResponse.status}`);
    
        let currentNumber = await snResponse.text();
        currentNumber = currentNumber.trim();
    
        for (let i = 0; i < data.files.length; i++) {
          if (state.stopRequested) {
            addLog("warning", "处理已被用户中断");
            break;
          }
    
          const file = data.files[i];
    
          state.currentFile = file;
          state.currentOriginalName = file;
          state.currentNewName = String(Number(currentNumber) + 1).padStart(
            6,
            "0",
          );
          state.currentSN = currentNumber;
    
          const processResponse = await fetch(
            buildUrl("/process-single-video"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file,
                newName: state.currentNewName,
                deleteOriginal: false // 修改为false，留到最后统一删除
              }),
            },
          );
    
          if (!processResponse.ok)
            throw new Error(`处理视频失败: ${processResponse.status}`);
    
          const result = await processResponse.json();
    
          if (result.success) {
            // 记录成功处理的文件
            processedFiles.push(file);
            
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
    
            if (i < data.files.length - 1 && !state.stopRequested) {
              const nextFile = data.files[i + 1];
              switchToNextVideo(nextFile);
            }
          }
        }
    
        if (state.processedCount > 0) {
          await fetch(buildUrl("/write-video-sn"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sn: currentNumber }),
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
              
              // 使用Promise链确保日志顺序正确
              fetch(buildUrl("/delete-all-original-videos"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  processedFiles: processedFiles
                }),
              })
              .then(response => response.json())
              .then(result => {
                // 使用处理的视频数量作为删除数量
                const expectedCount = processedFiles.length;
                
                if (result.success) {
                  // 确保删除数量与处理数量一致
                  addLog("success", `已删除 ${expectedCount} 个原始视频`);
                  addLog("info", "删除原始视频操作已完成");
                } else {
                  addLog("error", `删除原始视频失败: ${result.message || "未知错误"}`);
                }
              })
              .catch(error => {
                addLog("error", `删除原始视频出错: ${error.message}`);
              })
              .finally(() => {
                scheduleCleanup('delete');
              });
              
              return; // 提前返回，后面的清理代码在Promise链中处理
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
        // 设置请求超时
        const controller = new AbortController();
        const timeoutId = createRequestTimeout(controller);

        // 构建停止请求URL
        const stopUrl = buildUrl(`/stop-${state.processingType}-processing`);

        const response = await fetch(stopUrl, {
          method: "POST",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (state.processingType === "video") {
            addLog("warning", "停止处理视频需要等待当前视频完成后才会生效！");
          } else {
            addLog("warning", `停止处理${processTypeName}请求失败！`);
          }
        } else {
          addLog(
            "info",
            `已发送停止处理${processTypeName}请求，等待当前处理结束...`,
          );
        }
      } catch (error) {
        if (error.name === "AbortError") {
          addLog("error", "停止处理请求超时，系统将尝试强制停止");
          scheduleCleanup('force');
        } else {
          addLog("warning", `停止处理API出错: ${error.message}`);
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
