# 家庭照片与视频网站

这是一个使用 Vue.js 构建的家庭照片与视频网站应用。该应用允许用户查看和管理家庭照片和视频。

# 网站展视 [http://home.szgody.site](http://home.szgody.site)

## 项目结构

```plaintext
home-photo-vue/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── server.js
└── public/
    ├── images/
    │   ├── original/    # 原始图片
    │   └── processed/   # 处理后的图片
    └── videos/
        ├── original/    # 原始视频
        └── processed/   # 处理后的视频
```

- `public/index.html`: 应用的主 HTML 文件，作为 Vue 应用的入口点。
- `src/assets/styles/main.css`: 应用的主要样式文件。
- `src/components/AppHeader.vue`: 应用的头部组件，包括导航链接。
- `src/components/PhotoGrid.vue`: 显示照片网格的组件，获取并渲染最新照片。
- `src/components/VideoGrid.vue`: 显示视频网格的组件，获取并渲染最新视频。
- `src/views/HomeView.vue`: 主页视图组件，包含 `AppHeader`、`PhotoGrid` 和 `VideoGrid` 组件。
- `src/views/PhotoView.vue`: 专门用于显示照片详细视图的视图组件。
- `src/views/VideoView.vue`: 专门用于显示视频详细视图的视图组件。
- `src/router/index.js`: 设置 Vue Router 的文件，定义应用的路由，包括主页、照片和视频视图的路径。
- `src/App.vue`: Vue 应用的根组件，包含路由视图和主要布局。
- `src/main.js`: Vue 应用的入口文件，创建 Vue 实例并初始化路由。
- `.gitignore`: 指定应被 Git 忽略的文件和目录。
- `package.json`: 包含项目的元数据，包括依赖项、脚本和项目配置。
- `vite.config.js`: 包含 Vite 的配置，Vite 是用于该项目的构建工具。



## 安装与运行

1. 克隆该项目：
   ```bash
   git clone https://github.com/szgody/homePhotosVideos.git
   ```

2. 进入项目目录：
   ```bash
   cd home-photo-vue
   ```

3. 安装依赖：
   ```bash
   npm install
   ```

4. 运行开发服务器：
   ```bash
   npm run dev
   ```
