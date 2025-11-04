# GPU计算模块

这个文件夹包含所有WebGPU相关的实现。

## 文件说明

- `device.js` - WebGPU设备管理
- `shaders.js` - 着色器定义
- `utils.js` - GPU工具函数
- `dark-channel.js` - 暗通道GPU计算
- `atmospheric-light.js` - 大气光GPU计算
- `recover-image.js` - 图像恢复GPU计算
- `cache.js` - 统一的管线缓存管理

## 模块职责

- 管理WebGPU设备和资源
- 提供GPU计算功能
- 实现高性能缓存机制
- 处理GPU内存管理 