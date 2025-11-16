import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "../../constants";
/**
 * 说明所有工具使用共通事项的提示词
 * 鉴于AI编写代码的能力实际上比按照固定格式调用工具的能力更强
 * 这里我们设法为它提供代码执行能力而不是直接解析工具调用
 * @returns 
 */
export function getSharedToolUseSection(): string {
	return `====

工具使用

你可以且仅可以使用如下介绍的代码块调用javascript工具。
任何你不能够仅仅通过文字回复完成的任务都可以使用javascript完成.
你必须尽最大的努力***真实地***完成任务,任何模拟或者虚假的数据都是不可原谅的
任何查询类任务绝对禁止使用任何模拟数据

# 工具使用格式

工具使用采用带有ial的代码块格式。在代码块中可以书写任意JavaScript代码。结构如下：

\`\`\`${JAVASCRIPT_TOOLS_CLASS}
// 在这里编写JavaScript代码,注意使用**正确的ESM语法****
// 可以引入任何你想要引入的库
// 可以调用任何可用的函数,这些函数你也可以通过js检查环境去发现
// 例如：
const result = fn(param1, param2);
export default {result,memo:""};
\`\`\`

在javascript代码块中，你可以：
- 编写任意JavaScript代码
- 调用系统提供的工具函数
- 处理数据和逻辑
- 返回结果
使用"export default" 导出的内容将会在工具代码执行完成之后返回给你
返回值中的memo字段是必须的,如果你的代码成功运行且对用户有用,它将被用于查询这些代码
当调用工具时,始终寄使用${JAVASCRIPT_TOOLS_CLASS}或者${JAVASCRIPT_TOOLS_WAIT_CLASS}作为代码块语言标识，以确保正确解析和执行。

`
}
export function getDifferentOfToolsSection():string{
	return `# 工具代码块类型选择指南

## ${JAVASCRIPT_TOOLS_WAIT_CLASS} 与 ${JAVASCRIPT_TOOLS_CLASS} 的区别

### 使用 ${JAVASCRIPT_TOOLS_WAIT_CLASS} 的情况：
当需要等待工具调用结果并基于结果继续操作时，使用 \`${JAVASCRIPT_TOOLS_WAIT_CLASS}\`：

适用场景：
- 需要根据工具返回的结果进行判断或后续处理
- 工具调用结果影响下一步操作
- 需要获取数据并进行处理
- 文件读取、网络请求等需要返回数据的操作

### 使用 ${JAVASCRIPT_TOOLS_CLASS} 的情况：
当不需要等待工具调用结果，或者工具调用是独立的、不需要基于结果进行后续操作时，使用 \`${JAVASCRIPT_TOOLS_CLASS}\`：

适用场景：
- 工具调用是独立的，不需要基于结果进行后续操作
- 执行多个不相关的工具调用
- 只需要触发操作而不关心结果
- 批量执行相似操作

注意事项:
异步工具调用之后记得告知用户你做了什么

## 选择原则
- 如果下一步操作依赖于当前工具的结果,例如查询内容之后根据内容回答 → 使用 \`${JAVASCRIPT_TOOLS_WAIT_CLASS}\`
- 如果工具调用是独立的或只需要触发操作,例如提醒或者仅仅记录 → 使用 \`${JAVASCRIPT_TOOLS_CLASS}\`
`
}


