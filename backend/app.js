const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// 中间件配置
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use('/videos', express.static(path.join(__dirname, '../data/videos')));
app.use('/photos', express.static(path.join(__dirname, '../data/photos')));
app.use('/thumbnails', express.static(path.join(__dirname, '../data/thumbnails')));

// 路由配置
app.use('/api/photos', require('./routes/photos'));
app.use('/api/videos', require('./routes/videos'));

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});