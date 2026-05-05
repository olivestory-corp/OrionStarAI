/**
 * Vertex AI API Client
 * Vertex AI API 客户端
 *
 * Handles communication with Google Cloud Vertex AI API
 * 处理与 Google Cloud Vertex AI API 的通信
 */

import { GoogleAuth } from 'google-auth-library';
import { UnifiedChatRequest, VertexCredentials, UnifiedChatResponse } from '../types.js';

export class VertexClient {

  /**
   * Send chat request to Vertex AI API
   * 发送聊天请求到 Vertex AI API
   *
   * Supports both Claude and Gemini models
   * 支持 Claude 和 Gemini 模型
   */
  async chat(request: UnifiedChatRequest, credentials: VertexCredentials, location: string = 'us-central1'): Promise<Response> {
    const projectId = credentials.project_id;
    const model = request.model;

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to generate Vertex AI access token');
    }

    // Claude models use 'anthropic' publisher with rawPredict/streamRawPredict
    // Gemini models use 'google' publisher with generateContent/streamGenerateContent
    // Both now available in global region
    // Claude 模型使用 'anthropic' 发布者与 rawPredict/streamRawPredict
    // Gemini 模型使用 'google' 发布者与 generateContent/streamGenerateContent
    // 现在都在 global 区域可用
    const isClaude = model.toLowerCase().includes('claude');
    const publisher = isClaude ? 'anthropic' : 'google';
    const domain = location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;
    const method = isClaude
      ? (request.stream ? 'streamRawPredict' : 'rawPredict')
      : (request.stream ? 'streamGenerateContent' : 'generateContent');
    // Gemini streaming requires ?alt=sse parameter
    // Gemini 流式请求需要 ?alt=sse 参数
    const sseParam = (!isClaude && request.stream) ? '?alt=sse' : '';
    const url = `${domain}/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}:${method}${sseParam}`;

    // Vertex API expects the exact body structure of UnifiedChatRequest (Google format)
    // We just need to ensure systemInstruction is handled if it's in the request
    // The request body from client is expected to be already in Google format.
    // Vertex API 需要 UnifiedChatRequest 的确切结构（Google 格式）
    // 我们只需要确保 systemInstruction 被处理（如果在请求中）
    // 来自客户端的请求体应该已经是 Google 格式

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.token}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    } catch (error) {
      console.error('[Vertex] Request failed:', error);
      throw error;
    }
  }
}