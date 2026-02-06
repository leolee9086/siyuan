# kernelApiClient 迁移到 kernelSDK

## 任务概述
将 `app/src/data/kernelAPI/kernelApiClient.ts` 的所有使用替换为 `app/src/data/kernelSDK`

## 影响范围
- `app/src/data/kernelAPI/defaultClient.ts`
- `app/src/data/kernelAPI/defaultWorkspace.ts`

## 迁移计划

### 1. defaultClient.ts 修改
- 原代码：导入 KernelApiClient 并实例化为 localKernel
- 目标：使用 kernelSDK 的 kernelClient 替代

### 2. defaultWorkspace.ts 修改
- 原代码：使用 KernelApiClient 作为类型注解，调用 putFile/readDir/removeFile
- 目标：使用 KernelClientType 作为类型，调用 kernelSDK 对应方法
- 注意：需确认 baseUrl 和 apiToken 属性的访问方式

## 执行状态
- [x] 分析使用位置
- [ ] 检查 API 兼容性
- [ ] 修改 defaultClient.ts
- [ ] 修改 defaultWorkspace.ts
- [ ] 验证修改正确性

## 备注
此任务为简单迁移任务，涉及文件数量少，复杂度低。
