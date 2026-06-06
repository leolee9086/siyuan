/**
 * 导出 getAbcjsSection 供提示词构建器拼接使用。
 * 说明ABCJS乐谱创建的提示词
 * @同步豁免: 生命周期 - 作为同步字符串流水线的一环，在 getPublicPrompts 的模板字面量中被同步调用，异步化会导致整个调用链都需要改为 await。
 */
export function getAbcjsSection() {
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