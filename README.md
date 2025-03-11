# 家庭照片与视频管理系统

## 网站演示
[在线体验](http://home.szgody.site)

## 功能特点
- 📷 照片库浏览与管理
- 🎬 视频库浏览与播放
- 🖼️ 自动生成图片和视频缩略图
- 🔄 批量处理照片和视频文件
- 📱 响应式设计，支持移动和桌面设备
- 🔧 后台处理界面，实时显示处理进度

## 项目结构

```plaintext
home-photo-vue/
├── backend/              # 后端代码
│   ├── app.js           # Express 应用入口点
│   ├── server.js        # 核心服务器代码
│   ├── config/          # 配置文件
│   └── controllers/     # 控制器
├── data/                 # 存储媒体文件
│   ├── photos/          # 处理后的照片
│   ├── videos/          # 处理后的视频
│   ├── photo_thumbnails/ # 照片缩略图
│   └── video_thumbnails/ # 视频缩略图
├── public/               # 静态文件
│   └── original/        # 原始媒体文件
│       ├── images/      # 原始图片
│       └── videos/      # 原始视频
├── src/                  # 前端源代码
│   ├── assets/          # 资源文件
│   ├── components/      # Vue 组件
│   ├── router/          # 路由配置
│   ├── utils/           # 工具函数
│   ├── views/           # 页面视图
│   ├── App.vue          # 根组件
│   └── main.js          # 应用入口点
└── scripts/             # 实用脚本
```

## 主要组件
- **AppHeader**: 导航栏组件
- **PhotoGrid**: 照片网格组件
- **VideoGrid**: 视频网格组件

## 主要视图
- **HomeView**: 首页视图，显示最新照片和视频
- **PhotoView**: 照片库视图，显示所有照片
- **VideoView**: 视频库视图，显示所有视频
- **Processing_Background**: 后台处理视图，用于处理原始文件

## 安装说明

### 前置要求
- Node.js 14.x 或更高版本
- FFmpeg 安装在系统上（用于视频处理）

## 安装步骤
1. 克隆项目仓库
```bash
git clone https://github.com/szgody/homePhotosVideos.git
cd home-photo-vue
```

2. 安装前端依赖
```bash
npm install
```

3. 安装后端依赖
```bash
cd backend
npm install
cd ..
```

4. 创建必要的数据目录
```bash
mkdir -p data/photos data/videos data/photo_thumbnails data/video_thumbnails
mkdir -p public/original/images public/original/videos
```

5. 检查 FFmpeg 是否安装
```bash
node scripts/check-ffmpeg.js
```

## 运行应用

1. 启动开发服务器
   
   **启动前端**
```bash
npm run dev
```

### 启动后端 (在另一个终端)
```bash
node backend/server.js
```

2. 浏览器访问: http://localhost:5173

## 部署

**使用 PM2 部署应用:**

1. 构建前端
```bash
npm run build
```

2. 启动服务
```bash
pm2 start ecosystem.config.js
```

## 环境配置
通过 .env.local 或 .env.production 文件配置应用:

- `VITE_API_URL`: API 服务器地址 (例如 http://localhost:3000)
