# esbuild后端编译服务迁移

## 目标

将前端构建从webpack预编译模式迁移为Go后端内嵌esbuild实时伺服模式。源码随应用分发，运行时编译。

## 背景

- 当前：TypeScript源码 → webpack预编译 → 静态bundle → 随应用分发
- 目标：TypeScript源码随应用分发 → Go后端内嵌esbuild → 运行时实时编译伺服
- esbuild本身是Go编写，可通过 `github.com/evanjs/esbuild/pkg/api` 直接集成到kernel

## 待确认技术点

- [ ] esbuild对Vue SFC的支持现状（原生不支持，需调研插件生态）
- [ ] esbuild对SCSS的支持现状
- [ ] 编译时机策略（启动编译+缓存 vs 按需编译）
- [ ] 4个构建目标在新架构下的处理方式

## 阶段

### 阶段0：技术调研（当前）
- 调研esbuild Go API对Vue SFC/SCSS的支持能力
- 调研esbuild插件在Go端的可用性
- 评估可行性并决定后续方案

### 阶段1-N：待调研结果确定后规划

## 执行记录

| 日期 | 事项 | 结果 |
|------|------|------|
| 2026-02-22 | 创建ttt，启动技术调研 | 进行中 |
