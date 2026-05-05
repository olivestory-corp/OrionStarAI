# Gemini Live API 后端服务器

## 功能
- WebSocket 服务器，接收客户端的音频数据
- 转发音频到 Gemini Live API
- 返回 Gemini 的语音响应给客户端

## 安装

```bash
npm install
```

## 配置

复制 `.env.example` 为 `.env` 并填入你的 Gemini API Key:

```bash
cp .env.example .env
```

编辑 `.env`:
```
GEMINI_API_KEY=your_actual_api_key_here
PORT=8080
```

## 运行

### 开发模式
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm start
```

## WebSocket 协议

### 客户端 → 服务器

#### 1. 初始化连接
```json
{
  "type": "setup",
  "config": {
    "model": "models/gemini-2.0-flash-exp",
    "systemInstruction": "你是一个语音助手",
    "temperature": 0.7
  }
}
```

#### 2. 发送音频数据
```json
{
  "realtimeInput": {
    "mediaChunks": [{
      "mimeType": "audio/pcm;rate=16000",
      "data": "base64-encoded-pcm-data"
    }]
  }
}
```

### 服务器 → 客户端

#### 1. 连接就绪
```json
{
  "type": "ready",
  "message": "Gemini 连接成功"
}
```

#### 2. 音频响应
```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [{
        "inlineData": {
          "mimeType": "audio/pcm;rate=24000",
          "data": "base64-encoded-pcm-data"
        }
      }]
    }
  }
}
```

#### 3. 错误消息
```json
{
  "type": "error",
  "error": "错误描述"
}
```

## 端口
- WebSocket: `ws://localhost:8080`
- HTTP 健康检查: `http://localhost:8080/health`
