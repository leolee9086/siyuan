# DiskANN 技术调研报告

> 调研日期: 2026-02-04  
> 目标: Go语言实现DiskANN时的源码参考索引

---

## 源码参考目录

| 实现问题 | 参考文件 | 关键行号 |
|----------|----------|----------|
| 默认参数值 | `toread/IP-DiskANN/include/defaults.h` | 11-33 |
| 参数结构定义 | `toread/IP-DiskANN/include/parameters.h` | 15-37 |
| 搜索参数验证 | `toread/DiskANN/diskann/src/graph/misc.rs` | 39-89 |
| 索引主结构 | `toread/DiskANN/diskann/src/graph/index.rs` | 61-68 |
| 单点插入流程 | `toread/DiskANN/diskann/src/graph/index.rs` | 346-474 |
| 批量插入流程 | `toread/DiskANN/diskann/src/graph/index.rs` | 988-1161 |
| 原地删除实现 | `toread/DiskANN/diskann/src/graph/index.rs` | 1665-1725 |
| 删除候选策略 | `toread/DiskANN/diskann/src/graph/index.rs` | 1300-1476 |
| **BBQ量化器** | `toread/rust-bbq/optimized_scalar_quantizer.rs` | 21-151 |
| **BBQ评分器** | `toread/rust-bbq/binary_quantized_scorer.rs` | 28-218 |
| **BBQ常量** | `toread/rust-bbq/constants.rs` | 1-47 |

---

## 1. 参数配置

### 问题: 如何确定默认参数值?

**查看**: [`toread/IP-DiskANN/include/defaults.h:11-33`](toread/IP-DiskANN/include/defaults.h)

```cpp
const float ALPHA = 1.2f;                    // 剪枝阈值
const uint32_t MAX_OCCLUSION_SIZE = 750;     // 最大遮挡大小
const float GRAPH_SLACK_FACTOR = 1.3f;       // 图松弛因子
const uint64_t SECTOR_LEN = 4096;            // 扇区长度
const uint32_t MAX_DEGREE = 64;              // 默认最大度数
const uint32_t BUILD_LIST_SIZE = 100;        // 构建列表大小
const uint32_t SEARCH_LIST_SIZE = 100;       // 搜索列表大小
```

### 问题: 搜索参数如何验证?

**查看**: [`toread/DiskANN/diskann/src/graph/misc.rs:64-89`](toread/DiskANN/diskann/src/graph/misc.rs)

约束: `l_value >= k_value`, `beam_width > 0`, `k_value > 0`, `l_value > 0`

---

## 2. 图索引结构

### 问题: 索引主结构如何设计?

**查看**: [`toread/DiskANN/diskann/src/graph/index.rs:61-68`](toread/DiskANN/diskann/src/graph/index.rs)

### 问题: 删除方法有哪些?

**查看**: [`toread/DiskANN/diskann/src/graph/misc.rs:31-36`](toread/DiskANN/diskann/src/graph/misc.rs)

三种策略: `VisitedAndTopK`, `TwoHopAndOneHop`, `OneHop`

---

## 3. BBQ量化 (Better Binary Quantization)

### 问题: BBQ默认参数是什么?

**查看**: [`toread/rust-bbq/constants.rs:4-24`](toread/rust-bbq/constants.rs)

```rust
pub const QUERY_BITS: u8 = 4;           // 查询向量4位量化
pub const INDEX_BITS: u8 = 1;           // 索引向量1位量化
pub const FOUR_BIT_SCALE: f32 = 1.0 / 15.0;
pub const DEFAULT_LAMBDA: f32 = 0.1;    // 各向异性权重
pub const DEFAULT_ITERS: usize = 5;     // 优化迭代次数
```

### 问题: 最小MSE网格如何配置?

**查看**: [`toread/rust-bbq/constants.rs:28-37`](toread/rust-bbq/constants.rs)

```rust
pub const MINIMUM_MSE_GRID: [[f64; 2]; 8] = [
    [-0.798, 0.798],   // 1位
    [-1.493, 1.493],   // 2位
    [-2.051, 2.051],   // 3位
    [-2.514, 2.514],   // 4位
    [-2.916, 2.916],   // 5位
    [-3.278, 3.278],   // 6位
    [-3.611, 3.611],   // 7位
    [-3.922, 3.922],   // 8位
];
```

