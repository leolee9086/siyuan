import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "../../constants.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
/**
 * 构建可用工具函数列表提示词 - 使用官方MCP SDK类型
 * @param client MCP客户端实例
 * @returns 格式化的工具列表提示词
 */
export async function buildToolListPromptFromClient(toolsetName: string, client: Client){
  try {
    // 使用MCP客户端获取工具列表
    const toolsResult = await client.listTools();
    const rawTools = toolsResult.tools;
    const tools: Tool[] = Array.isArray(rawTools) ? rawTools : [];
    return buildToolListPromptFromDefines(toolsetName, tools);
  } catch (error) {
    console.error("获取工具列表失败:", error);
    return "";
  }
}

export function buildToolListPromptFromDefines(toolsetName: string, tools: Tool[]) {
  let prompt = `# 工具集${toolsetName}的详细工具列表`;
  prompt += "\n## 详细工具说明\n\n";
  // 添加每个工具的详细说明
  let index = 0;
  for (const tool of tools) {
    prompt += `### ${++index}. ${tool.name}\n\n`;
    prompt += JSON.stringify(tool);
    prompt += "\n";
  }

  prompt += `## 使用规范

1. **代码块要求**: 所有工具调用必须在 \`${JAVASCRIPT_TOOLS_CLASS}\` 或 \`${JAVASCRIPT_TOOLS_WAIT_CLASS}\` 代码块中进行
2. **参数验证**: 确保提供所有必需的参数，参数类型必须匹配定义
3. **错误处理**: 工具调用可能失败，请准备好处理异常情况
4. **结果处理**: 根据工具返回的结果决定下一步操作
5. **类型安全**: 严格遵守参数的类型定义，避免类型错误

## 工具调用方式


使用 callTool 函数
\`\`\`${JAVASCRIPT_TOOLS_CLASS}
const result = await callTool('${toolsetName}', 'toolName', {
  param1: value1,
  param2: value2
});
\`\`\`

**callTool 函数说明**:
- 第一个参数：工具集ID (字符串)
- 第二个参数：工具名称 (字符串)
- 第三个参数：输入参数对象
- 返回值：工具执行结果对象

`;
  return prompt;
}
