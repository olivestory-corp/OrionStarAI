/**
 * Google Generative AI Format Types
 * Google Generative AI 格式类型定义
 */

export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface Content {
  role: 'user' | 'model' | 'system'; // 'system' is sometimes used in internal mapping, though Gemini uses systemInstruction
  parts: Part[];
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  candidateCount?: number;
  responseMimeType?: string;
}

export interface UnifiedChatRequest {
  model: string;
  contents: Content[];
  tools?: any[];
  toolConfig?: any;
  safetySettings?: any[];
  systemInstruction?: Content | { parts: Part[] };
  generationConfig?: GenerationConfig;
  stream?: boolean;
}

export interface Candidate {
  content: Content;
  finishReason?: string;
  index?: number;
  safetyRatings?: any[];
  citationMetadata?: any;
}

export interface UnifiedChatResponse {
  candidates?: Candidate[];
  promptFeedback?: any;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Vertex AI Credentials
 * Vertex AI 凭证
 */
export interface VertexCredentials {
  project_id: string;
  private_key: string;
  client_email: string;
  [key: string]: any;
}