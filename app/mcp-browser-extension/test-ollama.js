// 测试 Ollama 连接的独立脚本

async function testOllama() {
  console.log('🧪 测试 Ollama 连接...\n');

  try {
    // 测试服务状态
    console.log('1. 检查 Ollama 服务状态...');
    const healthResponse = await fetch('http://localhost:11434/api/tags');
    
    if (!healthResponse.ok) {
      throw new Error(`HTTP ${healthResponse.status}: ${healthResponse.statusText}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Ollama 服务正常运行');
    console.log(`📋 发现 ${healthData.models.length} 个模型:`);
    healthData.models.forEach(model => {
      console.log(`   - ${model.name} (${model.details.parameter_size})`);
    });

    // 检查 deepseek 模型
    const hasDeepseek = healthData.models.some(m => m.name === 'deepseek-r1:1.5b');
    if (hasDeepseek) {
      console.log('✅ deepseek-r1:1.5b 模型可用');
    } else {
      console.log('❌ deepseek-r1:1.5b 模型未找到');
      console.log('💡 请运行: ollama pull deepseek-r1:1.5b');
      return;
    }

    // 测试生成
    console.log('\n2. 测试模型生成...');
    const generateResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1:1.5b',
        prompt: '你好，请简单介绍一下你自己。',
        stream: false,
      }),
    });

    if (!generateResponse.ok) {
      throw new Error(`Generate API failed: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    console.log('✅ 模型生成成功');
    console.log('🤖 模型响应:', generateData.response);

    console.log('\n🎉 Ollama 连接测试完成，一切正常！');
    
  } catch (error) {
    console.error('❌ Ollama 测试失败:', error.message);
    console.log('\n🔧 排查建议:');
    console.log('1. 确保 Ollama 服务运行: ollama serve');
    console.log('2. 检查端口是否被占用: lsof -i:11434');
    console.log('3. 安装模型: ollama pull deepseek-r1:1.5b');
    console.log('4. 检查防火墙设置');
  }
}

// 运行测试
testOllama();
