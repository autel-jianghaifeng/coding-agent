import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { tools } from '../agent/tools/index.js';
import type { AIProvider, AIMessage, AIResponse, AIToolCall, StreamCallbacks } from './provider.js';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  private getAnthropicTools(): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, val]) => [
            key,
            { type: val.type, description: val.description },
          ]),
        ),
        required: Object.entries(t.parameters)
          .filter(([, val]) => val.required)
          .map(([key]) => key),
      },
    }));
  }

  private buildMessages(messages: AIMessage[]) {
    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  async chat(messages: AIMessage[], systemPrompt: string): Promise<AIResponse> {
    console.log('[LLM Request] chat() called');
    console.log('[LLM Request] messages:', JSON.stringify(messages, null, 2));
    console.log('[LLM Request] systemPrompt:', systemPrompt);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      tools: this.getAnthropicTools(),
      messages: this.buildMessages(messages),
    });

    let textContent = '';
    const toolCalls: AIToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    console.log('[LLM Response] chat() result');
    console.log('[LLM Response] content:', textContent);
    console.log('[LLM Response] toolCalls:', JSON.stringify(toolCalls, null, 2));
    console.log('[LLM Response] stopReason:', response.stop_reason);

    return {
      content: textContent,
      toolCalls,
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }

  async streamChat(messages: AIMessage[], systemPrompt: string, callbacks: StreamCallbacks): Promise<AIResponse> {
    console.log('[LLM Request] streamChat() called');
    console.log('[LLM Request] messages:', JSON.stringify(messages, null, 2));
    console.log('[LLM Request] systemPrompt:', systemPrompt);

    const stream = this.client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      tools: this.getAnthropicTools(),
      messages: this.buildMessages(messages),
    });

    stream.on('text', (text) => {
      callbacks.onText(text);
    });

    const finalMessage = await stream.finalMessage();

    let textContent = '';
    const toolCalls: AIToolCall[] = [];

    for (const block of finalMessage.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    console.log('[LLM Response] streamChat() result');
    console.log('[LLM Response] content:', textContent);
    console.log('[LLM Response] toolCalls:', JSON.stringify(toolCalls, null, 2));
    console.log('[LLM Response] stopReason:', finalMessage.stop_reason);

    return {
      content: textContent,
      toolCalls,
      stopReason: finalMessage.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }
}
