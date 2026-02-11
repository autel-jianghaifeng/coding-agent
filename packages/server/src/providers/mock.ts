import type { AIProvider, AIMessage, AIResponse, StreamCallbacks, AIProviderOptions } from './provider.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let callCount = 0;

async function streamText(text: string, callbacks: StreamCallbacks): Promise<void> {
  // Simulate streaming by emitting chunks of ~3-5 chars with small delays
  let i = 0;
  while (i < text.length) {
    const chunkSize = 3 + Math.floor(Math.random() * 3);
    const chunk = text.slice(i, i + chunkSize);
    callbacks.onText(chunk);
    i += chunkSize;
    await delay(20 + Math.floor(Math.random() * 30));
  }
}

function getPlanResponse(): AIResponse {
  return {
    content: `### 分析\n用户需要创建项目结构。\n\n### 计划\n1. [STEP:create-dir:src] 创建源代码目录\n2. [STEP:write-file:src/index.ts] 创建主入口文件\n3. [STEP:write-file:package.json] 创建项目配置`,
    toolCalls: [],
    stopReason: 'end_turn',
  };
}

function getResponse(messages: AIMessage[]): AIResponse {
  callCount++;

  // First call: return a plan with tool calls
  if (callCount % 3 === 1) {
    return {
      content: "I'll help you with that. Let me start by setting up the project structure.",
      toolCalls: [
        {
          id: `mock_tool_${callCount}_1`,
          name: 'create-dir',
          input: { path: 'src' },
        },
        {
          id: `mock_tool_${callCount}_2`,
          name: 'write-file',
          input: {
            path: 'src/index.ts',
            content: `// Main entry point\nconsole.log("Hello from the coding agent!");\n\nexport function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n`,
          },
        },
      ],
      stopReason: 'tool_use',
    };
  }

  // Second call: more tool calls
  if (callCount % 3 === 2) {
    return {
      content: "Now let me create a configuration file and a README.",
      toolCalls: [
        {
          id: `mock_tool_${callCount}_1`,
          name: 'write-file',
          input: {
            path: 'package.json',
            content: JSON.stringify(
              {
                name: 'my-project',
                version: '1.0.0',
                type: 'module',
                main: 'src/index.ts',
                scripts: {
                  start: 'ts-node src/index.ts',
                  build: 'tsc',
                },
              },
              null,
              2,
            ) + '\n',
          },
        },
        {
          id: `mock_tool_${callCount}_2`,
          name: 'write-file',
          input: {
            path: 'README.md',
            content: `# My Project\n\nA sample project created by the coding agent.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`,
          },
        },
      ],
      stopReason: 'tool_use',
    };
  }

  // Third call: summary, no more tools
  return {
    content: `I've completed the task. Here's what I did:\n\n1. Created the \`src/\` directory\n2. Created \`src/index.ts\` with a greeting function\n3. Created \`package.json\` with project configuration\n4. Created \`README.md\` with documentation\n\nThe project is ready to use! You can run \`npm start\` to execute it.`,
    toolCalls: [],
    stopReason: 'end_turn',
  };
}

export class MockProvider implements AIProvider {
  async chat(messages: AIMessage[], _systemPrompt: string, _options?: AIProviderOptions): Promise<AIResponse> {
    if (_options?.disableTools) {
      const response = getPlanResponse();
      await delay(600);
      return response;
    }
    const response = getResponse(messages);
    await delay(600);
    return response;
  }

  async streamChat(messages: AIMessage[], _systemPrompt: string, callbacks: StreamCallbacks, _options?: AIProviderOptions): Promise<AIResponse> {
    if (_options?.disableTools) {
      const response = getPlanResponse();
      if (response.content) {
        await streamText(response.content, callbacks);
      }
      return response;
    }
    const response = getResponse(messages);
    // Simulate streaming the text content
    if (response.content) {
      await streamText(response.content, callbacks);
    }
    return response;
  }
}
