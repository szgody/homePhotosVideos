# 🏠 家庭照片与视频管理站

📸 基于 **Vue 3 + Vite + Express** 构建的家庭媒体管理系统，便于整理、浏览和共享个人照片与视频。

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

- **📤 上传与安全审查**: 处理页可直接上传图片/视频。后端先做扩展名白名单 + 文件内容(魔数)嗅探：图片经 Sharp 真实解码校验、视频经 ffprobe 校验含视频流，通过后才改名进入待处理目录，因此「把脚本改名成 .jpg」这类伪造文件会被直接拒绝
- **🔄 自动处理(按硬件并发)**: 批量复制/压缩/转码、生成缩略图与唯一序号；图片并发与视频编码线程数按本机 CPU 自动推导，可用环境变量覆盖
- **⏱️ 任务控制**: 实时进度监控与一键中止(页面内确认弹窗，图片处理可立即中断，视频等当前转码结束)
- **🖼️ 浏览体验**: 照片灯箱与视频播放器为共享组件，支持 `←`/`→` 切换、`空格` 播放/暂停、`Esc` 关闭，带毛玻璃遮罩与入场动画
- **📱 响应式 UI**: 桌面与移动端自适应，安全区(`safe-area`)适配、触控目标 ≥ 44px
- **📊 运行状态**: `GET /api/health` 返回内存占用与实际生效的并发/线程配置

## 🚀 技术栈

| 层 | 技术 |
| --- | --- |
| 🖥️ 前端 | Vue 3.5 + Vite 8 + Vue Router 5(ES Modules) |
| ⚙️ 后端 | Node.js 22 + Express 5(CommonJS，分层 `config/utils/services/routes`) |
| 🎞️ 媒体处理 | Sharp 0.35(图片)、fluent-ffmpeg + ffmpeg/ffprobe(视频) |
| 📤 上传 | multer 2(先落系统临时目录，安全审查通过后改名入库) |
| 🧪 测试 | Node 内置 `node:test`(零额外依赖，45 个测试) |
| 🔧 部署 | PM2 + Nginx + Docker Compose |

## 🏁 快速开始

### 👨‍💻 开发环境

```bash
# 安装依赖
npm install
cd backend && npm install && cd ..

# 启动服务
npm run dev                   # 前端 (localhost:5173)
cd backend && node server.js  # 后端 (localhost:3000)

# 测试与检查
cd backend && npm test        # 后端单元/接口测试(45 个)
cd .. && npm run check        # 项目结构检查 + ffmpeg 可用性检查
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

# 可选:指定 ffmpeg/ffprobe 路径(缺省走系统 PATH)
# FFMPEG_PATH=/usr/bin/ffmpeg
# FFPROBE_PATH=/usr/bin/ffprobe

# 性能调优(可选,缺省按本机硬件自动推导)
# IMAGE_CONCURRENCY=8
# VIDEO_THREADS=8
# VIDEO_PRESET=medium
```

