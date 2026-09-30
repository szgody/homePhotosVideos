🏠 家庭照片与视频管站
📸 基于Vue.js构建的家庭媒体管理系统，便于整理、浏览和共享个人照片与视频。

## 系统预览

<div align="center">
  <h3>首页界面</h3>
  <img src="https://github.com/user-attachments/assets/08e36418-dc53-4f44-8655-80b2ad129641" width="800" alt="系统首页">
</div>

<div align="center">
  <h3>照片管理</h3>
  <img src="https://github.com/user-attachments/assets/d98f297f-a6cc-44ab-8a07-fc90f58699f1" width="800" alt="照片管理界面">
</div>

<div align="center">
  <h3>视频管理</h3>
  <img src="https://github.com/user-attachments/assets/c8d291a0-13c7-4a95-97e4-66a3c75a7d6a" width="800" alt="视频管理界面">
</div>

🔄 媒体处理流程
<div align="center"> <table> <tr> <td><img src="https://github.com/user-attachments/assets/1034f67c-54c2-44ec-a2ff-c496f2d54b26" width="400" alt="处理步骤1"></td> <td><img src="https://github.com/user-attachments/assets/363ba2d3-30b1-4c2b-a50e-0cd8c4057f8b" width="400" alt="处理步骤2"></td> </tr> <tr> <td><img src="https://github.com/user-attachments/assets/5738169b-3bd9-433d-aead-e4da56206c59" width="400" alt="处理步骤3"></td> <td><img src="https://github.com/user-attachments/assets/ef592392-74fe-42be-a6a6-5a7351e6c8a1" width="400" alt="处理步骤4"></td> </tr> <tr> <td align="center">📁 步骤1：选择媒体文件</td> <td align="center">⚙️ 步骤2：配置处理参数</td> </tr> <tr> <td align="center">⏳ 步骤3：处理进度监控</td> <td align="center">✅ 步骤4：处理完成预览</td> </tr> </table> </div>

## 🌟 功能特点

- **📱媒体管理**: : 照片视频上传、浏览、分类与显示
- **🔄自动处理**: 批量处理媒体、生成缩略图和唯一序号
- **⏱️任务控制**: 监控处理进度、支持中止任务
- **📊系统监控**: 存储状态检查、资源告警
- **💻响应式UI**: 适配桌面与移动设备

## 🚀 技术栈

- **🖥️前端**: Vue.js 3, Vite, Vue Router
- **⚙️后端**: Node.js, Express
- **🎞️媒体处理**: ffmpeg, Sharp/libvips
- **🔧部署**: PM2, Nginx

## 🏁 快速开始

### 👨‍💻 开发环境

```bash
# 安装依赖
npm install
cd backend && npm install && cd ..

# 启动服务
npm run dev                   # 前端 (localhost:5173)
cd backend && node server.js  # 后端 (localhost:3000)
```

### 🚀 生产部署

```bash
# 构建前端
npm run build

# 部署服务
pm2 start ecosystem.config.js
pm2 startup && pm2 save

# Nginx配置
sudo cp nginx.conf.template /etc/nginx/sites-available/home-photo
sudo ln -s /etc/nginx/sites-available/home-photo /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

> 💡 注意:PM2 前端 (npm run preview) 不包含开发代理,生产环境请通过 Nginx 反向代理 /api 与媒体路径(见 nginx.conf.template)。

## ⚙️ 配置说明

### 📝 环境变量

**🖥️前端 (.env)**
```
VITE_API_URL=/api
```

**⚙️后端 (backend/.env)**
```
PORT=3000
DATA_DIR=data
PUBLIC_DIR=public
BASE_URL=
PHOTOS_PATH=/photos
PHOTO_THUMBNAILS_PATH=/photo_thumbnails
VIDEOS_PATH=/videos
VIDEO_THUMBNAILS_PATH=/video_thumbnails
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

> ⚠️ 生产部署时必须将 ALLOWED_ORIGINS 设置为你的实际访问域名/IP(如 http://your-server-ip:8080),否则浏览器请求会被 CORS 白名单拒绝。

## 💻 系统要求

- Node.js 22+, npm 7+
- Nginx 1.18+, PM2 5+
- 系统依赖:
    ```bash
    # Debian/Ubuntu
    sudo apt install -y ffmpeg libvips-dev
    ```

## ❓ 常见问题

- **🚫端口冲突**: 修改配置中的端口设置
- **🔌API路径问题**: 检查环境变量配置
- **⚠️服务器502错误**: 检查Nginx日志和后端状态
- **🔒 文件权限**: 确保媒体目录权限正确 (chmod -R 755)

## 📂 项目结构

```text
├── 📱 src/            # 前端代码(api/、composables/、components/、views/、styles/)
├── ⚙️ backend/        # 后端 API 服务(server.js 入口 + src/ 分层 + test/)
├── 📁 data/           # 媒体文件存储(运行时生成)
├── 🖼️ public/         # 原始媒体与静态资源
├── 🐳 docker-compose.yml  # 容器编排(唯一)
└── 📄 nginx.conf.template # Nginx 模板(唯一)
```

> 📝 注: 部署时请替换所有<PROJECT_ROOT>为实际安装路径。
<div align="center"> <p>👨‍👩‍👧‍👦 为您的珍贵家庭回忆提供安全便捷的管理方式 👨‍👩‍👧‍👦</p> </div>
