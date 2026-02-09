export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls: AIToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
}

export interface StreamCallbacks {
  onText: (text: string) => void;
}

export interface AIProvider {
  chat(messages: AIMessage[], systemPrompt: string): Promise<AIResponse>;
  streamChat(messages: AIMessage[], systemPrompt: string, callbacks: StreamCallbacks): Promise<AIResponse>;
}