> ⚠️ 生产部署时必须将 ALLOWED_ORIGINS 设置为你的实际访问域名/IP(如 http://your-server-ip:8080),否则浏览器请求会被 CORS 白名单拒绝。

### ⚡ 性能参数(按硬件自动推导)

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_CONCURRENCY` | `min(逻辑核心数 / 2, 8)` | 图片批处理并发数(1~32)。Sharp 单张图内部已多线程，并发过高会超订 CPU/内存 |
| `VIDEO_THREADS` | `min(逻辑核心数 / 2, 12)` | x264 编码线程数(1~32)；视频保持串行转码，避免多任务争抢 IO |
| `VIDEO_PRESET` | `medium` | x264 preset，越慢体积越小(与历史行为一致) |

> 💡 查看实际生效值:`curl http://localhost:3000/api/health`(返回 `performance` 段)。内存紧张时可把 `IMAGE_CONCURRENCY` 调低(如 4)，吞吐损失很小。

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
- **🚫 上传被拒绝**: 常见原因是扩展名不在白名单、内容与扩展名不符(如脚本改名成图片)、超过大小限制(图片 50MB / 视频单文件 3GB)、或视频文件不含视频流；页面上会逐条给出拒绝理由
- **🐢 处理很慢或内存吃紧**: 用 `IMAGE_CONCURRENCY` 调整图片并发(默认取逻辑核心一半且不超过 8)；视频为串行转码，单个大文件本身就会吃满 CPU/磁盘 IO
- **⏹️ 想中止处理**: 处理页点「停止处理」会弹出页面内确认框；图片可立即中断，视频需等当前文件转码结束后生效
- **🖼️ 图片能显示但缩略图 404**: 该文件可能是在中止处理时留下的，重新处理一次即可

## 🔌 API 一览

所有接口前缀为 `/api`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查(版本、内存、生效的并发配置) |
| GET | `/photos` / `/videos` | 已处理媒体列表(含静态资源 URL) |
| GET | `/list-images` / `/list-videos` | 待处理原始文件列表 |
| POST | `/upload` | 上传图片/视频(扩展名白名单 + 魔数嗅探审查后入库) |
| POST | `/process-images-batch` | 图片批处理(有界并发，保留原图 + 240×240 缩略图) |
| POST | `/process-images` | 图片批处理·压缩规格(800×600 + 100×100 缩略图，完成后删除原图) |
| POST | `/process-single-image` | 单张图片处理(兼容接口，复制原图 + 240×240 缩略图) |
| POST | `/process-single-video` | 单个视频转码 + 生成缩略图(串行，防并发重复处理) |
| GET | `/video-progress` | 处理进度查询(仅读内存状态，无重计算) |
| POST | `/cancel-processing` | 中止处理(支持图片与视频) |
| GET/POST | `/read-sn` / `/write-sn` | 照片序号读写(批处理序号由后端统一分配) |
| GET/POST | `/read-video-sn` / `/write-video-sn` | 视频序号读写 |
| POST | `/delete-all-original-images` / `/delete-all-original-videos` | 删除原始文件 |

## 🔐 安全说明

- 所有接收文件名的接口先行校验(`backend/src/utils/validate.js`)，路径一律 `path.join()` 构建，防路径遍历
- 上传文件先落系统临时目录，经扩展名白名单 + 内容嗅探审查后才改名进入待处理目录；用户提供的文件名不会用于落盘命名，临时文件无论成败都会清理
- CORS 白名单(`ALLOWED_ORIGINS`)严格生效，非白名单来源返回 403
- 密钥仅通过 `backend/.env` 注入，`.env` 不入库；完整强制规则见 [SECURITY.md](SECURITY.md)

## 📂 项目结构

```text
├── 📱 src/
│   ├── api/            # 统一 API 客户端(client.js)
│   ├── components/     # 复用组件(含 media/PhotoLightbox.vue、media/VideoPlayerModal.vue)
│   ├── composables/    # 处理状态逻辑(useProcessing.js)
│   ├── router/         # 路由定义(/, /photo, /video, /admin/processing)
│   ├── styles/         # 分层样式(components/ layouts/ views/)
│   └── views/          # 页面(HomeView、PhotoView、VideoView、ProcessingView)
├── ⚙️ backend/
│   ├── server.js       # 服务入口(薄封装)
│   ├── src/            # config、utils(sn/validate/sniff/concurrency)、services、routes(含 upload.js)
│   └── test/           # node:test 测试(45 个)
├── 📁 data/            # 处理后媒体、缩略图与序号文件(运行时生成，不入库)
├── 🖼️ public/original/ # 原始媒体目录(待处理)
├── 🧪 scripts/         # check-structure.js、check-ffmpeg.js
├── 🐳 docker-compose.yml
└── 📄 nginx.conf.template
```

> 📝 注: 部署时请替换所有<PROJECT_ROOT>为实际安装路径。
<div align="center"> <p>👨‍👩‍👧‍👦 为您的珍贵家庭回忆提供安全便捷的管理方式 👨‍👩‍👧‍👦</p> </div>
