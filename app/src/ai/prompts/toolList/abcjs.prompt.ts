/**
 * 说明ABCJS乐谱创建的提示词
 * @returns 
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

ABCJS 乐谱特点：
- 标准 ABC 音乐记谱语法
- 自动渲染为交互式乐谱
- 支持多种音乐记号和符号
- 适用于简谱和复杂乐谱

乐谱将在文档中自动渲染显示，支持音符点击播放。
`;
}