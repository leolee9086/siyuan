# Monaco 本地文件读写契约（TikTocTak）

> 归属：[`文件浏览Dock与Monaco编辑器.ttt.md`](../文件浏览Dock与Monaco编辑器.ttt.md)
> 本切片只冻结后端本地文本读写边界，不把编辑器界面或 Monaco 依赖标记为完成。

## 参考来源

- 行为参考：`Zuoqiu-Yingyi/siyuan-plugin-monaco-editor`
  (`https://github.com/Zuoqiu-Yingyi/siyuan-plugin-monaco-editor`)，基线提交
  `edce237dab4ef807be3b8647087543bcb87d1ca7`，重点为 `src/handlers/local.ts` 的本地文件读取/保存契约。
- 编辑器实现参考：`Microsoft Monaco Editor`
  (`https://github.com/microsoft/monaco-editor`)；本切片不复制其代码，仅冻结模型字段和保存行为。

## 冻结契约

| 字段 | 约束 |
| --- | --- |
| `rootID` | 只接受文件浏览器已授权根 ID，不能传绝对路径 |
| `path` | 只接受根相对普通文件路径，禁止越界、符号链接和目录 |
| `revision` | 读取时由原始文件字节计算；保存时必须与当前文件一致 |
| `encoding` | `utf-8`、`utf-8-bom`、`utf-16le`、`utf-16be`；非法或二进制内容拒绝 |
| `readOnly` | 从根及子挂载 capability 推导；只读范围不返回可写能力 |

## 后端行为

- 读取有界；默认最多 8 MiB，服务端硬上限 32 MiB，超限返回明确错误而不是截断编辑文档。
- UTF-8/UTF-16 BOM 识别后向前端返回规范化文本和编码；写回时保留编码和普通文件权限。
- 保存前检查 root capability、文件类型、`expectedRevision` 和编码后的字节上限。
- 保存使用 `kernel/fswalk` 的同根校验和原子替换；冲突不覆盖外部修改，返回当前 revision。
- 领域层只声明根相对入口和结果，绝对路径、句柄、临时文件和具体编码 I/O 留在 `fswalk`。

## 验收

- [ ] `fswalk` UTF-8/UTF-8 BOM/UTF-16LE/UTF-16BE 读取与原子写回测试。
- [ ] 文件越界、符号链接、只读挂载、目录、二进制、超限和 revision 冲突测试。
- [ ] `/api/s-forge/file-browser/editor/read` 与 `/editor/write` 包络和错误映射测试。
- [ ] 前端仓储只传 `{rootID, path, revision, encoding}`，不暴露绝对路径或 `os.File`。
- [ ] Monaco 页签接入前再补 Ctrl+S、只读显示、脏状态和真实桌面验收。

## 状态

进行中：先完成深层 `fswalk` 和 Kernel API，编辑器依赖与 UI 另列后续切片。
