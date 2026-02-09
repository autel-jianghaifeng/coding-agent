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

    return {
      content: textContent,
      toolCalls,
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }

  async streamChat(messages: AIMessage[], systemPrompt: string, callbacks: StreamCallbacks): Promise<AIResponse> {
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

    return {
      content: textContent,
      toolCalls,
      stopReason: finalMessage.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }
}
