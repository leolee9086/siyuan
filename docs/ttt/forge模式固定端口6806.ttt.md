# forge模式固定端口6806

## 任务概述

当前 forge 模式启动时未指定端口，kernel 默认使用随机端口（`--port=0`），虽然 `InitFixedPortService` 会在 1 秒后启动一个 6806 的反向代理，但浏览器打开的是随机端口 URL，且代理模式带来不必要的间接性。

目标：forge 模式直接监听 6806 端口，并避免重复启动。同时 `pnpm forge` 支持通过 `--port` 参数自定义端口。

## 现状分析

### forge 启动链路

1. `pnpm forge` → [`node ./scripts/forge-start.js`](../../app/package.json:15) → 编译 kernel → 启动命令：
   ```
   ./SiYuan-Kernel --wd=.. --mode=forge --workspace=../../.dev-workspace
   ```
   **没有传递 `--port`**，因此 kernel 中 [`port` 默认为 `"0"`](../../kernel/util/working.go:110)（随机端口）。

2. [`kernel/util/working.go:110`](../../kernel/util/working.go:110)：
   ```go
   port := flag.String("port", "0", "port of the HTTP server")
   ```
   `ServerPort = *port` → 变为 `"0"`。

3. [`kernel/server/serve.go:235`](../../kernel/server/serve.go:235)：
   监听随机端口后，通过 `net.SplitHostPort` 获取实际端口，更新 `util.ServerPort`。

4. [`kernel/server/serve.go:291-292`](../../kernel/server/serve.go:291)：
   启动后 1 秒，调用 `proxy.InitFixedPortService` 在 6806 启动反向代理。

### 现有固定端口代理逻辑

[`kernel/server/proxy/fixedport.go:31-34`](../../kernel/server/proxy/fixedport.go:31)：
```go
func InitFixedPortService(host string, useTLS bool, certPath, keyPath string) {
    if util.FixedPort != util.ServerPort {
        if util.IsPortOpen(util.FixedPort) {
            return  // 端口已被占用，跳过
        }
        // 启动 6806 反向代理...
    }
}
```

### forge 模式浏览器打开逻辑

[`kernel/server/serve.go:298-317`](../../kernel/server/serve.go:298)：
```go
if util.IsForgeMode() && !util.NoBrowser {
    url := fmt.Sprintf("http://127.0.0.1:%s/", port)  // 使用随机端口
    // 打开 magi 界面...
}
```

## 修改目标

### 目标 1：`pnpm forge` 支持传入端口参数

[`app/scripts/forge-start.js`](../../app/scripts/forge-start.js) 从 `process.argv` 中解析 `--port` 参数：
- `pnpm forge` → 默认使用 6806
- `pnpm forge --port=6806` → 使用 6806
- `pnpm forge --port=XXXX` → 使用 XXXX

### 目标 2：forge 模式直接使用指定端口

在 kernel 启动命令中添加 `--port=<port>`：
```
./SiYuan-Kernel --wd=.. --mode=forge --port=6806 --workspace=../../.dev-workspace
```

这样 kernel 直接监听固定端口，无需反向代理中转。

### 目标 3：避免重复打开

当端口已被占用时（可能之前启动的实例未关闭），必须优雅处理：

**方案 A（推荐）**：在 `forge-start.js` 启动 kernel 之前，先检测端口是否可用：
- 如果可用 → 正常启动
- 如果不可用 → 打印提示并退出，告知用户先关闭已有实例

**选择方案 A**，在 JS 脚本中做端口检测。

### 目标 4：forge 模式浏览器打开 URL 使用指定端口

如果 kernel 直接监听指定端口（而非随机端口），则 `serve.go` 中 `port` 变量已经是该端口值，所以不需要额外修改。——但需验证。

## 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| [`app/scripts/forge-start.js`](../../app/scripts/forge-start.js) | 修改 | 解析 `--port` 参数 + 端口检测 + 传递给 kernel |
| [`kernel/server/serve.go`](../../kernel/server/serve.go) | 仅验证 | 确认 forge 模式的浏览器 URL 使用的是 `port` 变量而非硬编码 |

## 验证标准

- [x] `pnpm forge` 启动后，kernel 直接监听 127.0.0.1:6806
- [x] `pnpm forge --port=6806` 行为同上
- [x] `pnpm forge --port=9900` 后 kernel 监听 127.0.0.1:9900
- [x] 端口被占用时，给出明确提示并退出，而非静默失败
- [x] 浏览器打开的 URL 端口与 kernel 监听端口一致
- [x] 现有反向代理固定端口逻辑不受影响（非 forge 模式下仍正常工作）

## 注意事项

1. 修改仅影响 forge 模式，production 和 dev 模式不受影响
2. `InitFixedPortService` 的代理逻辑保留，以兼容非 forge 模式下需要固定端口 6806 的场景（如浏览器剪藏扩展）
3. JS 端口检测使用 Node.js 原生 `net` 模块，不引入额外依赖
4. 当 forge 模式指定非 6806 端口时，`InitFixedPortService` 仍会尝试在 6806 启动反向代理（符合现有行为）
