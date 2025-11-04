# 核心算法模块

这个文件夹包含所有核心的去雾算法实现。

## 文件说明

- `dehazing-core.js` - 去雾算法核心函数
- `dehazing-cpu.js` - CPU版本的完整去雾算法
- `dehazing-webgpu.js` - WebGPU版本的完整去雾算法
- `legacy.js` - 传统算法实现（原1.js）

## 模块职责

- 提供统一的算法接口
- 实现不同平台的算法版本
- 保持算法逻辑的一致性 