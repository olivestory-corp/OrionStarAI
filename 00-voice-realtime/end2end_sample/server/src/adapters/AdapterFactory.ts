import { BaseModelAdapter } from './BaseModelAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';

/**
 * 模型适配器工厂
 * 负责创建不同类型的模型适配器实例
 */
export class AdapterFactory {
  /**
   * 创建模型适配器
   * @param modelType 模型类型 ('openai')
   * @param clientId 客户端 ID
   * @returns 模型适配器实例
   */
  static create(modelType: 'openai', clientId: string): BaseModelAdapter {
    switch (modelType) {
      case 'openai':
        console.log(`[AdapterFactory] 创建 OpenAI 适配器: ${clientId}`);
        return new OpenAIAdapter(clientId);

      default:
        throw new Error(`不支持的模型类型: ${modelType}`);
    }
  }
}
