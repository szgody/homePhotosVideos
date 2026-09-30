<template>
  <!-- 首页最新视频容器 Home latest-videos container
       独立根类名 .home-video-grid:避开处理页全局样式里的裸 .video-container 规则 -->
  <div class="home-video-grid">
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

  <!-- 视频播放弹窗:使用共享播放器组件(空格/←/→/Esc 快捷键)Shared video player modal -->
  <VideoPlayerModal
    v-if="showVideoPlayer"
    :video="currentVideo"
    @close="closeVideoPlayer"
  />
</template>

<script>
// 导入样式
import "../styles/components/video-grid.css";
// 导入共享视频播放器 Import the shared video player
import VideoPlayerModal from "./media/VideoPlayerModal.vue";
// 导入统一 API 客户端 Import unified API client
import { apiGet } from "../api/client";

export default {
  name: "VideoGrid", // 组件名称 Component name

  // 注册子组件 Register child components
  components: {
    VideoPlayerModal, // 共享播放器组件 Shared player component
  },

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
        const data = await apiGet("/videos");

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

    // 播放视频(滚动锁与暂停由共享播放器负责)
    // Play video (scroll lock and pause are owned by the shared player)
    playVideo(video) {
      this.currentVideo = video;
      this.showVideoPlayer = true;

      // 打印调试信息 Print debug information
      console.log("正在播放视频:", video.filename);
      console.log("视频路径:", video.videoPath);
    },

    // 关闭视频播放器 Close video player
    closeVideoPlayer() {
      this.showVideoPlayer = false;
      this.currentVideo = null;
    },

    // 处理视频缩略图加载错误 Handle thumbnail load error
    handleThumbnailError(e) {
      console.error("视频缩略图加载失败 Thumbnail load failed:", e.target.src);
      e.target.src = "/assets/placeholder.svg";
    },
  },
};
</script>
