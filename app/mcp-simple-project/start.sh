#!/bin/bash

# MCP Simple Project 启动脚本

echo "🚀 MCP Simple Project 启动脚本"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 npm 依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 npm 依赖..."
    npm install
fi

# 检查 Ollama 服务
echo "🔍 检查 Ollama 服务..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama 服务正常运行"
    
    # 检查模型
    if curl -s http://localhost:11434/api/tags | grep -q "deepseek-r1:1.5b"; then
        echo "✅ deepseek-r1:1.5b 模型已安装"
    else
        echo "⚠️  警告: deepseek-r1:1.5b 模型未安装"
        echo "   安装命令: ollama pull deepseek-r1:1.5b"
    fi
else
    echo "⚠️  警告: Ollama 服务不可用"
    echo "   请确保 Ollama 服务正在运行: ollama serve"
fi

echo ""
echo "🎯 选择启动模式:"
echo "1) 交互式客户端 (推荐)"
echo "2) 仅启动服务器"
echo "3) 测试 Ollama 连接"
echo "4) 查看帮助"

read -p "请选择 (1-4): " choice

case $choice in
    1)
        echo "🚀 启动交互式客户端..."
        npm run client
        ;;
    2)
        echo "🚀 启动 MCP 服务器..."
        npm run server
        ;;
    3)
        echo "🧪 测试 Ollama 连接..."
        npm run test-ollama
        ;;
    4)
        echo "📖 显示帮助信息..."
        npm run dev help
        ;;
    *)
        echo "❌ 无效选择，启动默认模式..."
        npm run client
        ;;
esac
