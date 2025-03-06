// 导入 Vue Router 相关函数 Import Vue Router related functions
import { createRouter, createWebHistory } from 'vue-router'

// 导入视图组件 Import view components
import HomeView from '../views/HomeView.vue'          // 首页视图 Home view
import PhotoView from '../views/PhotoView.vue'        // 照片视图 Photo view
import VideoView from '../views/VideoView.vue'        // 视频视图 Video view
import ProcessingView from '../views/Processing_Background.vue'  // 处理视图 Processing view

// 创建路由实例 Create router instance
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView // 或者您原有的首页组件
  },
  {
    path: '/photo',         // 照片页面路径 Photo page path
    name: 'photo',          // 照片页面名称 Photo page name
    component: PhotoView    // 照片页面组件 Photo page component
  },
  {
    path: '/video',         // 视频页面路径 Video page path
    name: 'video',          // 视频页面名称 Video page name
    component: VideoView    // 视频页面组件 Video page component
  },
  {
    path: '/admin/processing',  // 后台处理页面路径 Processing page path
    name: 'processing',         // 处理页面名称 Processing page name
    component: ProcessingView   // 处理页面组件 Processing page component
  },
  // 修改通配符路由
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'  // 改为重定向到首页
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 导出路由实例 Export router instance
export default router