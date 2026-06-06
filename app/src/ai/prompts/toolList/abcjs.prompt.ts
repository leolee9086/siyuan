/**
 * 导出 getAbcjsSection 供提示词构建器拼接使用。
 * 说明ABCJS乐谱创建的提示词
 * @同步豁免: 性能考虑 - 纯字符串返回函数，异步化会引入不必要的 Promise 开销且调用方在模板字符串中同步拼接。
 * @显式返回类型原因: 固定返回常量字符串，显式标注便于调用方在模板字面量中直接使用。
 */
export function getAbcjsSection(): string {
	return `## ABCJS 乐谱创建

使用 abc 代码块可以创建音乐乐谱。支持标准 ABC 记谱法语法：

\`\`\`abc
X:1
T:简单民谣
M:4/4
L:1/8
Q:1/4=120
K:C
C D E F | G A B c | c B A G | F E D C |
\`\`\`

乐谱将在文档中自动渲染显示，支持音符点击播放。
`;
}