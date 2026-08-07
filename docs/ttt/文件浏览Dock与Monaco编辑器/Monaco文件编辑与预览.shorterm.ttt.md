# Monaco 文件编辑与预览 (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目标**: 将参考插件的编辑与预览行为落到 S-Forge 现有页签/编辑器体系，保持来源、权限、保存和差异状态可审计。

## 编辑模型

- `local`：工作空间或 Agent capability 文件，可写时提供保存/自动保存；只读时只读模型。
- `network`：网络文本仅查看，按响应语言/Content-Type 识别语言，不隐式写回。
- `block`：复用 Lute 与块 API，支持 markdown/kramdown、嵌入块反转义、叶子块保存和差异。
- `snippet`、`inbox`、`history`、`snapshot`：按参考插件 handler 语义建立统一原始/修改模型；历史和快照默认只读，明确可写时才创建 update function。

## Monaco 能力

- 语言识别、编码选择、折行方案、tabSize、自动保存、Ctrl+S、Alt+Z、编辑方案、Markdown 补全、KaTeX 辅助和差异编辑器。
- 编辑器页签/预览页签、脏状态、并发外部修改、保存失败、超大文件和取消加载状态。
- Vditor 作为 Markdown 默认编辑器时复用现有资源上传/路径策略，避免复制参考插件的旧运行时桥接。

## 致谢与许可

产品文档和源代码入口固定标注 `Zuoqiu-Yingyi/siyuan-plugin-monaco-editor` 与 `Microsoft Monaco Editor` 的链接、版本和许可证；任何改编代码保留原始版权/许可证头。

## 完成条件

- [ ] 参考覆盖矩阵每一项都有模型、UI、失败状态和测试证据。
- [ ] 工作空间/Agent 文件编辑不绕过后端 capability；历史/网络/只读模型不显示可写动作。
- [ ] 参考插件仓库只读，S-Forge 不留下临时 iframe/旧 API 兼容层。
