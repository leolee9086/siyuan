# @leolee9086/websearch-mcp

独立发布的 MCP server：把 [websearch](../README.md) 包（100+ 引擎元搜索、聚合去重、引擎诊断）以标准 MCP 服务形式暴露给任何 MCP 客户端。与 s-forge 内核的使用方式完全解耦，内核照旧直接调用 Go 包，本包仅供外部工具接入。

- **传输**：stdio（默认，桌面客户端本地启动）+ streamable HTTP（`-http-addr`，远程部署）
- **协议**：MCP 2025-06-18 / 2024-11-05，手写 JSON-RPC，零 Go 依赖
- **工具**：`web_search`（元搜索）、`web_search_status`（引擎健康/凭据/速率限制/缓存）

## 安装

```bash
npm install @leolee9086/websearch-mcp
# 或直接运行（自动获取/构建二进制）：
npx @leolee9086/websearch-mcp --version
```

`postinstall` 会按平台从 GitHub Releases 下载预编译二进制（`bin/<platform>-<arch>/websearch-mcp`）；下载不可用时回退 `go build ./cmd/websearch-mcp`（需本机 Go ≥ 1.24.5）。发布时确认 `bin/websearch-mcp.js` 顶部的 `RELEASE_BASE_URL`（默认指向 `leolee9086/siyuan` 的 release 地址）存在对应资产即可。

## 注册到 MCP 客户端

### Claude Desktop（`claude_desktop_config.json`）

```json
{
  "mcpServers": {
    "websearch": {
      "command": "npx",
      "args": ["@leolee9086/websearch-mcp"],
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:7890",
        "EXA_API_KEY": ""
      }
    }
  }
}
```

### 远程 HTTP 模式

```bash
websearch-mcp -http-addr :8080 -proxy http://127.0.0.1:7890
```

客户端连接 `http://host:8080/mcp`（streamable HTTP）。无鉴权，建议仅内网/本机使用。

## 配置

优先级：**命令行 flags > 环境变量 > JSON 配置文件（`-config`）> 包默认值**。

| 来源 | 键 | 说明 |
|---|---|---|
| env | `EXA_API_KEY` / `PARALLEL_API_KEY` | Exa / Parallel 搜索凭据 |
| env | `WEBSEARCH_PROVIDER` | `auto` / `meta` / `duckduckgo` / `exa` / `parallel` |
| env | `WEBSEARCH_NUM_RESULTS` | 默认结果数（默认 300） |
| env | `WEBSEARCH_TIMEOUT_MS` | 单引擎超时（默认 15000） |
| env | `WEBSEARCH_ENGINES` | 引擎白名单（逗号分隔） |
| env | `WEBSEARCH_ENABLED` | `true` / `false` |
| env | `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | 标准代理变量 |
| flag | `-http-addr` | 启用 streamable HTTP（空 = stdio） |
| flag | `-proxy` / `-no-proxy` | 显式代理（HTTP/HTTPS 共用） |
| flag | `-num-results` / `-timeout-ms` | 覆盖默认值 |
| flag | `-keys-json` | 引擎 → API key 的 JSON 映射 |
| flag | `-config` | JSON 配置文件（结构与 `RuntimeConfig` 同构） |
| flag | `-protect-urls` | 结果 URL 替换为不透明引用 token |
| flag | `-log` | `debug` / `info` / `warn` / `error` |

## 工具

- **web_search**：`query`（必填）、`numResults`、`queryType`（general/code/news/academic/social/video/shopping）、`timeRange`（day/week/month/year）、`lang`、`provider`、`searchType`、`livecrawl`、`engines`。返回结构化 `SearchResponse` JSON（results、usedEngines、errors、diagnostics）。
- **web_search_status**：`engines`、`probe`（真实探测，会发网络请求）、`query`。返回引擎诊断、速率限制状态、缓存命中率。

## 构建与测试

```bash
cd packages/websearch
go build ./cmd/websearch-mcp
go vet ./cmd/websearch-mcp
go test ./cmd/websearch-mcp
```
