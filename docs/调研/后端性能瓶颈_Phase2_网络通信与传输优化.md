# 后端性能瓶颈调研：Phase 2 网络通信与传输优化

## 发现与分析

经过对 `kernel/server`, `kernel/api`, `kernel/util` 目录中有关 WebSocket 和 HTTP JSON 编解码的逻辑静态查阅，发现了以下可能导致通信卡顿与内存压力的瓶颈：

### 1. WebSocket 消息编解码机制 (`serve.go` 与 `util/websocket.go`)
- **现状**：思源在接受前端 WebSocket 请求消息以及在推送（Push / Broadcast）事件时，大量使用了 `gulu.JSON.UnmarshalJSON` 和 `gulu.JSON.MarshalJSON` 进行通用 `map[string]interface{}` 的转换。
- **瓶颈**：在推送大体积增量数据（例如大规模 DOM 更新、长文档块加载）时，将复杂嵌套的 Go `interface{}` 通过标准库级别的 `json.Marshal` 序列化为字节流，不仅速度较慢，而且在序列化期间会产生大量临时对象导致 GC（垃圾回收）压力骤增，容易触发 STW（Stop The World）卡顿。

### 2. HTTP 大接口响应序列化 (`api/block.go` 等)
- **现状**：大部分如获取块 DOM、获取文档树 (`getBlockDOMs`, `listDocTree`) 等重型接口，均使用了 Gin 框架默认的 `c.JSON(http.StatusOK, ret)`。
- **瓶颈**：`c.JSON` 会在当前 goroutine 中同步、全量地完成堆内存上的大 JSON 字符串拼接。在处理包含数十万字长文档的请求时，内存逃逸和整存申请消耗极大，容易成为拉高接口响应延迟（P99）的直接原因。

## 可能解决方案预估

1. **引入高性能 JSON 库及流式处理**
   - **替换 `gulu.JSON` 底层**：对于高频大载荷的 WebSocket 请求和推送，可考虑由标准库 `encoding/json` 替换为 `json-iterator/go` 或 `bytedance/sonic` 等基于 JIT/SIMD 加速的高性能序列化器。
   - **流式 Writer**：在确需组装大 JSON 返回的 API 中，尽量避免组装庞大的 `map` 后再一次性 Marshal。可直接使用 `json.Encoder` 将结构体以流式边写边推（Streaming Output）的方式注入 `http.ResponseWriter` 缓冲池，以削减内存波峰。

2. **通信层数据精简与分页**
   - 削减基于树形嵌套结构的粗放型全量下发，在涉及 `listDocTree` 等接口时，仅返回必要状态变更或采取更加激进的懒加载（Lazy Load）分页策略。

*(注：由于思源部分 API 具有对外开放性，修改底层 JSON 序列化库可能存在微小的类型强转兼容风险，实际操作时需严格增加自动化接口契约测试。)*
