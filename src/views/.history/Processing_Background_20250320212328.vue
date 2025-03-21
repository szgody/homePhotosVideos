<template>
  <!-- 后台处理组件 Background processing component -->
  <div class="processing-background">
    <!-- 标题 Title -->
    <h2>后台处理 Background Processing</h2>
    
    <!-- 控制面板 Control panel -->
    <div class="control-panel">
      <button @click="processImages" :disabled="processing">处理图片 Process Images</button>
      <button @click="processVideos" :disabled="processing">处理视频 Process Videos</button>
      <button @click="stopProcessing" v-if="processing" class="stop-btn">停止处理 Stop Processing</button>
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
          <p>视频内存: {{ memoryUsage }}</p>
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

<style>
@import '../styles/views/processing-background.css';
</style>

<script>
// 导入所需的 Vue 组件和库 Import required Vue components and libraries
import { ref, onMounted, onUnmounted } from 'vue'

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
    const memoryUsage = ref('0MB')       // 内存使用量
    let eventSource = null               // 事件源 Event source
    
    // 添加进度轮询变量
    let progressPollingInterval = null   // 进度轮询定时器
    let memoryCheckInterval = null       // 内存检查定时器

    const stopRequested = ref(false)   // 停止处理标志

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
      
      // 移除 path 开头的 /api，避免重复
      let cleanPath = path;
      if (cleanPath.startsWith('/api/')) {
        cleanPath = cleanPath.substring(4); // 移除开头的 /api
      }
      
      // 确保路径正确拼接，避免双斜杠
      if (baseUrl) {
        if (baseUrl.endsWith('/') && cleanPath.startsWith('/')) {
          return baseUrl + cleanPath.substring(1);
        } else if (!baseUrl.endsWith('/') && !cleanPath.startsWith('/')) {
          return baseUrl + '/' + cleanPath;
        }
        return baseUrl + cleanPath;
      }
      
      // 如果没有 baseUrl，确保路径以斜杠开头
      return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    };

    // 添加日志函数 Add log function
    const addLog = (type, message) => {
      logs.value.unshift({
        type,                           // 日志类型 Log type
        message: `${new Date().toLocaleTimeString()} - ${message}`  // 日志消息 Log message
      })
    }

    // 添加内存检查函数
    const startMemoryChecking = () => {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
      }
      
      memoryCheckInterval = setInterval(async () => {
        if (!processing.value || processingType.value !== 'video') {
          return;
        }
        
        try {
          const memoryUrl = buildUrl(`/video-memory-status?t=${Date.now()}`);
          
          const response = await fetch(memoryUrl, {
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.memoryMB) {
              memoryUsage.value = `${data.memoryMB}MB`;
            }
          }
        } catch (error) {
          console.error('检查内存状态失败:', error);
        }
      }, 5000);
    };
    
    const stopMemoryChecking = () => {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
        memoryCheckInterval = null;
      }
    };

    // 添加进度轮询函数，替代 Socket.IO
    const startProgressPolling = () => {
      // 先停止已有的轮询
      stopProgressPolling();
      
      // 每2秒轮询一次视频处理进度
      progressPollingInterval = setInterval(async () => {
        if (!processing.value || processingType.value !== 'video' || !currentFile.value) {
          return; // 只在处理视频时轮询
        }
        
        try {
          // 构造查询URL，添加时间戳防止缓存
          const progressUrl = buildUrl(`/video-progress?filename=${encodeURIComponent(currentFile.value)}&t=${Date.now()}`);
          
          const response = await fetch(progressUrl, {
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // 更新视频处理进度
            if (data && data.percent !== undefined) {
              ffmpegProgress.value = data.percent;
              if (data.timemarks) {
                timemarks.value = data.timemarks;
              }
              currentStage.value = `处理视频: ${currentFile.value} (${data.percent}%)`;
              
              // 记录重要状态变化
              if (data.status === 'error' && data.error) {
                addLog('error', `视频处理出错: ${data.error}`);
              } else if (data.status === 'completed') {
                addLog('success', `视频处理完成: ${currentFile.value}`);
              }
            }
          }
        } catch (error) {
          console.error('轮询视频进度失败:', error);
        }
      }, 2000);
    };
    
    const stopProgressPolling = () => {
      if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
      }
    };

    // 停止进度监控函数
    const stopProgressMonitoring = () => {
      // 清理资源，如EventSource
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      // 停止进度轮询
      stopProgressPolling();
      
      // 停止内存检查
      stopMemoryChecking();
    };

    // 启动进度监控（如果需要的话）
    const startProgressMonitoring = () => {
      // 首先停止任何现有的监控
      stopProgressMonitoring();
      
      // 添加内存监控
      startMemoryChecking();
      
      // 启动进度轮询
      startProgressPolling();
    };

    // 配置视频处理内存使用量
    const configureVideoMemory = async (memoryMB) => {
      try {
        addLog('info', `正在配置视频处理内存: ${memoryMB}MB`);
        
        const configUrl = buildUrl('/configure-video-memory');
        
        const response = await fetch(configUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memoryMB })
        });
        
        if (!response.ok) {
          throw new Error(`设置内存失败: ${response.status}`);
        }
        
        addLog('success', `视频处理内存已设置为 ${memoryMB}MB`);
        return true;
      } catch (error) {
        console.error('配置内存出错:', error);
        addLog('error', `配置内存出错: ${error.message}`);
        return false;
      }
    };

    // 停止处理的函数
    const stopProcessing = async () => {
      if (!processing.value) return;
      
      addLog('warning', '正在停止处理...');
      stopRequested.value = true;
      
      // 根据处理类型调用不同的停止API
      try {
        const stopUrl = buildUrl(processingType.value === 'image' 
          ? '/stop-image-processing' 
          : '/stop-video-processing');
        
        const response = await fetch(stopUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`停止处理失败: ${response.status}`);
        }
        
        addLog('info', '已发送停止处理请求，等待处理结束...');
      } catch (error) {
        console.error('停止处理出错:', error);
        addLog('error', `停止处理出错: ${error.message}`);
      }
    };

    // 处理图片的函数 Image processing function
    const processImages = async () => {
      let currentNumber = 0;

      try {
        // 初始化状态
        processing.value = true;
        processingType.value = 'image';
        progress.value = 0;
        processedCount.value = 0;
        totalCount.value = 0;
        currentFile.value = '';
        currentOriginalName.value = '';
        currentNewName.value = '';
        currentSN.value = '';
        currentStage.value = '初始化';
        stopRequested.value = false;
        addLog('info', '开始处理图片...');

        // 获取图片列表 - 打印请求URL进行调试
        const listImagesUrl = buildUrl('/list-images'); // 不要包含 /api 前缀，buildUrl会处理
        addLog('info', `获取图片列表: ${listImagesUrl}`);
        
        const response = await fetch(listImagesUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('图片列表响应错误:', errorText);
          throw new Error(`获取图片列表失败: ${response.status}`);
        }

        let data;
        try {
          data = await response.json();
          console.log('获取到的图片数据:', data);
        } catch (e) {
          console.error('解析响应数据失败:', e, await response.text());
          throw new Error('服务器返回的数据格式不正确');
        }

        if (!data.files || !Array.isArray(data.files)) {
          throw new Error('服务器返回的图片列表格式不正确');
        }

        totalCount.value = data.files.length;

        if (totalCount.value === 0) {
          addLog('info', '没有需要处理的图片');
          return;
        }

        addLog('info', `找到 ${totalCount.value} 张待处理图片`);

        // 读取当前序号 - 同样打印URL进行调试
        const readSnUrl = buildUrl('/read-sn');
        addLog('info', `读取序号: ${readSnUrl}`);
        
        try {
          const snResponse = await fetch(readSnUrl);
          if (!snResponse.ok) {
            const errorText = await snResponse.text();
            console.error('读取序号响应:', errorText);
            throw new Error(`读取序号失败: ${snResponse.status}`);
          }
        
          // 检查返回的内容类型
          const contentType = snResponse.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await snResponse.text();
            console.error('非JSON响应:', responseText);
            throw new Error('服务器返回了非JSON格式的数据');
          }
        
          const snData = await snResponse.json();
          console.log('获取到的序号数据:', snData);
        
          if (!snData.sn) {
            throw new Error('返回的数据中没有序号信息');
          }
        
          currentNumber = parseInt(snData.sn, 10);
          if (isNaN(currentNumber)) {
            throw new Error('无效的序号格式');
          }
        
          addLog('info', `当前序号: ${currentNumber}`);
        
        } catch (error) {
          addLog('error', `读取序号失败: ${error.message}`);
          console.error('详细错误信息:', error);
          throw error;
        }

        // 处理每张图片
        for (const file of data.files) {
          // 检查是否请求停止
          if (stopRequested.value) {
            addLog('warning', '处理已被用户中断');
            break;
          }

          try {
            currentFile.value = file;
            currentOriginalName.value = file;
            currentNewName.value = String(currentNumber + 1).padStart(6, '0');
            currentSN.value = String(currentNumber).padStart(6, '0');
            currentStage.value = '处理中';
            addLog('info', `开始处理: ${file}`);

            // 处理单张图片
            const processUrl = buildUrl('/process-single-image');
            addLog('info', `处理图片请求: ${processUrl}`);
            
            const processResponse = await fetch(processUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: file,
                newName: currentNewName.value
              })
            });

            if (!processResponse.ok) {
              const errorText = await processResponse.text();
              console.error('处理图片响应错误:', errorText);
              throw new Error(`处理失败: ${processResponse.status} ${processResponse.statusText}`);
            }

            const result = await processResponse.json();
            if (result.success) {
              addLog('success', `处理完成: ${file} -> ${currentNewName.value}`);
              currentNumber++;
              processedCount.value++;
              progress.value = Math.round((processedCount.value / totalCount.value) * 100);
            } else {
              throw new Error(result.error || '处理失败');
            }

          } catch (error) {
            addLog('error', `处理图片失败: ${file} - ${error.message}`);
          }
        }

        // 写入新序号
        if (processedCount.value > 0) {
          const writeUrl = buildUrl('/write-sn');
          addLog('info', `写入序号: ${writeUrl}`);
          
          const writeResponse = await fetch(writeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sn: String(currentNumber).padStart(6, '0')
            })
          });

          if (!writeResponse.ok) {
            const errorText = await writeResponse.text();
            console.error('写入序号错误:', errorText);
            throw new Error(`写入序号失败: ${writeResponse.status}`);
          }

          addLog('success', `序号已更新为: ${String(currentNumber).padStart(6, '0')}`);
        }

        addLog('info', `处理完成，共处理 ${processedCount.value} 张图片`);

      } catch (error) {
        addLog('error', `处理过程出错: ${error.message}`);
        console.error('详细错误信息:', error);
      } finally {
        stopRequested.value = false;
        processing.value = false;
        processingType.value = null;
        currentStage.value = '';
      }
    };

    // 处理视频的函数
    const processVideos = async () => {
      try {
        // 初始化状态
        processing.value = true;
        processingType.value = 'video';
        progress.value = 0;
        processedCount.value = 0;
        totalCount.value = 0;
        currentFile.value = '';
        currentOriginalName.value = '';
        currentNewName.value = '';
        currentSN.value = '';
        currentStage.value = '初始化';
        ffmpegProgress.value = 0;
        timemarks.value = '';
        stopRequested.value = false;
        memoryUsage.value = '0MB';
        addLog('info', '开始处理视频...');

        // 启动进度监控
        startProgressMonitoring();

        // 默认先配置视频处理内存为2GB
        await configureVideoMemory(2048);
        
        // 获取视频列表
        const listVideosUrl = buildUrl('/list-videos');
        addLog('info', `获取视频列表: ${listVideosUrl}`);
        
        const response = await fetch(listVideosUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('获取视频列表错误:', errorText);
          throw new Error(`获取视频列表失败: ${response.status}`);
        }

        let data;
        try {
          data = await response.json();
          console.log('获取到的视频列表:', data);
        } catch (e) {
          console.error('解析视频列表数据失败:', e);
          throw new Error('服务器返回的数据格式不正确');
        }

        if (!data.files || !Array.isArray(data.files)) {
          throw new Error('服务器返回的视频列表格式不正确');
        }

        totalCount.value = data.files.length;
        if (totalCount.value === 0) {
          addLog('info', '没有需要处理的视频');
          stopProgressMonitoring(); // 停止监控
          return;
        }

        addLog('info', `找到 ${totalCount.value} 个待处理视频`);

        // 读取当前序号
        const readSnUrl = buildUrl('/read-video-sn');
        addLog('info', `读取视频序号: ${readSnUrl}`);
        
        const snResponse = await fetch(readSnUrl);
        
        if (!snResponse.ok) {
          const errorText = await snResponse.text();
          console.error('读取视频序号错误:', errorText);
          throw new Error(`读取视频序号失败: ${snResponse.status}`);
        }

        let currentNumber = await snResponse.text();
        currentNumber = currentNumber.trim();
        
        // 验证序号格式
        if (!/^\d{6}$/.test(currentNumber)) {
          throw new Error(`无效的序号格式: ${currentNumber}`);
        }

        addLog('info', `当前序号: ${currentNumber}`);

        // 逐个处理视频
        for (const file of data.files) {
          // 检查是否请求停止
          if (stopRequested.value) {
            addLog('warning', '处理已被用户中断');
            break;
          }

          try {
            currentFile.value = file;
            currentOriginalName.value = file;
            ffmpegProgress.value = 0;
            timemarks.value = '';
            currentSN.value = currentNumber;
            currentStage.value = `准备处理: ${file}`;
            
            addLog('info', `开始处理视频: ${file}`);

            // 处理单个视频
            const processUrl = buildUrl('/process-single-video');
            addLog('info', `处理视频请求: ${processUrl}`);
            
            const processResponse = await fetch(processUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                filename: file,
                newName: String(currentNumber).padStart(6, '0')
              })
            });

            if (!processResponse.ok) {
              const errorText = await processResponse.text();
              console.error('处理视频响应错误:', errorText);
              throw new Error(`处理视频失败: ${processResponse.status} ${processResponse.statusText}`);
            }

            let result;
            try {
              result = await processResponse.json();
            } catch (e) {
              console.error('解析视频处理结果失败:', e);
              throw new Error('无法解析服务器返回的处理结果');
            }
            
            if (result.success) {
              currentNewName.value = result.newName;
              addLog('success', `处理完成: ${file} -> ${result.newName}`);
              if (result.thumbnail) {
                addLog('info', `生成缩略图: ${result.thumbnail}`);
              }
              // 更新序号
              currentNumber = String(Number(currentNumber) + 1).padStart(6, '0');
              // 更新进度
              processedCount.value++;
              progress.value = Math.round((processedCount.value / totalCount.value) * 100);
            } else {
              throw new Error(result.error || '处理失败');
            }

          } catch (error) {
            addLog('error', `处理视频失败: ${file} - ${error.message}`);
          }
        }

        // 写入最终序号
        if (processedCount.value > 0) {
          const writeUrl = buildUrl('/write-video-sn');
          addLog('info', `写入视频序号: ${writeUrl}`);
          
          const writeResponse = await fetch(writeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sn: currentNumber })
          });

          if (!writeResponse.ok) {
            const errorText = await writeResponse.text();
            console.error('写入视频序号错误:', errorText);
            throw new Error(`写入序号失败: ${writeResponse.status}`);
          }
          
          addLog('success', `序号已更新为: ${currentNumber}`);
        }

        addLog('info', `处理完成，共处理 ${processedCount.value} 个视频`);

      } catch (error) {
        addLog('error', `处理过程出错: ${error.message}`);
        console.error('详细错误信息:', error);
      } finally {
        // 停止进度监控
        stopProgressMonitoring();
        
        // 重置状态
        stopRequested.value = false;
        processing.value = false;
        processingType.value = null;
        currentStage.value = '';
        ffmpegProgress.value = 0;
        timemarks.value = '';
        memoryUsage.value = '0MB';
      }
    };

    // 检查是否有正在进行的处理
    const checkOngoingProcessing = async () => {
      try {
        addLog('info', '检查是否有未完成的处理任务...');
        
        const statusUrl = buildUrl('/processing-status');
        const response = await fetch(statusUrl);
        
        if (!response.ok) {
          throw new Error(`获取处理状态失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.isProcessing) {
          // 恢复处理状态
          processing.value = true;
          processingType.value = data.type || 'unknown';
          progress.value = data.progress || 0;
          currentFile.value = data.currentFile || '';
          processedCount.value = data.processedCount || 0;
          totalCount.value = data.totalCount || 0;
          
          // 如果是视频处理，启动视频进度监控
          if (processingType.value === 'video') {
            startProgressMonitoring();
          }
          
          addLog('info', `恢复${processingType.value === 'image' ? '图片' : '视频'}处理进度: ${progress.value}%`);
          return true;
        }
        return false;
      } catch (error) {
        console.error('检查处理状态失败:', error);
        addLog('error', `检查处理状态失败: ${error.message}`);
        return false;
      }
    };

    // onMounted 函数
    onMounted(async () => {
      try {
        // 初始化时添加日志
        addLog('info', '组件初始化...');
        
        // 检查是否有未完成的处理任务
        await checkOngoingProcessing();
      } catch (error) {
        console.error('组件挂载错误:', error);
        addLog('error', `组件挂载错误: ${error.message}`);
      }
    });

    // onUnmounted 函数
    onUnmounted(() => {
      // 停止所有监控
      stopProgressMonitoring();
    });

    // 返回组件状态和方法
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
      timemarks,
      memoryUsage,
      configureVideoMemory,
      stopProcessing,
      checkOngoingProcessing
    }
  }
}
</script>
