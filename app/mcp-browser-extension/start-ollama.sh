#!/bin/bash

# 启动 Ollama 服务并配置 CORS
echo "🚀 启动 Ollama 服务 (支持 CORS)..."

# 停止现有的 Ollama 进程
echo "停止现有的 Ollama 进程..."
pkill ollama 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 设置环境变量并启动 Ollama
echo "设置 CORS 环境变量: OLLAMA_ORIGINS=\"*\""
export OLLAMA_ORIGINS="*"

echo "启动 Ollama 服务..."
ollama serve &

# 等待服务启动
sleep 3

# 检查服务状态
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama 服务启动成功 (支持 CORS)"
    echo "🔗 服务地址: http://localhost:11434"
    echo "📋 可用模型:"
    curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "  (需要安装 jq 来显示模型列表)"
else
    echo "❌ Ollama 服务启动失败"
    exit 1
fi

echo ""
echo "💡 提示："
echo "  - 现在可以在浏览器插件中访问 Ollama"
echo "  - 如需停止服务：pkill ollama"
echo "  - 如需安装模型：ollama pull deepseek-r1:1.5b"
