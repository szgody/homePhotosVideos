const { exec } = require('child_process');
const path = require('path');

// 检查 FFmpeg 安装
function checkFFmpeg() {
    console.log('检查 FFmpeg 安装状态...');
    
    exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
            console.error('FFmpeg 未安装或未添加到 PATH:', error);
            return;
        }
        console.log('FFmpeg 已安装:', stdout.split('\n')[0]);
    });

    exec('ffprobe -version', (error, stdout, stderr) => {
        if (error) {
            console.error('FFprobe 未安装或未添加到 PATH:', error);
            return;
        }
        console.log('FFprobe 已安装:', stdout.split('\n')[0]);
    });
}

checkFFmpeg();