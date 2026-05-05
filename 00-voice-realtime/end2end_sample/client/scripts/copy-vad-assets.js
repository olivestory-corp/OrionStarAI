const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..');
const rootDir = path.join(clientDir, '..');

// 支持 workspaces：优先检查本地 node_modules，否则检查根目录
function findNodeModulesPath(subPath) {
  const localPath = path.join(clientDir, 'node_modules', subPath);
  const rootPath = path.join(rootDir, 'node_modules', subPath);
  if (fs.existsSync(localPath)) return localPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

const vadDistPath = findNodeModulesPath(path.join('@ricky0123', 'vad-web', 'dist'));

const publicPath = path.join(clientDir, 'public');
const buildPath = path.join(clientDir, 'build');

console.log('📦 复制 VAD 资源文件...');
console.log('💡 ONNX Runtime WASM 文件从 CDN 加载，不再本地复制');

// 确保目标目录存在
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}

// 复制 VAD 相关文件到 public（开发和生产）
// 注意：silero_vad 模型仍需本地，因为 vad-web 库需要
const filesToCopyToPublic = [
  'vad.worklet.bundle.min.js',
  'silero_vad_legacy.onnx',
  'silero_vad_v5.onnx',
];

if (vadDistPath) {
  filesToCopyToPublic.forEach(file => {
    const src = path.join(vadDistPath, file);
    const dest = path.join(publicPath, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✅ 复制 ${file} 到 public/`);
    } else {
      console.warn(`⚠️ 找不到 ${file}`);
    }
  });
} else {
  console.warn('⚠️ 找不到 @ricky0123/vad-web 包');
}

// 复制 audio-stream-processor.js 到 build 目录（生产环境）
if (fs.existsSync(buildPath)) {
  const audioWorkletSrc = path.join(publicPath, 'audio-stream-processor.js');
  const audioWorkletDest = path.join(buildPath, 'audio-stream-processor.js');

  if (fs.existsSync(audioWorkletSrc)) {
    try {
      fs.copyFileSync(audioWorkletSrc, audioWorkletDest);
      console.log('✅ 复制 audio-stream-processor.js 到 build/');
    } catch (err) {
      console.warn(`⚠️ 复制 audio-stream-processor.js 失败: ${err.message}`);
    }
  }
}

// ONNX Runtime WASM 文件现在从 CDN 加载 (cdn.jsdelivr.net)
// 不再需要本地复制，大幅减小 build 体积 (~60MB)

console.log('✨ VAD 资源文件复制完成!');