<template>
  <!-- 视频容器 Video container -->
  <div class="video-container">
    <!-- 视频网格布局 Video grid layout -->
    <div class="video-grid">
      <!-- 遍历视频列表 Iterate through videos -->
      <div
        v-for="video in displayVideos"
        :key="video.filename"
        class="video-item"
        @click="playVideo(video)"
      >
        <!-- 视频缩略图 Video thumbnail -->
        <img
          :src="video.thumbnailPath"
          :alt="video.filename"
          class="thumbnail-video"
          @error="handleThumbnailError"
        />
        <!-- 播放图标 Play icon -->
        <div class="play-icon">▶</div>
      </div>
    </div>
  </div>

  <!-- 视频播放弹窗 Video player modal -->
  <div v-if="showVideoPlayer" class="video-modal" @click="closeVideoPlayer">
    <div class="video-player-container" @click.stop>
      <!-- 视频标题 Video title -->
      <h3 v-if="currentVideo">
        {{ currentVideo.name || currentVideo.filename }}
      </h3>

      <!-- 视频播放器 Video player -->
      <video
        v-if="currentVideo"
        ref="videoPlayer"
        controls
        autoplay
        class="video-player"
        @error="handleVideoError"
      >
        <source :src="currentVideo.videoPath" type="video/mp4" />
        您的浏览器不支持 HTML5 视频。 Your browser does not support HTML5 video.
      </video>

      <!-- 关闭按钮 Close button -->
      <button class="close-button" @click="closeVideoPlayer">&times;</button>
    </div>
  </div>
</template>

<script>
// 导入样式
import "../styles/components/video-grid.css";
// 组件配置 Component configuration
const apiUrl = import.meta.env.VITE_API_URL;
const baseUrl = import.meta.env.VITE_BASE_URL || "";

export default {
  // 组件属性 Component props
  props: {
    displayCount: {
      type: Number,
      default: 8,
    },
    sortBy: {
      type: String,
      default: "random", // 可以是 'random' 或 'date'
    },
  },

  // 组件数据 Component data
  data() {
    return {
      videos: [], // 视频数组 Array of videos
      totalVideos: 0, // 视频总数 Total number of videos
      apiBaseUrl: import.meta.env.VITE_BASE_URL || "", // 基础URL
      showVideoPlayer: false, // 是否显示视频播放器
      currentVideo: null, // 当前选中的视频
    };
  },

  // 计算属性 Computed properties
  computed: {
    // 要显示的视频列表 Videos to display
    displayVideos() {
      // 创建视频数组的副本
      const videosCopy = [...this.videos];

      // 根据 sortBy 属性选择排序方式
      if (this.sortBy === "date") {
        // 按日期降序排序（最新的先显示）
        videosCopy.sort((a, b) => {
          // 使用视频的创建日期或修改日期进行排序
          const dateA = new Date(
            a.created_at || a.date || a.timestamp || a.mtime || 0,
          );
          const dateB = new Date(
            b.created_at || b.date || b.timestamp || b.mtime || 0,
          );
          return dateB - dateA; // 降序排列，最新的在前面
        });
      } else {
        // 默认随机排序
        videosCopy.sort(() => Math.random() - 0.5);
      }

      // 截取指定数量的视频
      return videosCopy.slice(0, this.displayCount);
    },
  },

  // 组件创建时执行 Execute when component is created
  created() {
    this.fetchVideos();
  },

  // 组件方法 Component methods
  methods: {
    // 获取视频列表 Fetch video list
    async fetchVideos() {
      try {
        // 发送API请求 Send API request
        const response = await fetch(`${apiUrl}/videos`);
        if (!response.ok) {
          throw new Error("获取视频列表失败 Failed to get video list");
        }

        // 解析响应数据 Parse response data
        const data = await response.json();

        // 处理返回的数据 Process returned data
        if (data && Array.isArray(data.videos)) {
          this.videos = data.videos;
          this.totalVideos = data.videos.length;

          // 打印第一个视频的信息进行调试
          if (this.videos.length > 0) {
            console.log("第一个视频信息:", this.videos[0]);
          }
        } else {
          console.warn(
            "返回数据格式不完整，使用空数组 Incomplete data format, using empty array",
          );
          this.videos = [];
          this.totalVideos = 0;
        }
      } catch (error) {
        console.error("获取视频失败 Failed to fetch videos:", error);
        this.videos = [];
        this.totalVideos = 0;
      }
    },

    // 播放视频 Play video
    playVideo(video) {
      this.currentVideo = video;
      this.showVideoPlayer = true;
      // 禁用背景滚动
      document.body.style.overflow = "hidden";

      // 打印调试信息
      console.log("正在播放视频:", video.filename);
      console.log("视频路径:", video.videoPath);
    },

    // 关闭视频播放器 Close video player
    closeVideoPlayer() {
      // 暂停视频播放
      if (this.$refs.videoPlayer) {
        this.$refs.videoPlayer.pause();
      }

      this.showVideoPlayer = false;
      this.currentVideo = null;
      // 恢复背景滚动
      document.body.style.overflow = "";
    },

    // 处理视频缩略图加载错误 Handle thumbnail load error
    handleThumbnailError(e) {
      console.error("视频缩略图加载失败 Thumbnail load failed:", e.target.src);
      e.target.src = `${this.apiBaseUrl}/assets/video-placeholder.svg`;
    },

    // 处理视频加载错误 Handle video load error
    handleVideoError(e) {
      console.error("视频加载失败 Video load failed:", e.target);
      alert("很抱歉，视频加载失败。可能是视频格式不兼容或文件损坏。");
    },
  },
};
</script>
