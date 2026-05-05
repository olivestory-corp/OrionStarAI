#!/bin/bash

# 生成自签名 SSL 证书用于局域网开发
# 用于解决 getUserMedia 需要 HTTPS 的问题，以及支持 WSS

echo "📜 生成自签名 SSL 证书..."
echo ""

# 获取本机 IP
if [[ "$OSTYPE" == "darwin"* ]]; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
else
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "检测到本机 IP: $LOCAL_IP"
echo ""

# 创建 ssl 目录
mkdir -p ssl

# 生成私钥
echo "1️⃣ 生成私钥..."
openssl genrsa -out ssl/localhost.key 2048

# 生成证书签名请求配置
echo "2️⃣ 生成证书配置..."
cat > ssl/localhost.conf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=CN
ST=Beijing
L=Beijing
O=Development
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.local
IP.1 = 127.0.0.1
IP.2 = $LOCAL_IP
IP.3 = 192.168.1.1
IP.4 = 192.168.0.1
IP.5 = 10.0.0.1
EOF

# 生成证书
echo "3️⃣ 生成证书..."
openssl req -new -x509 -nodes \
  -key ssl/localhost.key \
  -out ssl/localhost.crt \
  -days 365 \
  -config ssl/localhost.conf \
  -extensions v3_req

echo ""
echo "=========================================="
echo "✅ SSL 证书已生成"
echo "=========================================="
echo "私钥: ssl/localhost.key"
echo "证书: ssl/localhost.crt"
echo ""
echo "证书包含的地址:"
echo "  - localhost"
echo "  - 127.0.0.1"
echo "  - $LOCAL_IP (当前IP)"
echo ""
echo "=========================================="
echo "📱 使用方法"
echo "=========================================="
echo ""
echo "1️⃣ 信任证书（可选，但推荐）"
echo ""
echo "   macOS:"
echo "   - 双击 ssl/localhost.crt"
echo "   - 添加到钥匙串"
echo "   - 双击证书 -> 信任 -> 始终信任"
echo ""
echo "   Windows:"
echo "   - 双击 ssl/localhost.crt"
echo "   - 安装证书 -> 受信任的根证书颁发机构"
echo ""
echo "2️⃣ 重启后端服务"
echo "   cd server && npm run build && npm start"
echo ""
echo "3️⃣ 后端会自动启用 HTTPS 和 WSS"
echo "   HTTP:  http://localhost:8081"
echo "   HTTPS: https://localhost:8082"
echo "   WS:    ws://localhost:8081"
echo "   WSS:   wss://localhost:8082"
echo ""
echo "=========================================="
echo "🌐 前端配置"
echo "=========================================="
echo ""
echo "前端会自动检测，无需配置！"
echo ""
echo "如果前端使用 HTTPS，可以连接到:"
echo "  - HTTP 后端 (http://localhost:8081)"
echo "  - HTTPS 后端 (https://localhost:8082)"
echo "  - WS (ws://localhost:8081)"
echo "  - WSS (wss://localhost:8082)"
echo ""
echo "=========================================="
