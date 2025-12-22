/// 常量定义
/// 对应TypeScript中的constants.ts

/// 查询向量量化位数（默认4位）
pub const QUERY_BITS: u8 = 4;

/// 索引向量量化位数（默认1位）
pub const INDEX_BITS: u8 = 1;

/// 4位量化缩放因子
/// 用于将4位量化值（0-15）映射到浮点数范围
pub const FOUR_BIT_SCALE: f32 = 1.0 / 15.0;

/// 最大量化位数
pub const MAX_BITS: u8 = 8;

/// 最小量化位数
pub const MIN_BITS: u8 = 1;

/// 默认各向异性权重
pub const DEFAULT_LAMBDA: f32 = 0.1;

/// 默认优化迭代次数
pub const DEFAULT_ITERS: usize = 5;

/// 最小MSE网格 - 基于均匀分布的最优MSE网格
/// 每个位数的间隔值经过理论推导和数值优化
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

/// 数值精度常量
pub mod NUMERICAL_CONSTANTS {
    /// 收敛阈值
    pub const CONVERGENCE_THRESHOLD: f64 = 1e-8;
    /// 最小行列式值
    pub const MIN_DETERMINANT: f64 = 1e-12;
    /// 浮点数比较精度
    pub const EPSILON: f64 = 1e-8;
}
