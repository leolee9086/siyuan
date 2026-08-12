# 常见文件服务 provider 适配（TikTocTak）

> **状态**：进行中（2026-08-12）；本文件记录可复用契约、真实入口和验证证据，不把接口声明当作功能完成。父任务：[`文件浏览Dock与Monaco编辑器.ttt.md`](../文件浏览Dock与Monaco编辑器.ttt.md)

## 本轮确认的真实资源

- `windows-smb-mount` 在当前 Windows 登录会话中枚举 `N:` 与 `O:`，其远端名称分别为 `\\192.168.31.195\视频素材` 与 `\\192.168.31.195\工作文件`；它们在该 SMB session 下是两个独立 resource。
- SMB 和 DSM File Station HTTP 是两个独立 provider。通用层没有二者是否访问同一设备的概念；即使所有展示字段相同，也不建立跨 provider 关系、归并、去重或联动生命周期。
- SMB 盘符/UNC 入口与 Synology DSM File Station HTTP 入口是两种连接协议：盘符使用 Windows SMB 会话和 share-relative 路径；DSM HTTP 使用 `SYNO.API.Info`、登录 SID 和 `SYNO.FileStation.*` API。不能把盘符路径拼成 DSM API 的 `folder_path`，也不能把 DSM share 伪装成工作空间根。
- 当前 Codex 执行身份看不到用户交互桌面中的 `N:`/`O:` 映射；对两个 UNC 根的只读探测返回访问被拒绝，未尝试挂载、写入、修改凭据或替换用户映射。真实桌面 Forge 进程必须在拥有该 SMB 会话的用户上下文中验证。

## 能力边界与复用

| 入口 | session/resource 边界 | 列表/读取 | 写操作 | 当前实现状态 |
| --- | --- | --- | --- | --- |
| 本地/已挂载 SMB | Windows drive/UNC -> share-relative root | `kernel/filebrowser.Service`、`kernel/fswalk.Walker` 的 root-relative 目录、Stat、Open、Range | 既有 filebrowser create/rename/copy/move/delete，按 root capability 校验 | 已有本地根能力；SMB 会话发现、断线重连、Change Notify 和真实盘符现场验收待补 |
| Synology File Station HTTP | provider session -> DSM share resource | `List/list`、`getinfo`、`download`，offset/limit 和 Range | create folder、upload、rename 同步；delete/copy/move 通过 task status | `packages/synology-file-station-provider` 已完成首个真实 HTTP fixture 切片 |
| S3/MinIO | client/session -> bucket resource | prefix/delimiter、continuation token、Head/Get/Range | Put/Delete/Copy/Multipart 和 ETag/version | 现有 `packages/s3-provider` 切片已通过聚焦测试，跨 bucket 契约仍待冻结 |
| WebDAV | client/session -> collection resource | PROPFIND 深度和分页投影 | MKCOL、PUT、MOVE、COPY、DELETE | 复用 Kernel 已有 `go-webdav` 依赖，现场服务器验收待补 |

## Synology provider 证据

