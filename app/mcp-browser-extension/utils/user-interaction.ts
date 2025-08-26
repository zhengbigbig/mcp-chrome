// 用户交互管理器
export type InteractionType = 'confirmation' | 'input' | 'choice' | 'progress';

export interface UserInteraction {
  id: string;
  type: InteractionType;
  title: string;
  message: string;
  options?: InteractionOption[];
  defaultValue?: string;
  timeout?: number; // 超时时间（毫秒）
}

export interface InteractionOption {
  id: string;
  label: string;
  value: any;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface InteractionResult {
  id: string;
  confirmed: boolean;
  value?: any;
  timedOut: boolean;
  timestamp: number;
}

export type InteractionHandler = (interaction: UserInteraction) => Promise<InteractionResult>;

// 用户交互管理器
export class UserInteractionManager {
  private pendingInteractions = new Map<string, {
    interaction: UserInteraction;
    resolve: (result: InteractionResult) => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }>();

  private interactionHandler?: InteractionHandler;

  setInteractionHandler(handler: InteractionHandler) {
    this.interactionHandler = handler;
  }

  // 请求用户确认
  async requestConfirmation(
    title: string,
    message: string,
    timeout: number = 30000
  ): Promise<boolean> {
    const interaction: UserInteraction = {
      id: this.generateId(),
      type: 'confirmation',
      title,
      message,
      options: [
        { id: 'confirm', label: '确认', value: true, style: 'primary' },
        { id: 'cancel', label: '取消', value: false, style: 'secondary' }
      ],
      timeout,
    };

    const result = await this.requestInteraction(interaction);
    return result.confirmed && result.value === true;
  }

  // 请求用户输入
  async requestInput(
    title: string,
    message: string,
    defaultValue?: string,
    timeout: number = 60000
  ): Promise<string | null> {
    const interaction: UserInteraction = {
      id: this.generateId(),
      type: 'input',
      title,
      message,
      defaultValue,
      timeout,
    };

    const result = await this.requestInteraction(interaction);
    return result.confirmed ? (result.value || null) : null;
  }

  // 请求用户选择
  async requestChoice<T>(
    title: string,
    message: string,
    options: InteractionOption[],
    timeout: number = 30000
  ): Promise<T | null> {
    const interaction: UserInteraction = {
      id: this.generateId(),
      type: 'choice',
      title,
      message,
      options,
      timeout,
    };

    const result = await this.requestInteraction(interaction);
    return result.confirmed ? result.value : null;
  }

  // 显示进度信息
  async showProgress(
    title: string,
    message: string,
    duration: number = 5000
  ): Promise<void> {
    const interaction: UserInteraction = {
      id: this.generateId(),
      type: 'progress',
      title,
      message,
      timeout: duration,
    };

    await this.requestInteraction(interaction);
  }

  // 通用交互请求
  private async requestInteraction(interaction: UserInteraction): Promise<InteractionResult> {
    if (!this.interactionHandler) {
      throw new Error('用户交互处理器未设置');
    }

    return new Promise<InteractionResult>((resolve, reject) => {
      const entry: {
        interaction: UserInteraction;
        resolve: (value: InteractionResult | PromiseLike<InteractionResult>) => void;
        reject: (reason?: any) => void;
        timeoutId?: NodeJS.Timeout;
      } = {
        interaction,
        resolve,
        reject,
      };

      // 设置超时
      if (interaction.timeout && interaction.timeout > 0) {
        entry.timeoutId = setTimeout(() => {
          this.pendingInteractions.delete(interaction.id);
          resolve({
            id: interaction.id,
            confirmed: false,
            timedOut: true,
            timestamp: Date.now(),
          });
        }, interaction.timeout);
      }

      this.pendingInteractions.set(interaction.id, entry);

      // 调用处理器
      this.interactionHandler!(interaction)
        .then(result => {
          const entry = this.pendingInteractions.get(interaction.id);
          if (entry) {
            if (entry.timeoutId) {
              clearTimeout(entry.timeoutId);
            }
            this.pendingInteractions.delete(interaction.id);
            resolve({
              ...result,
              timedOut: false,
              timestamp: Date.now(),
            });
          }
        })
        .catch(error => {
          const entry = this.pendingInteractions.get(interaction.id);
          if (entry) {
            if (entry.timeoutId) {
              clearTimeout(entry.timeoutId);
            }
            this.pendingInteractions.delete(interaction.id);
            reject(error);
          }
        });
    });
  }

  // 取消待处理的交互
  cancelInteraction(id: string): boolean {
    const entry = this.pendingInteractions.get(id);
    if (entry) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      this.pendingInteractions.delete(id);
      entry.resolve({
        id,
        confirmed: false,
        timedOut: false,
        timestamp: Date.now(),
      });
      return true;
    }
    return false;
  }

  // 获取待处理的交互列表
  getPendingInteractions(): UserInteraction[] {
    return Array.from(this.pendingInteractions.values())
      .map(entry => entry.interaction);
  }

  private generateId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建滚动相关的专门交互工具
export class ScrollInteractionManager {
  constructor(private userInteraction: UserInteractionManager) {}

  async confirmScrollStart(direction: string): Promise<boolean> {
    const directionText = {
      up: '向上',
      down: '向下',
      top: '到顶部',
      bottom: '到底部'
    }[direction] || direction;

    return await this.userInteraction.requestConfirmation(
      '页面滚动确认',
      `即将${directionText}滚动页面，是否确认执行？`,
      15000
    );
  }

  async confirmScrollStop(): Promise<boolean> {
    return await this.userInteraction.requestConfirmation(
      '停止滚动确认',
      '是否确认停止页面滚动？',
      10000
    );
  }

  async showScrollProgress(direction: string): Promise<void> {
    const directionText = {
      up: '向上',
      down: '向下',
      top: '到顶部',
      bottom: '到底部'
    }[direction] || direction;

    await this.userInteraction.showProgress(
      '正在滚动',
      `页面正在${directionText}滚动...`,
      2000
    );
  }

  async requestScrollDuration(): Promise<number | null> {
    const input = await this.userInteraction.requestInput(
      '滚动时长设置',
      '请输入滚动监控时长（秒）:',
      '5',
      30000
    );

    if (input) {
      const duration = parseInt(input);
      return isNaN(duration) ? null : duration;
    }
    return null;
  }

  async selectScrollSpeed(): Promise<'slow' | 'normal' | 'fast' | null> {
    return await this.userInteraction.requestChoice(
      '滚动速度选择',
      '请选择滚动速度:',
      [
        { id: 'slow', label: '慢速', value: 'slow' },
        { id: 'normal', label: '正常', value: 'normal', style: 'primary' },
        { id: 'fast', label: '快速', value: 'fast' }
      ],
      20000
    );
  }
}


