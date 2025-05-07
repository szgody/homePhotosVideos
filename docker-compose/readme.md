# Docker Compose 部署指南：家庭照片与视频管理系统

本文档详细说明如何使用 Docker Compose 快速部署家庭媒体管理系统。

## 项目简介

家庭照片与视频网站是一个基于 Vue.js 构建的媒体管理系统，便于整理、浏览和共享个人照片与视频。

## 主要功能

- **媒体管理**: 照片视频上传、浏览、分类与显示
- **自动处理**: 批量处理媒体、生成缩略图和唯一序号
- **任务控制**: 监控处理进度、支持中止任务
- **系统监控**: 存储状态检查、资源告警
- **响应式UI**: 适配桌面与移动设备

## 系统要求

- Docker Engine 19.03+
- Docker Compose 1.27+
- 至少 1GB RAM 和 5GB 磁盘空间
- 互联网连接（用于拉取镜像）

## 快速部署

### 1. 下载配置文件

```bash
# 克隆仓库或下载 docker-compose 目录
git clone https://github.com/szgody/homePhotosVideos.git
cd homePhotosVideos/docker-compose

# 或者直接下载配置文件
wget https://raw.githubusercontent.com/szgody/homePhotosVideos/main/docker-compose/docker-compose.yml
```

### 2. 创建必要的目录结构

```bash
mkdir -p data/photos data/videos data/photo_thumbnails data/video_thumbnails
mkdir -p public/original/images public/original/videos
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问应用

打开浏览器访问：http://localhost:8080

## 配置说明

### Docker Compose 文件解析

```yaml
version: '3.8'

services:
  frontend:
    image: szgody/homephotosvideos:frontend-1.0  # 前端容器
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    image: szgody/homephotosvideos:backend-1.0   # 后端容器
    environment:
      - NODE_ENV=production                      # 运行模式
      - PORT=3000                                # 内部端口
      - DATA_DIR=/app/data                       # 数据目录
      - PUBLIC_DIR=/app/public                   # 公共资源目录
      - BASE_URL=                                # 基础URL（可留空）
      - PHOTOS_PATH=/photos                      # 照片访问路径
      - VIDEO_THUMBNAILS_PATH=/video_thumbnails  # 视频缩略图路径
      - PHOTO_THUMBNAILS_PATH=/photo_thumbnails  # 照片缩略图路径
      - VIDEOS_PATH=/videos                      # 视频访问路径
      - ALLOWED_ORIGINS=http://localhost:8080,*  # CORS 配置
      - ORIGINAL_VIDEOS_PATH=/app/public/original/videos     # 原始视频目录
      - ORIGINAL_IMAGES_PATH=/app/public/original/images     # 原始图片目录
    volumes:
      - ./data:/app/data       # 处理后的媒体文件存储
      - ./public:/app/public   # 原始媒体文件存储
    restart: unless-stopped

  nginx:
    image: szgody/homephotosvideos:nginx-1.0    # Nginx 代理容器
    ports:
      - "8080:80"              # 将容器80端口映射到主机8080端口  
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

### 环境变量说明

| 环境变量 | 默认值 | 描述 |
|---------|-------|------|
| NODE_ENV | production | 运行环境 |
| PORT | 3000 | 后端服务内部端口 |
| DATA_DIR | /app/data | 处理后媒体存储路径 |
| PUBLIC_DIR | /app/public | 原始媒体存储路径 |
| PHOTOS_PATH | /photos | 照片访问URL路径 |
| VIDEO_THUMBNAILS_PATH | /video_thumbnails | 视频缩略图URL路径 |
| PHOTO_THUMBNAILS_PATH | /photo_thumbnails | 照片缩略图URL路径 |
| VIDEOS_PATH | /videos | 视频访问URL路径 |
| ALLOWED_ORIGINS | http://localhost:8080,* | CORS 允许的来源 |

### 数据目录结构

```
./data/
  ├── photos/            # 处理后的图片
  ├── videos/            # 处理后的视频
  ├── photo_thumbnails/  # 图片缩略图
  └── video_thumbnails/  # 视频缩略图

./public/
  └── original/
      ├── images/        # 原始图片
      └── videos/        # 原始视频
```

## 使用方法

### 上传媒体:

- 通过网页界面上传照片和视频
- 或直接将文件复制到 images 或 videos 目录

### 处理媒体:

- 在网页界面点击"处理图片"或"处理视频"按钮
- 批量处理会自动生成缩略图和唯一序号

### 浏览媒体:

- 点击各个分类查看不同类型的媒体
- 支持缩略图预览和全屏查看

## 高级配置

### 修改端口

如果需要更改默认端口，编辑 docker-compose.yml 文件：

```yaml
nginx:
  ports:
    - "自定义端口:80"
```

### 外部存储挂载

如果要使用外部存储，可以修改卷映射：

```yaml
volumes:
  - /外部路径/data:/app/data
  - /外部路径/public:/app/public
```

### 设置基础URL

如果应用部署在反向代理后的子路径，可设置BASE_URL环境变量：

```yaml
backend:
  environment:
    - BASE_URL=/media-app
```

## 常见问题

### 容器无法启动

检查 Docker 日志以获取详细错误信息：
```bash
docker-compose logs
```

### 无法上传或处理媒体

确保目录权限正确：
```bash
chmod -R 777 ./data ./public
```

### CORS 错误

检查 ALLOWED_ORIGINS 环境变量是否包含您的前端访问域名。

### 媒体处理失败

如果视频处理失败，可能是ffmpeg相关问题：
```bash
# 查看后端日志
docker-compose logs backend
```

## 技术细节

本项目使用了以下技术：

- **前端**: Vue.js 3, Vue Router
- **后端**: Node.js, Express
- **媒体处理**: ffmpeg, Sharp/libvips
- **容器化**: Docker, Docker Compose

## 维护与更新

### 检查容器状态

```bash
docker-compose ps
```

### 更新到最新版本

```bash
docker-compose pull
docker-compose down
docker-compose up -d
```

### 备份数据

定期备份媒体和数据目录：
```bash
tar -czf media-backup-$(date +%Y%m%d).tar.gz ./data ./public