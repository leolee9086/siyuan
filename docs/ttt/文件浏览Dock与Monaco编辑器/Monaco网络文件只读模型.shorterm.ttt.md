# Monaco 网络文件只读模型（TikTocTak）

> 归属：[`文件浏览Dock与Monaco编辑器.ttt.md`](../文件浏览Dock与Monaco编辑器.ttt.md)
> 本切片只负责网络文本资源的读取模型和只读页签，不把网络 URI 伪装为本地授权根，也不增加保存回写入口。

## 参考证据

- 参考仓库：`D:\dev\.references\siyuan-plugin-monaco-editor`
- 语义基线：`edce237dab4ef807be3b8647087543bcb87d1ca7`
- 入口：`src/handlers/network.ts`
- 关键行为：`GET` 请求；URL 有扩展名时优先使用扩展名；无扩展名时使用响应 `Content-Type`；非成功 HTTP 响应抛出 `statusText`。
- 许可证/致谢：GNU Affero General Public License v3 or later；产品实现同时致谢
  `https://github.com/Zuoqiu-Yingyi/siyuan-plugin-monaco-editor` 和
  `https://github.com/microsoft/monaco-editor`。

## 已实现

- [x] `FileBrowser.network.ts` 建立独立只读模型：URI、名称、文本、语言、Content-Type、字节大小和 `readOnly: true`。
- [x] 只允许 HTTP/HTTPS；GET 请求显式传递取消信号；HTTP、请求、取消、解码和超限错误均使用稳定错误码。
- [x] 默认 8 MiB、硬上限 32 MiB；Content-Length 超限在读取正文前失败，正文大小超限也显式失败。
- [x] `FileBrowserNetworkPanel.vue` 使用官方 Monaco 动态加载器创建只读模型；没有保存、自动保存或 Electron 默认应用入口。
- [x] `sforge-file-network` 页签注册和 `createFileBrowserNetworkOpener` 打开端口接入现有 TabRegistry。

## 验证

- [x] `app/test/sforge/fileBrowser/FileBrowser.network.test.ts`：GET/扩展名优先、Content-Type 语言识别、HTTP 失败、大小限制、取消和 URI 校验，5 个用例通过。
- [x] `FileBrowser.open.test.ts`：网络资源页签只携带 URI 和名称，未携带本地绝对路径；`FileBrowserNetworkPanel.interaction.test.ts` 覆盖只读 Monaco 挂载和显式重试，2 个用例通过。
- [x] `pnpm run typecheck:protyle-contract` 通过。
- [x] `vue-tsc` 输出中的新增网络模块无诊断；仓库仍有既有 P0 以上基线诊断，按父 TTT 约束不在本切片扩散处理。

## 未完成边界

- [ ] 参考插件的网络资源入口菜单、页签恢复和完整语言服务尚未覆盖。
- [ ] 真实桌面窗口中的跨域策略、代理和大响应滚动尚未取得现场证据；模型测试不替代桌面验收。
- [ ] 本切片不代表 Explorer 菜单、块/历史/快照、Vditor、差异模型或设置功能已完成。

## 状态

进行中：网络只读模型和基础页签已落地，完整 Monaco 功能矩阵仍按父 TTT 的 M4 里程碑推进。