- API discovery 从 `SYNO.API.Info` 获取实际 path/version；登录凭据只通过 POST 表单发送，不进入 URL。
- DSM 需要的路径集合按 JSON 数组编码；上传使用有准确 `Content-Length` 的流式 multipart；同步 API 与异步 task API 分开处理，task status 回到对应 API 的 `status` 方法。
- 真实只读 discovery（2026-08-11，未携带凭据）访问 `http://192.168.31.195:5000/webapi/query.cgi` 与 `https://192.168.31.195:5001/webapi/query.cgi` 均返回 `SYNO.API.Auth`；对精确 API 名称查询返回 `entry.cgi`，`List/Download/CreateFolder/Rename/Delete/CopyMove/Upload` 版本范围分别覆盖当前 provider 所需的最低版本。此前的汇总查询 `SYNO.FileStation` 在该 DSM 上只返回 Auth，已改为精确查询常量并由 fixture 锁定。
- 显式 RootPath、相对路径越界、只读会话、分页、递归列表、Stat、Range Open、创建、上传、重命名、删除和 task 轮询均有 fake-client 与 `httptest` fixture 覆盖；失败响应不会降级为空列表。
- 未配置 RootPath 时，session 通过 Client 的 `ListShares` 能力调用 DSM `SYNO.FileStation.List/list_share`，将每个可见共享建模成独立 resource；资源 ID 为稳定 hash opaque ID，资源根 `Ref.Path` 为空，共享内路径才进入 `Ref.Path`。多共享分页、空集合、重复/越界共享、发现失败后的 SID 注销均有真实 HTTP/fake fixture 覆盖。
- Kernel provider registry 已改为进程级实例；同一进程内的 session、异步 operation 和 opaque address 不再因下一次 HTTP 请求重新构造 registry 而丢失。聚焦 API/fileprovider/filebrowser 测试通过。
- Synology `OpenResource` 与 S3/WebDAV 资源契约对齐：即使请求校验了子路径，返回的 Resource/Descriptor 仍指向共享根，子路径只存在于具体操作的 `ResourceRef.Path`。
- 最终聚焦证据：Synology `go test -race ./...`、Kernel `go test -short -tags fts5 ./api ./fileprovider ./filebrowser`、`gofmt -d` 和 `git diff --check` 均通过；Go 测试均使用系统默认缓存路径。
- 聚焦命令：`go test ./...`（工作目录 `packages/synology-file-station-provider`）已通过；当前执行身份直接使用默认 `C:\Users\al765\AppData\Local\go-build` 被 ACL 拒绝，受控权限重跑同一命令通过，未创建项目内缓存目录。
- Kernel 组合证据：`go test -short -tags fts5 ./fileprovider ./filebrowser ./api` 已通过；期间修复了当前新增文件中的缺失 `strings` import 和未使用 `path/filepath` import，未改变 provider/handler 行为。
- Kernel 全量短测试结果：除 `kernel/embedding/TestOllamaEmbed` 外各包通过；该既有测试自动拉取 `nomic-embed-text` 后访问 `127.0.0.1:11434` 超时，不能作为文件 provider 失败证据，完整命令仍记为未通过。
- 缓存审计：`D:\dev\s-forge\.dev-workspace\temp\go-build-cache` 在 2026-08-09 已存在，当前约 1.02 GB、未被 Git 跟踪；本轮未创建、删除或清理它。仓库源码和 Git 历史未找到生成该目录的配置，当前 provider 测试使用系统默认 `C:\Users\al765\AppData\Local\go-build`。

## 未完成项

- [ ] 建立 SMB provider 的显式 session/resource/capability 实现，优先复用已挂载 UNC/盘符的 OS API，不在领域层硬编码 `N:`、`O:` 或 IP。
- [ ] 在用户桌面身份下对 `\\192.168.31.195\视频素材`、`\\192.168.31.195\工作文件` 做只读根枚举、分页、断线和权限负向验收；测试记录不得保存凭据或修改共享内容。
- [ ] 明确 SMB 与 DSM HTTP 各自独立的 provider/session/resource 节点、opaque address、缩略图/原图请求和 Agent 任务绑定入口，保持错误显式，不以空结果或占位图掩盖连接失败。
- [ ] 为 SMB/SFTP/FTP/NFS 分别冻结能力矩阵；没有真实协议实现和边界测试前，不宣称“常见文件服务全量支持”。
- [ ] Forge 交互验收：当前 `pnpm forge` 门禁要求工作树和索引干净；工作区存在并行修改，且现有 supervisor 描述已过期，待稳定 revision 可启动后再记录 A 级窗口证据。

## 凭据传输安全边界

