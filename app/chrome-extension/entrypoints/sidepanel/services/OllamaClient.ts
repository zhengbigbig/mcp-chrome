export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'deepseek-r1:1.5b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * 测试与Ollama服务器的连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error('Ollama连接测试失败:', error);
      return false;
    }
  }

  /**
   * 检查指定模型是否可用
   */
  async isModelAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = await response.json();
      return data.models?.some((model: any) => model.name === this.model) || false;
    } catch (error) {
      console.error('检查模型可用性失败:', error);
      return false;
    }
  }

  /**
   * 拉取模型（如果不存在）
   */
  async pullModel(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(`拉取模型失败: ${response.statusText}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status === 'success') {
              return true;
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }

      return true;
    } catch (error) {
      console.error('拉取模型失败:', error);
      return false;
    }
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      // 检查模型是否可用
      const modelAvailable = await this.isModelAvailable();
      if (!modelAvailable) {
        console.log('模型不可用，正在拉取...');
        const pullSuccess = await this.pullModel();
        if (!pullSuccess) {
          throw new Error('无法拉取模型');
        }
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false, // 不使用流式响应以简化处理
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama请求失败: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.message?.content || '抱歉，我无法生成回复。';
    } catch (error) {
      console.error('Ollama聊天请求失败:', error);
      throw error;
    }
  }

  /**
   * 发送流式聊天请求
   */
  async chatStream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama流式请求失败: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data: OllamaResponse = JSON.parse(line);
            if (data.message?.content) {
              onChunk(data.message.content);
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    } catch (error) {
      console.error('Ollama流式聊天请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return [];
    }
  }

  /**
   * 设置使用的模型
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * 获取当前使用的模型
   */
  getModel(): string {
    return this.model;
  }
}
