<template>
  <!-- 后台处理组件 Background processing component -->
  <div class="processing-background">
    <!-- 标题 Title -->
    <h2>后台处理 Background Processing</h2>
    
    <!-- 控制面板 Control panel -->
    <div class="control-panel">
      <button @click="processImages" :disabled="processing">处理图片 Process Images</button>
      <button @click="processVideos" :disabled="processing">处理视频 Process Videos</button>
    </div>

    <!-- 处理状态显示 Processing status display -->
    <div v-if="processing" class="processing-status">
      <!-- 进度条 Progress bar -->
      <div class="progress-bar">
        <div :style="{ width: `${progress}%` }" class="progress"></div>
      </div>
      <p>当前处理 Current processing: {{ currentFile }}</p>
      <p>总进度 Total progress: {{ progress }}% ({{ processedCount }}/{{ totalCount }})</p>
      
      <!-- 图片处理进度显示 Image processing progress display -->
      <div v-if="processingType === 'image'" class="image-progress">
        <p>正在处理图片... Processing images...</p>
        <div class="current-task">
          <p>当前任务:</p>
          <ul>
            <li>原文件名: {{ currentOriginalName }}</li>
            <li>新文件名: {{ currentNewName }}</li>
            <li>当前序号: {{ currentSN }}</li>
            <li>处理阶段: {{ currentStage }}</li>
          </ul>
        </div>
      </div>
      
      <!-- 视频处理进度显示 Video processing progress display -->
      <div v-if="processingType === 'video'" class="video-progress">
        <div v-if="currentFile && currentFile.match(/\.(mp4|avi|mov|wmv)$/i)" class="ffmpeg-progress">
          <div class="progress-bar">
            <div :style="{ width: `${ffmpegProgress}%` }" class="progress ffmpeg"></div>
          </div>
          <p>转码进度: {{ ffmpegProgress }}%</p>
          <p>处理时间: {{ timemarks }}</p>
        </div>
      </div>
    </div>

    <!-- 处理日志显示 Processing logs display -->
    <div class="logs">
      <h3>处理日志</h3>
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" :class="['log-entry', log.type]">
          {{ log.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 导入所需的 Vue 组件和库 Import required Vue components and libraries
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

export default {
  name: 'ProcessingBackground',  // 组件名称 Component name
  
  setup() {
    // 状态变量定义 State variables definition
    const processing = ref(false)        // 处理状态 Processing status
    const processingType = ref(null)     // 处理类型（图片/视频）Processing type (image/video)
    const progress = ref(0)              // 进度百分比 Progress percentage
    const currentFile = ref('')          // 当前处理文件 Current processing file
    const currentOriginalName = ref('')  // 当前原文件名 Current original filename
    const currentNewName = ref('')       // 当前新文件名 Current new filename
    const currentSN = ref('')            // 当前序号 Current serial number
    const currentStage = ref('')         // 当前处理阶段 Current processing stage
    const processedCount = ref(0)        // 已处理数量 Processed count
    const totalCount = ref(0)            // 总数量 Total count
    const logs = ref([])                 // 日志 Logs
    const ffmpegProgress = ref(0)        // FFmpeg 进度 FFmpeg progress
    const timemarks = ref('')            // 时间标记 Timemarks
    let eventSource = null               // 事件源 Event source
    const socket = ref(null)             // Socket.IO 实例 Socket.IO instance

    // 获取API基础路径 - 统一使用baseUrl
    const getBaseUrl = () => {
      return import.meta.env.VITE_BASE_URL || 
             import.meta.env.VITE_API_BASE_URL || 
             import.meta.env.VITE_API_URL || 
             process.env.VUE_APP_BASE_URL ||
             process.env.VUE_APP_API_BASE_URL || 
             '';
    };

    // 构建完整API路径
    const buildUrl = (path) => {
      const baseUrl = getBaseUrl();
      // 确保路径正确拼接，避免双斜杠
      if (baseUrl && path) {
        if (baseUrl.endsWith('/') && path.startsWith('/')) {
          return baseUrl + path.substring(1);
        } else if (!baseUrl.endsWith('/') && !path.startsWith('/')) {
          return baseUrl + '/' + path;
        }
      }
      return baseUrl + path;
    };

    // 添加日志函数 Add log function
    const addLog = (type, message) => {
      logs.value.unshift({
        type,                           // 日志类型 Log type
        message: `${new Date().toLocaleTimeString()} - ${message}`  // 日志消息 Log message
      })
    }

    // 处理图片的函数 Image processing function
    const processImages = async () => {
      let currentNumber = 0  // 在函数开始处定义 currentNumber

      try {
        // 初始化状态
        processing.value = true
        processingType.value = 'image'
        progress.value = 0
        processedCount.value = 0
        totalCount.value = 0
        currentFile.value = ''
        currentOriginalName.value = ''
        currentNewName.value = ''
        currentSN.value = ''
        currentStage.value = '初始化'
        logs.value = []
        addLog('info', '开始处理图片...')

        // 获取图片列表
        const response = await fetch(buildUrl('/api/list-images'))
        if (!response.ok) {
          throw new Error(`获取图片列表失败: ${response.status}`)
        }

        let data
        try {
          data = await response.json()
        } catch (e) {
          console.error('解析响应数据失败:', await response.text())
          throw new Error('服务器返回的数据格式不正确')
        }

        console.log('获取到的图片列表:', data)
        totalCount.value = data.files.length

        if (totalCount.value === 0) {
          addLog('info', '没有需要处理的图片')
          return
        }

        // 读取当前序号
        try {
          const snResponse = await fetch(buildUrl('/api/read-sn'))
          if (!snResponse.ok) {
            const errorText = await snResponse.text()
            console.error('读取序号响应:', errorText)
            throw new Error(`读取序号失败: ${snResponse.status}`)
          }
        
          // 检查返回的内容类型
          const contentType = snResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('服务器返回了非JSON格式的数据')
          }
        
          const snData = await snResponse.json()
          console.log('获取到的序号数据:', snData)
        
          if (!snData.sn) {
            throw new Error('返回的数据中没有序号信息')
          }
        
          currentNumber = parseInt(snData.sn, 10)  // 更新 currentNumber
          if (isNaN(currentNumber)) {
            throw new Error('无效的序号格式')
          }
        
          console.log('当前序号:', currentNumber)
          addLog('info', `当前序号: ${currentNumber}`)
        
          // ...继续处理
        } catch (error) {
          addLog('error', `读取序号失败: ${error.message}`)
          console.error('详细错误信息:', error)
          throw error  // 向上传播错误
        }

        // 处理每张图片
        for (const file of data.files) {
          try {
            currentFile.value = file
            currentOriginalName.value = file
            currentNewName.value = String(currentNumber + 1).padStart(6, '0')
            currentSN.value = String(currentNumber).padStart(6, '0')
            currentStage.value = '处理中'
            addLog('info', `开始处理: ${file}`)

            const processResponse = await fetch(buildUrl('/api/process-single-image'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: file,
                newName: currentNewName.value
              })
            })

            if (!processResponse.ok) {
              throw new Error(`处理失败: ${processResponse.statusText}`)
            }

            const result = await processResponse.json()
            if (result.success) {
              addLog('success', `处理完成: ${file} -> ${currentNewName.value}`)
              currentNumber++
              processedCount.value++
              progress.value = Math.round((processedCount.value / totalCount.value) * 100)
            } else {
              throw new Error(result.error || '处理失败')
            }

          } catch (error) {
            addLog('error', `处理图片失败: ${file} - ${error.message}`)
          }
        }

        // 写入新序号
        const writeResponse = await fetch(buildUrl('/api/write-sn'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sn: String(currentNumber).padStart(6, '0')
          })
        })

        if (!writeResponse.ok) {
          throw new Error('写入序号失败')
        }

        addLog('info', `处理完成，共处理 ${processedCount.value} 张图片`)

      } catch (error) {
        addLog('error', `处理过程出错: ${error.message}`)
        console.error('详细错误信息:', error)
        return;  // 遇到错误时提前返回
      } finally {
        processing.value = false
        processingType.value = null
        currentStage.value = ''
      }
    }

    // 添加 FFmpeg 进度监听
    const startProgressMonitoring = () => {
      eventSource = new EventSource(buildUrl('/api/progress-stream'));
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          ffmpegProgress.value = data.percent;
          timemarks.value = data.timemarks;
          currentStage.value = `处理视频: ${data.filename} (${data.percent}%)`;
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE 连接错误:', error);
        eventSource.close();
      };
    };

    const stopProgressMonitoring = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    // 处理视频的函数 Video processing function
    const processVideos = async () => {
      try {
        // 初始化状态
        processing.value = true;
        processingType.value = 'video'
        progress.value = 0;
        processedCount.value = 0;
        totalCount.value = 0;
        currentFile.value = '';
        currentOriginalName.value = '';
        currentNewName.value = '';
        currentSN.value = '';
        currentStage.value = '初始化';
        logs.value = [];
        addLog('info', '开始处理视频...');

        // 获取视频列表
        const response = await fetch(buildUrl('/api/list-videos'));
        if (!response.ok) {
          throw new Error(`获取视频列表失败: ${response.status}`);
        }

        const data = await response.json();
        console.log('获取到的视频列表:', data);

        if (!data.files || !Array.isArray(data.files)) {
          throw new Error('服务器返回的视频列表格式不正确');
        }

        totalCount.value = data.files.length;
        if (totalCount.value === 0) {
          addLog('info', '没有需要处理的视频');
          return;
        }

        addLog('info', `找到 ${totalCount.value} 个待处理视频`);

        // 读取当前序号
        const snResponse = await fetch(buildUrl('/api/read-video-sn'), {
          method: 'POST'
        })

        if (!snResponse.ok) {
          throw new Error('读取视频序号失败')
        }

        let currentNumber = await snResponse.text()
        currentNumber = currentNumber.trim()
        
        // 验证序号格式
        if (!/^\d{6}$/.test(currentNumber)) {
          throw new Error(`无效的序号格式: ${currentNumber}`)
        }

        addLog('info', `当前序号: ${currentNumber}`)

        // 逐个处理视频
        for (const file of data.files) {
          try {
            currentFile.value = file
            currentOriginalName.value = file
            ffmpegProgress.value = 0
            timemarks.value = ''
            currentSN.value = currentNumber
            currentStage.value = `准备处理: ${file}`
            
            addLog('info', `开始处理视频: ${file}`)

            const processResponse = await fetch(buildUrl('/api/process-single-video'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                filename: file,
                newName: String(currentNumber).padStart(6, '0')  // 只使用序号作为新名称
              })
            })

            if (!processResponse.ok) {
              throw new Error(`处理视频失败: ${processResponse.statusText}`)
            }

            const result = await processResponse.json()
            if (result.success) {
              currentNewName.value = result.newName
              addLog('success', `处理完成: ${file} -> ${result.newName}`)
              if (result.thumbnail) {
                addLog('info', `生成缩略图: ${result.thumbnail}`)
              }
              // 更新序号
              currentNumber = String(Number(currentNumber) + 1).padStart(6, '0')
              // 更新进度
              processedCount.value++
              progress.value = Math.round((processedCount.value / totalCount.value) * 100)
            } else {
              throw new Error(result.error || '处理失败')
            }

          } catch (error) {
            addLog('error', `处理视频失败: ${file} - ${error.message}`)
          }
        }

        // 写入最终序号
        if (processedCount.value > 0) {
          const writeResponse = await fetch(buildUrl('/api/write-video-sn'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sn: currentNumber })
          })

          if (!writeResponse.ok) {
            throw new Error('写入序号失败')
          }
        }

        addLog('info', `处理完成，共处理 ${processedCount.value} 个视频`)

      } catch (error) {
        addLog('error', `处理过程出错: ${error.message}`)
        console.error('详细错误信息:', error)
      } finally {
        processing.value = false
        processingType.value = null
        currentStage.value = ''
        ffmpegProgress.value = 0
        timemarks.value = ''
      }
    }

    // 组件挂载时执行 Execute when component is mounted
    onMounted(() => {
      // 初始化 Socket.IO 连接 Initialize Socket.IO connection
      socket.value = io(getBaseUrl() || window.location.origin)
      
      // 监听视频处理进度 Listen for video processing progress
      socket.value.on('videoProgress', (data) => {
        switch(data.type) {
          case 'start':    // 开始处理 Start processing
            addLog('info', `开始处理视频 Start processing video: ${data.filename}`)
            break
          case 'progress': // 处理进度 Processing progress
            ffmpegProgress.value = data.percent
            timemarks.value = data.timemarks
            currentStage.value = `处理视频 Processing video: ${data.filename} (${data.percent}%)`
            break
          case 'end':      // 处理完成 Processing completed
            addLog('success', `视频处理完成 Video processing completed: ${data.filename}`)
            break
          case 'error':    // 处理错误 Processing error
            addLog('error', `视频处理失败 Video processing failed: ${data.filename} - ${data.error}`)
            break
        }
      })
    })

    // 组件卸载时执行 Execute when component is unmounted
    onUnmounted(() => {
      // 断开 Socket.IO 连接 Disconnect Socket.IO connection
      if (socket.value) {
        socket.value.disconnect()
      }
    })

    // 返回组件状态和方法 Return component state and methods
    return {
      processing,
      processingType,
      progress,
      currentFile,
      currentOriginalName,
      currentNewName,
      currentSN,
      currentStage,
      processedCount,
      totalCount,
      logs,
      processImages,
      processVideos,
      ffmpegProgress,
      timemarks
    }
  }
}
</script>

