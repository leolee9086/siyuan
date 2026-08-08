# websearch-mcp

`websearch` 包的独立 MCP server：以标准 MCP 服务形式向任何客户端（Claude Desktop、Cursor 等）暴露 100+ 引擎元搜索能力，支持 stdio 与 streamable HTTP（2025-06-18）双传输。

与 s-forge 内核完全解耦：内核通过 `kernel/websearch/service.go` 直接调用该 Go 包，本程序只是独立发布给外部工具用的另一入口，两者互不影响。

## 构建

```bash
cd packages/websearch
go build ./cmd/websearch-mcp        # 产出 websearch-mcp(.exe)
```

仅依赖 websearch 模块自身（fhttp + tls-client），MCP 协议为手写 JSON-RPC，无额外依赖。

## 运行

```bash
# stdio 模式（默认，供 MCP 客户端本地启动）
./websearch-mcp -proxy http://127.0.0.1:7890

# streamable HTTP 模式（远程部署）
./websearch-mcp -http-addr :8080 -proxy http://127.0.0.1:7890
```

### stdio 冒烟

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"hello","numResults":5}}}' \
  | ./websearch-mcp -proxy http://127.0.0.1:7890
```

### HTTP 冒烟

```bash
# initialize（响应头 Mcp-Session-Id 即会话 ID）
curl -X POST http://127.0.0.1:8080/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'

# 后续请求携带会话
curl -X POST http://127.0.0.1:8080/mcp -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"golang","numResults":3}}}'

# GET /mcp 为 SSE 流（event: endpoint 后持续心跳）；DELETE /mcp 销毁会话
```

## 配置

优先级：flags > 环境变量 > `-config` JSON 文件 > 包默认值。

```bash
# 环境变量（stdio 模式下 MCP 客户端只能传 env，这是主通道）
EXA_API_KEY=... PARALLEL_API_KEY=... WEBSEARCH_PROVIDER=meta \
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 \
./websearch-mcp
```

`-config` JSON 文件与 `RuntimeConfig` 同构（`provider`、`timeoutMs`、`exaApiKey`、`parallelApiKey`、`proxy`、`defaultOptions`、`engines`），完整示例见 [npm/README.md](../../npm/README.md)。

## 工具

| 工具 | 参数 | 返回 |
|---|---|---|
| `web_search` | `query`（必填）、`numResults`、`queryType`、`timeRange`、`lang`、`provider`、`searchType`、`livecrawl`、`engines` | `SearchResponse` JSON（results / usedEngines / errors / diagnostics） |
| `web_search_status` | `engines`、`probe`、`query` | 引擎诊断 + 速率限制 + 缓存统计 |

协议细节：`initialize` 协商 2024-11-05 / 2025-06-18；通知（`id` 为 null）不响应（HTTP 202）；未初始化前 `tools/*` 返回 `-32002`；工具错误以 `isError:true` 返回；HTTP 模式需 `Mcp-Session-Id` 头，缺失 400 / 未知 404。

## 测试

```bash
go test ./cmd/websearch-mcp   # 协议级测试，注入假 service，不触网
```