- [x] 生产组合根不再为 Synology、S3、WebDAV 默认开启明文 HTTP。
- [x] HTTP 只在当前 session 明确确认且 endpoint 为 `localhost`、loopback、private 或 link-local IP 时接受；公网 IP、普通域名和 unspecified address 不因确认而放行。该规则是传输安全策略，不用于判断两个 provider 是否属于同一设备。
- [x] provider 的 session 请求预校验在凭据 resolver、client/store factory 和 Synology Login 前运行；Kernel API 在短期 credential vault `Issue` 前执行相同预校验。
- [x] 三个 provider 的实际 HTTP 客户端均拒绝跨主机重定向和 HTTPS 到 HTTP 降级，避免初始 HTTPS endpoint 在后续认证请求中落到明文连接。
- [x] 独立 module、Kernel API/fileprovider 和前端 repository 聚焦测试通过；系统默认 Go 缓存 ACL 由当前 Windows 用户运行相同测试解决，未改缓存位置或项目构建配置。

## 变更记录

| 日期 | 事项 | 证据 | 状态 |
| --- | --- | --- | --- |
| 2026-08-12 | 修复生产组合根默认放开明文 HTTP 凭据传输 | 三 provider 零 resolver/factory/Login 负向回归、Kernel vault 零调用回归、四 module 与 API/fileprovider 聚焦测试通过 | 完成逻辑节点 |
| 2026-08-12 | 固定 provider 独立命名空间；来源信息仅为单个 session 内展示元数据 | 结构化 Kernel 键与同值双 provider 的 registry/address/tree 回归通过 | 完成 |
| 2026-08-11 | 根据用户截图确认 SMB session 枚举到同一主机名下的两个独立共享；DSM HTTP 保持独立 provider | `N:`/`O:` 显示 `\\192.168.31.195`；当前执行身份 UNC 只读探测返回访问拒绝 | 记录 |
| 2026-08-11 | Synology HTTP provider 测试修复 | `provider_test.go` 补充 `net/http`；`http_client_test.go` 清理临时 `strconv` 占位；`gofmt`；`go test ./...` 通过 | 完成切片 |
| 2026-08-11 | Forge 状态复核 | `.forge-runtime/state.json` 显示历史 supervisor 已停止，最近重启 job 因 protected-test approval 超时失败；没有停止或重启任何现有进程 | 阻塞现场验收 |
| 2026-08-11 | Kernel 聚焦门禁 | `go test -short -tags fts5 ./fileprovider ./filebrowser ./api` 通过；`git diff --check` 通过 | 稳定逻辑节点 |
| 2026-08-11 | Kernel 全量短测试 | 仅 `kernel/embedding/TestOllamaEmbed` 因本机 Ollama 请求超时失败，其余包通过 | 部分通过，待环境独立验证 |
| 2026-08-11 | 缓存目录审计 | `.dev-workspace/temp/go-build-cache` 创建时间 2026-08-09、约 1.02 GB、Git 未跟踪；未执行清理 | 记录 |
| 2026-08-11 | Forge 启动尝试 | `pnpm forge --no-browser` 按原生 clean gate 拒绝；列出的并行修改未被隐藏、覆盖或回退，进程已退出 | 等待干净 revision |
| 2026-08-11 | 真实 DSM discovery | 5000/5001 无凭据 API probe 返回 200；精确 File Station 查询返回 `entry.cgi` 与版本范围 | 通过，未登录/未写入 |
| 2026-08-11 | Synology 多共享资源模型切片 | `list_share` HTTP fixture、session resource 分页、opaque share ID、错误注销；`go test ./...`（package `synology-file-station-provider`）通过 | 完成切片；SMB 盘符现场接入仍未完成 |
| 2026-08-11 | Kernel provider registry 生命周期 | `newFileBrowserProviderRegistry` 返回进程级实例；新增复用回归测试；`go test -short -tags fts5 ./api ./fileprovider ./filebrowser` 通过 | 完成切片 |
| 2026-08-12 | provider 边界纠正 | `provider -> session -> resource -> entry` 是唯一通用层级；SMB/DSM 之间没有设备关系这一领域概念 | 记录 |
