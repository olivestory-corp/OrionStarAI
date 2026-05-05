<div align="center">

# 🚀 DeepV Code Server

### **Lightweight AI Proxy Server**

*Empowering developers, accelerating innovation*

<br>

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853D.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

<br>

**English** | [简体中文](./README.zh.md)

<br>

</div>

---

# DeepV Code Server (deepx-mini-server)

> ⭐ **If this project is helpful to you, please consider giving it a star!** This helps us understand the value of our work and motivates continued development.
>
> 🍴 **Want to contribute?** We welcome forks and pull requests! Feel free to submit improvements, bug fixes, or new features.

---

## 💡 Enterprise-Grade API KEY Solution

If you don't have an API Key, please contact us for enterprise cloud solutions. We are **Google Cloud Certified Partners**, providing cost-effective enterprise-grade API KEYs, including:
- Claude Series
- Gemini Series
- OpenAI
- Other Open-Source LLMs

**📞 Contact Us**: [http://cmcm.bot/](http://cmcm.bot/)
**📖 Learn More**: [https://www.polymericcloud.com/](https://www.polymericcloud.com/)

---

This is a foundational service project for the [**DeepV Code Client**](https://github.com/OrionStarAI/DeepVCode), serving as a lightweight AI proxy server that supports **Vertex AI** and **OpenRouter**.

## Project Overview

This project aims to provide a unified AI interface access layer for DeepV Code Client, handling authentication, request forwarding, and response format conversion for different AI providers (such as Google Vertex AI and OpenRouter).

### Key Features

- **Multi-Provider Support**: Integrated with Google Vertex AI and OpenRouter.
- **Unified Interface**: Provides a unified chat interface supporting both streaming and non-streaming responses.
- **Format Conversion**: Automatically converts responses from different providers into a unified Google AI format.
- **Mock Authentication**: Built-in Mock JWT login interface for convenient development and testing.

## Security Recommendations

Before submitting or publishing code, ensure the following information is properly handled:

1. **Environment Variables**: `.env` file is already in `.gitignore`, make sure not to commit it.
2. **Credential Files**: All JSON credential files in the `key/` directory are already in `.gitignore`.
3. **Debug Logs**: Recommend adding `.deepvcode/` directory to `.gitignore` as it contains detailed request and response logs (potentially containing API Keys or sensitive data).
4. **Mock Data**: The `deepvlab-login` interface in `src/routes.ts` contains hardcoded test email and avatar information, recommend cleaning or anonymizing as needed.

## Quick Start

### Requirements

- Node.js (v18+ recommended)
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Configure Environment

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file with the necessary configuration:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key.
   - `VERTEX_CREDENTIALS_PATHS`: Path to Vertex AI service account JSON file.
   - `GOOGLE_API_KEY`: (Optional) Google API key.

### Start the Project

#### Development Mode (with hot reload)

```bash
npm run dev
```

#### Debug Mode (with verbose logging)

```bash
npm run dev:debug
```

#### Production Mode

**Method 1: Direct Start (Simple but not recommended)**

```bash
npm run build
npm run start:prod
```

**Method 2: PM2 Process Manager (Recommended)**

PM2 provides auto-restart, log management, process monitoring, and other production-level features.

First, globally install PM2:
```bash
npm install -g pm2
```

Then start the application:
```bash
npm run pm2:start        # Start application (auto-compile + start)
pm2 monit               # Monitor application status and performance
npm run pm2:logs        # View real-time logs
npm run pm2:restart     # Restart application (requires recompilation)
npm run pm2:reload      # Graceful restart (zero-downtime)
pm2 kill                # Stop all applications
npm run pm2:delete      # Stop and delete application
```

Enable auto-start on system boot:
```bash
npm run pm2:startup     # Configure auto-start on boot
pm2 save               # Save current configuration
```

**Method 3: Docker Containerization (Best Practice)**

Docker ensures consistency and isolation in production environments.

Build image:
```bash
docker build -t deepx-mini-server:latest .
```

Start with docker-compose (recommended):
```bash
docker-compose up -d        # Start in background
docker-compose logs -f      # View logs
docker-compose ps          # Check container status
docker-compose stop        # Stop service
docker-compose down        # Stop and remove containers
```

Or run Docker container directly:
```bash
docker run -d \
  --name deepx-mini-server \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e OPENROUTER_API_KEY=your_key_here \
  -v ./key:/app/key:ro \
  -v ./logs:/app/logs \
  --restart unless-stopped \
  deepx-mini-server:latest
```

**Method 4: Systemd Service (Native Linux Solution)**

Copy `deepx-mini-server.service` to systemd directory:

```bash
sudo cp deepx-mini-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable deepx-mini-server    # Enable auto-start on boot
sudo systemctl start deepx-mini-server     # Start service
sudo systemctl status deepx-mini-server    # Check status
sudo journalctl -u deepx-mini-server -f    # View logs
```

## Client Connection

### Configure Proxy Server Address

Depending on your client type, follow these steps to configure the proxy server address:

#### DeepV Code CLI (Command Line Tool)

1. Locate the `.deepv/` folder in your user home directory:
   - **macOS**: `~/.deepv/settings.json` or `/Users/your-username/.deepv/settings.json`
   - **Windows**: `C:\Users\your-username\.deepv\settings.json`

2. Open the `settings.json` file

3. Add or modify the `customProxyServerUrl` configuration, for example:
   ```json
   {
     "customProxyServerUrl": "http://localhost:3001"
   }
   ```

4. **Restart CLI** to apply the configuration

#### DeepV Code for VSCode (VSCode Extension)

1. Open VSCode extension settings
2. Search for `Custom Proxy Server Url`
3. Enter the proxy server address, for example:
   ```
   http://localhost:3001
   ```
4. **Restart VSCode** to apply the configuration

**Server Address Examples:**
- Local development: `http://localhost:3001`
- Remote server: `https://your-server-domain.com`

## API Documentation

- **POST `/v1/chat/messages`**: Unified chat interface.
- **POST `/v1/chat/stream`**: Unified streaming chat interface.
- **POST `/auth/jwt/deepvlab-login`**: Mock login interface, returns test JWT token.
- **GET `/health`**: Health check endpoint.

## Production Deployment Best Practices

### Choose the Right Deployment Method

| Method | Scenario | Advantages | Disadvantages |
|--------|----------|-----------|---------------|
| PM2 | Single machine | Simple to use, auto-restart, log management | No horizontal scaling |
| Docker + docker-compose | Development/small production | Good consistency, easy to scale | Requires Docker knowledge |
| Kubernetes | Large-scale production | High availability, auto-scaling, load balancing | Steep learning curve, complex config |
| Systemd | Linux native | System-level, good resource isolation | Linux only, limited features |

### Recommended Method Order

1. **Small scale & Single machine** → PM2
2. **Medium scale & Need consistency** → Docker Compose
3. **Large scale & High availability** → Kubernetes
4. **Linux system preferred** → Systemd

### Performance Optimization Tips

```bash
# 1. Enable cluster mode (utilize multi-core CPUs)
# Already configured as 'cluster' mode in ecosystem.config.cjs

# 2. Set reasonable number of processes
# instances: 4 for small business use

# 3. Use reverse proxy (Nginx) for static resources and load balancing
# Recommended configuration in nginx.conf.example

# 4. Configure memory limits to prevent memory leaks
# max_memory_restart: '1G' auto-restarts when exceeding 1GB

# 5. Enable gzip compression (configure at reverse proxy layer)
```

### Monitoring and Alerting

Use PM2 Plus (paid but worth it):
```bash
pm2 link  # Link to PM2 Plus Dashboard
```

Or use open-source solutions:
```bash
# Monitor process status
pm2 monit

# Export logs for analysis
pm2 save
pm2 logs --lines 1000 > server.log
```

### Environment Variable Management

**Production Environment Sensitive Information:**

Never hardcode sensitive information in code, use environment variables:

```bash
# .env.production (don't commit to Git)
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
OPENROUTER_API_KEY=sk-xxxxx
VERTEX_CREDENTIALS_PATHS=/opt/deepx-mini-server/key/creds.json
CORS_ORIGIN=https://yourdomain.com
```

When using docker-compose, reference the `.env` file:
```bash
docker-compose --env-file .env.production up -d
```

## Tech Stack

- **Express**: Web framework.
- **TypeScript**: Programming language.
- **tsx**: Development runtime tool.
- **Google Auth Library**: Google Cloud authentication.
- **PM2**: Production-grade process manager.
- **Docker**: Container deployment.