<style scoped>
/* 处理背景样式 Processing background styles */
.processing-background {
  padding: 20px;                /* 内边距 Padding */
}

/* 控制面板样式 Control panel styles */
.control-panel {
  margin-bottom: 20px;          /* 底部外边距 Bottom margin */
}

/* 进度条样式 Progress bar styles */
.progress-bar {
  width: 100%;                  /* 宽度 Width */
  height: 20px;                 /* 高度 Height */
  background-color: #f0f0f0;    /* 背景色 Background color */
  border-radius: 10px;          /* 圆角 Border radius */
  overflow: hidden;             /* 溢出隐藏 Hide overflow */
  margin: 10px 0;              /* 上下外边距 Vertical margin */
}

.progress {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

.progress.ffmpeg {
  background-color: #2196F3;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  padding: 10px;
  border-radius: 4px;
}

.log-entry {
  padding: 5px;
  margin: 2px 0;
  border-radius: 3px;
}

.log-entry.success {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.log-entry.error {
  background-color: #ffebee;
  color: #c62828;
}

.log-entry.info {
  background-color: #e3f2fd;
  color: #1565c0;
}

.image-progress, .video-progress {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.current-task {
  margin-top: 10px;
  padding: 10px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

button {
  margin-right: 10px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #4CAF50;
  color: white;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>