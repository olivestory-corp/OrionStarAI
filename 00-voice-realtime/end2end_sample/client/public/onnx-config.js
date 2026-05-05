// ONNX Runtime Web 配置
// 使用 CDN 加载 WASM 文件以减小 build 体积

const ONNX_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

window.onnxWasmConfig = {
  wasmPaths: ONNX_CDN,
  numThreads: 1,
  simd: true
};

// 调试信息
console.log('[ONNX Config] WASM CDN:', ONNX_CDN);
