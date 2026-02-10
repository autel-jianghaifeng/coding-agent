export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | AIContentBlock[];
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls: AIToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export interface StreamCallbacks {
  onText: (text: string) => void;
}

export interface AIProvider {
  chat(messages: AIMessage[], systemPrompt: string): Promise<AIResponse>;
  streamChat(messages: AIMessage[], systemPrompt: string, callbacks: StreamCallbacks): Promise<AIResponse>;
}
