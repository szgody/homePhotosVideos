const fs = require('fs');
const path = require('path');

const checkStructure = () => {
    const frontendPath = process.cwd();
    const backendPath = path.join(frontendPath, 'backend');
    
    console.log('前端目录:', frontendPath);
    console.log('后端目录:', backendPath);
    
    // 检查后端入口文件
    const appFile = path.join(backendPath, 'app.js');
    if (fs.existsSync(appFile)) {
        console.log('✅ 后端入口文件存在');
    } else {
        console.log('❌ 后端入口文件不存在');
    }
};

checkStructure();