import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { tools } from '../agent/tools/index.js';
import type { AIProvider, AIMessage, AIResponse, AIToolCall, StreamCallbacks, AIProviderOptions } from './provider.js';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  private buildSystemPrompt(systemPrompt: string, enableCaching: boolean): Anthropic.TextBlockParam[] {
    const block: Anthropic.TextBlockParam = { type: 'text', text: systemPrompt };
    if (enableCaching) {
      (block as any).cache_control = { type: 'ephemeral' };
    }
    return [block];
  }

  private getAnthropicTools(enableCaching: boolean = false): Anthropic.Tool[] {
    const result = tools.map((t) => ({
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
    if (enableCaching && result.length > 0) {
      (result[result.length - 1] as any).cache_control = { type: 'ephemeral' };
    }
    return result;
  }

  private buildMessages(messages: AIMessage[], enableCaching: boolean = false): Anthropic.MessageParam[] {
    // Deep-clone content block arrays so adding cache_control doesn't mutate the originals
    const result = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string'
        ? m.content
        : (m.content as any[]).map((block: any) => {
            const { cache_control, ...rest } = block;
            return rest;
          }),
    })) as Anthropic.MessageParam[];

    if (enableCaching && result.length >= 2) {
      // Find the second-to-last user message and add cache_control to its last content block
      for (let i = result.length - 2; i >= 0; i--) {
        if (result[i].role === 'user' && Array.isArray(result[i].content)) {
          const blocks = result[i].content as any[];
          if (blocks.length > 0) {
            blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
          }
          break;
        }
      }
    }

    return result;
  }

  async chat(messages: AIMessage[], systemPrompt: string, options?: AIProviderOptions): Promise<AIResponse> {
    const enableCaching = options?.enableCaching ?? false;
    const disableTools = options?.disableTools ?? false;
    console.log('[LLM Request] chat() called (caching: %s, disableTools: %s)', enableCaching, disableTools);
    console.log('[LLM Request] messages:', JSON.stringify(messages, null, 2));
    console.log('[LLM Request] systemPrompt:', systemPrompt);

    const params: Anthropic.MessageCreateParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: enableCaching ? this.buildSystemPrompt(systemPrompt, true) : systemPrompt,
      messages: this.buildMessages(messages, enableCaching),
    };
    if (!disableTools) {
      params.tools = this.getAnthropicTools(enableCaching);
    }

    const response = await this.client.messages.create(params);

    let textContent = '';
    const toolCalls: AIToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    console.log('[LLM Response] chat() result');
    console.log('[LLM Response] content:', textContent);
    console.log('[LLM Response] toolCalls:', JSON.stringify(toolCalls, null, 2));
    console.log('[LLM Response] stopReason:', response.stop_reason);
    if (enableCaching) {
      const usage = response.usage as any;
      console.log('[LLM Cache] creation: %d, read: %d', usage.cache_creation_input_tokens ?? 0, usage.cache_read_input_tokens ?? 0);
    }

    return {
      content: textContent,
      toolCalls,
      stopReason: this.mapStopReason(response.stop_reason),
    };
  }

  async streamChat(messages: AIMessage[], systemPrompt: string, callbacks: StreamCallbacks, options?: AIProviderOptions): Promise<AIResponse> {
    const enableCaching = options?.enableCaching ?? false;
    const disableTools = options?.disableTools ?? false;
    console.log('[LLM Request] streamChat() called (caching: %s, disableTools: %s)', enableCaching, disableTools);
    console.log('[LLM Request] messages:', JSON.stringify(messages, null, 2));
    console.log('[LLM Request] systemPrompt:', systemPrompt);

    const streamParams: Anthropic.MessageCreateParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: enableCaching ? this.buildSystemPrompt(systemPrompt, true) : systemPrompt,
      messages: this.buildMessages(messages, enableCaching),
    };
    if (!disableTools) {
      streamParams.tools = this.getAnthropicTools(enableCaching);
    }

    const stream = this.client.messages.stream(streamParams);

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
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    console.log('[LLM Response] streamChat() result');
    console.log('[LLM Response] content:', textContent);
    console.log('[LLM Response] toolCalls:', JSON.stringify(toolCalls, null, 2));
    console.log('[LLM Response] stopReason:', finalMessage.stop_reason);
    if (enableCaching) {
      const usage = finalMessage.usage as any;
      console.log('[LLM Cache] creation: %d, read: %d', usage.cache_creation_input_tokens ?? 0, usage.cache_read_input_tokens ?? 0);
    }

    return {
      content: textContent,
      toolCalls,
      stopReason: this.mapStopReason(finalMessage.stop_reason),
    };
  }

  private mapStopReason(reason: string | null): AIResponse['stopReason'] {
    switch (reason) {
      case 'tool_use': return 'tool_use';
      case 'max_tokens': return 'max_tokens';
      case 'stop_sequence': return 'stop_sequence';
      default: return 'end_turn';
    }
  }
}
