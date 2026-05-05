# Gemini 语音助手 - 前端

## 功能
- 按住按钮录音 (Push-to-Talk)
- 实时采集 16kHz PCM 音频
- WebSocket 连接到后端服务器
- 播放 24kHz PCM 音频响应
- Material Design UI

## 技术栈
- React + TypeScript
- Bootstrap 5
- Web Audio API
- AudioWorklet (实时音频处理)

## 安装

```bash
npm install
```

## 运行

### 开发模式
```bash
npm start
```

应用会在 http://localhost:3000 启动

### 生产构建
```bash
npm run build
```

## 使用说明

1. **连接服务器**
   - 点击"连接服务器"按钮
   - 等待 Gemini 初始化完成

2. **开始对话**
   - 按住麦克风按钮说话
   - 松开按钮停止录音
   - 等待 AI 语音回复

3. **注意事项**
   - 首次使用需要授予麦克风权限
   - 确保后端服务器已启动 (ws://localhost:8080)
   - 建议使用 Chrome 90+ 浏览器

## 音频处理流程

```
用户说话
  ↓
麦克风捕获 (Web Audio API)
  ↓
AudioWorklet 实时处理
  ↓
重采样到 16kHz
  ↓
Float32 → Int16 PCM
  ↓
Base64 编码
  ↓
WebSocket 发送
  ↓
接收 24kHz PCM 响应
  ↓
Base64 解码 → Int16 → Float32
  ↓
AudioContext 播放
```

## 配置

### WebSocket URL
修改 `src/App.tsx` 中的 `WS_URL` 常量:

```typescript
const WS_URL = 'ws://localhost:8080';
```

### 采样率
- 录音: 16kHz (Gemini 输入要求)
- 播放: 24kHz (Gemini 输出格式)

## 浏览器兼容性

- Chrome 90+
- Edge 90+
- Safari 14.1+
- Firefox 89+

## 故障排除

### 麦克风权限问题
- 确保浏览器已授予麦克风权限
- 检查操作系统麦克风设置

### WebSocket 连接失败
- 确认后端服务器正在运行
- 检查防火墙设置
- 查看浏览器控制台错误信息

### 没有声音
- 检查系统音量设置
- 确认浏览器未静音
- 查看控制台是否有音频解码错误