### 问题: 量化结果结构如何设计?

**查看**: [`toread/rust-bbq/optimized_scalar_quantizer.rs:12-18`](toread/rust-bbq/optimized_scalar_quantizer.rs)

```rust
pub struct QuantizationResult {
    pub lower_interval: f32,           // 量化区间下界
    pub upper_interval: f32,           // 量化区间上界
    pub additional_correction: f32,    // 附加校正值
    pub quantized_component_sum: f32,  // 量化分量和
}
```

### 问题: 标量量化流程是什么?

**查看**: [`toread/rust-bbq/optimized_scalar_quantizer.rs:52-151`](toread/rust-bbq/optimized_scalar_quantizer.rs)

流程:
1. 质心中心化并计算统计信息 (行77-103)
2. 获取初始间隔 (行106)
3. 优化间隔 (行109)
4. 量化向量并计算quantizedComponentSum (行112-136)

### 问题: 1位量化如何实现?

**查看**: [`toread/rust-bbq/optimized_scalar_quantizer.rs:123-128`](toread/rust-bbq/optimized_scalar_quantizer.rs)

```rust
if bits == 1 {
    let threshold = (a + b) / 2.0;
    let quantized_value = if clamped >= threshold { 1 } else { 0 };
    destination[i] = quantized_value;
}
```

### 问题: 间隔优化算法如何实现?

**查看**: [`toread/rust-bbq/optimized_scalar_quantizer.rs:182-244`](toread/rust-bbq/optimized_scalar_quantizer.rs)

使用坐标下降法优化各向异性损失函数。

### 问题: 二进制打包如何实现?

**查看**: [`toread/rust-bbq/optimized_scalar_quantizer.rs:274-299`](toread/rust-bbq/optimized_scalar_quantizer.rs)

---

## 4. BBQ评分计算

### 问题: 评分器支持哪些相似性函数?

**查看**: [`toread/rust-bbq/binary_quantized_scorer.rs:156-176`](toread/rust-bbq/binary_quantized_scorer.rs)

支持: `Euclidean`, `Cosine`, `MaximumInnerProduct`

### 问题: 1位量化评分如何计算?

**查看**: [`toread/rust-bbq/binary_quantized_scorer.rs:136-176`](toread/rust-bbq/binary_quantized_scorer.rs)

```rust
let score = ax * ay * dimension as f32 +
    ay * lx * x1 +
    ax * ly * y1 +
    lx * ly * qc_dist as f32;
```

### 问题: 4位量化评分如何计算?

**查看**: [`toread/rust-bbq/binary_quantized_scorer.rs:178-218`](toread/rust-bbq/binary_quantized_scorer.rs)

### 问题: 批量评分如何优化?

**查看**: [`toread/rust-bbq/binary_quantized_scorer.rs:220-319`](toread/rust-bbq/binary_quantized_scorer.rs)

4位使用 `compute_batch_four_bit_dot_product_direct_packed`
1位使用 `compute_batch_one_bit_dot_product_direct_packed`

---

## 5. 插入与删除

### 问题: 单点插入的完整流程?

**查看**: [`toread/DiskANN/diskann/src/graph/index.rs:346-474`](toread/DiskANN/diskann/src/graph/index.rs)

### 问题: 批量插入如何并行化?

**查看**: [`toread/DiskANN/diskann/src/graph/index.rs:988-1161`](toread/DiskANN/diskann/src/graph/index.rs)

### 问题: 原地删除如何实现?

**查看**: [`toread/DiskANN/diskann/src/graph/index.rs:1665-1725`](toread/DiskANN/diskann/src/graph/index.rs)

参考论文: https://arxiv.org/abs/2502.13826

### 问题: 如何清理已删除邻居?

**查看**: [`toread/DiskANN/diskann/src/graph/index.rs:1884-1942`](toread/DiskANN/diskann/src/graph/index.rs)

---

*报告完成于 2026-02-04*
