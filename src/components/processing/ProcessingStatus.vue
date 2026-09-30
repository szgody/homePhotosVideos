<template>
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
</template>

<style>
@import "../../styles/views/processing-background.css";
</style>

<script>
export default {
  name: "ProcessingStatus",

  props: {
    state: { type: Object, required: true },
  },
};
</script>
