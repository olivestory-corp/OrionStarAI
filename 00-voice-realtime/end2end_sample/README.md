# AgentOS 2 Live - Real-time Voice Assistant

## 🚀 Overview

**AgentOS 2 Live** is a high-performance, low-latency real-time voice assistant platform built with **OpenAI Realtime API**. It provides an end-to-end solution for building stateful AI assistants with voice-to-voice capabilities, integrated Voice Activity Detection (VAD), and a modular tool-calling system.

This project is structured as a **Monorepo** using npm workspaces, containing both the frontend client and the backend orchestration server.

### Core Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Architecture** | Monorepo (npm workspaces) |
| **Frontend** | React, TypeScript, Tailwind CSS, Web Audio API, VAD (Voice Activity Detection), Opus Codec |
| **Backend** | Node.js, TypeScript, Express, WebSocket |
| **AI Model** | OpenAI Realtime API (GPT-4o Realtime) |
| **Communication** | WebSocket with a unified protocol for type safety |

## 📂 Project Structure

| Directory | Description |
| :--- | :--- |
| `client/` | **Frontend**: React application featuring the AgentSDK, VAD integration, and real-time UI components like the Robot Face. |
| `server/` | **Backend**: Node.js service managing WebSocket connections, OpenAI Realtime API orchestration, and static file serving. |
| `shared/` | **Shared**: Common TypeScript types and the communication protocol used by both client and server. |
| `e2e_android/` | **Android**: A WebView bridge project for OrionStar robots, exposing hardware capabilities (navigation, sensors) to the web frontend. |

### Key Features

- **Low Latency**: Direct voice-to-voice interaction using OpenAI's Realtime protocol.
- **Robot Face UI**: An interactive, animated robot face that reacts to user and assistant speech.
- **Built-in Scenes**:
  - **Face Register**: A specialized scene for face enrollment and identity recognition.
  - **Advice 3C**: An IT & Electronics shopping assistant scenario.
- **Robot Hardware Integration**: Includes an Android WebView bridge (`e2e_android`) to control OrionStar robot hardware (navigation, head movement, etc.) directly from the web application.
- **AgentSDK**: A robust client-side SDK that handles audio streaming, VAD, and tool execution.

## 🛠️ Getting Started

### 1. Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **OpenAI API Key**: An active key with access to the Realtime API.

### 2. Installation

Clone the repository and install dependencies from the root directory:

```bash
npm install
```

> The `postinstall` script will automatically copy necessary VAD assets to the client's public directory.

### 3. Configuration

Create a `.env` file in the **root directory** of the project:

```ini
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=8081

# SSL Mode (Optional, set to true if using HTTPS/WSS)
USE_SSL=false
```

### 4. Running the Project

#### Development Mode
Start both the client and server concurrently with hot-reloading:

```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8081

#### Production Mode
Build the project and start the server:

```bash
# Build both client and server
npm run build

# Start the production server
node server/dist/index.js
```

## 📱 Android Deployment (OrionStar Robots)

To run the assistant on an OrionStar robot with hardware control:

### 1. Prerequisites
- **Android Studio** installed on your development machine.
- **RobotService SDK**: Obtain `robotservice_xx.jar` from the robot system and place it in `e2e_android/app/libs/`.

### 2. Build and Install
1. Open the `e2e_android` folder in Android Studio.
2. Sync the project with Gradle files.
3. Connect your robot via USB (ensure ADB is enabled).
4. Click **Run** in Android Studio to install the app on the robot.
5. Grant all requested permissions (Camera, Microphone, etc.) on the first launch.

### 3. Configuration
By default, the app loads `http://localhost:3000`. To point it to your deployed server:
- Modify `DEFAULT_URL` in `e2e_android/app/src/main/java/com/e2e/orionstar/MainActivity.kt`.
- Or pass the URL via an Intent when starting the activity.

## 🔌 AgentSDK Usage

The `AgentSDK` simplifies the complexity of real-time voice interaction:

```typescript
import { AgentSDK } from './sdk';

const agent = new AgentSDK({
  modelType: 'openai',
  systemPrompt: 'You are a helpful assistant.',
  voice: 'alloy',
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: { type: 'object', properties: { location: { type: 'string' } } }
    }
  ],
});

agent.on('ready', () => console.log('Assistant is ready!'));
agent.on('text_output', ({ text }) => console.log('AI:', text));
agent.on('tool_call', (toolCall) => {
  console.log('Executing tool:', toolCall.name);
  // Handle tool execution...
});

await agent.initialize();
agent.connect();
```

## 📋 License

This project is for demonstration and testing purposes. Please ensure you comply with OpenAI's usage policies when deploying.
