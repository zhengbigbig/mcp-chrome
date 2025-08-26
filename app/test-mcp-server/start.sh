#!/bin/bash

# 测试 MCP Server 启动脚本

echo "🚀 启动测试 MCP Server..."

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动服务器
echo "🔄 启动服务器..."
npm start
