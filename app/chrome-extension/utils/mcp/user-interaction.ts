// 用户交互处理 - 支持确认和选择机制

export interface UserInteraction {
  id: string;
  type: 'confirmation' | 'selection' | 'input';
  message: string;
  options?: string[];
  data?: any;
  timeout?: number; // 超时时间（毫秒）
}

export interface InteractionResult {
  id: string;
  confirmed: boolean;
  selectedOption?: string;
  userInput?: string;
  data?: any;
}

export class UserInteractionManager {
  private pendingInteractions = new Map<string, {
    interaction: UserInteraction;
    resolve: (result: InteractionResult) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }>();

  /**
   * 创建用户交互
   */
  async createInteraction(interaction: UserInteraction): Promise<InteractionResult> {
    return new Promise((resolve, reject) => {
      // 设置超时
      let timeout: NodeJS.Timeout | undefined;
      if (interaction.timeout) {
        timeout = setTimeout(() => {
          this.pendingInteractions.delete(interaction.id);
          reject(new Error(`交互超时: ${interaction.id}`));
        }, interaction.timeout);
      }

      // 存储待处理的交互
      this.pendingInteractions.set(interaction.id, {
        interaction,
        resolve,
        reject,
        timeout
      });
    });
  }

  /**
   * 响应用户交互
   */
  respondToInteraction(id: string, result: Omit<InteractionResult, 'id'>): boolean {
    const pending = this.pendingInteractions.get(id);
    if (!pending) {
      console.warn(`[UserInteractionManager] 未找到待处理的交互: ${id}`);
      return false;
    }

    // 清理超时
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // 移除待处理状态
    this.pendingInteractions.delete(id);

    // 返回结果
    pending.resolve({
      id,
      ...result
    });

    return true;
  }

  /**
   * 取消交互
   */
  cancelInteraction(id: string): boolean {
    const pending = this.pendingInteractions.get(id);
    if (!pending) {
      return false;
    }

    // 清理超时
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // 移除待处理状态
    this.pendingInteractions.delete(id);

    // 拒绝Promise
    pending.reject(new Error(`交互被取消: ${id}`));

    return true;
  }

  /**
   * 获取所有待处理的交互
   */
  getPendingInteractions(): UserInteraction[] {
    return Array.from(this.pendingInteractions.values()).map(p => p.interaction);
  }

  /**
   * 清理所有待处理的交互
   */
  clearAllInteractions(): void {
    for (const [id] of this.pendingInteractions) {
      this.cancelInteraction(id);
    }
  }
}

// 导出单例实例
export const userInteractionManager = new UserInteractionManager();