/// Better Binary Quantization - Rust WebAssembly实现
/// 
/// 基于Lucene的二值量化算法，提供优化的向量量化和搜索功能
/// 通过Rust的精确内存控制实现更好的内存压缩效果

// 模块声明
pub mod constants;
pub mod vector_similarity;
pub mod vector_utils;
pub mod bitwise_dot_product;
pub mod batch_dot_product;
pub mod optimized_scalar_quantizer;
pub mod binary_quantized_scorer;
pub mod quantized_index;
#[cfg(test)]
pub mod quantized_index_test;
pub mod wasm_interface;

// 重新导出主要类型和函数
pub use constants::*;
pub use vector_similarity::{
    SimilarityFunction,
    compute_euclidean_distance,
    compute_euclidean_similarity,
    compute_cosine_similarity,
    compute_maximum_inner_product,
    compute_similarity,
};
pub use vector_utils::{
    compute_vector_magnitude,
    create_random_vector,
    create_zero_vector,
    normalize_vector,
    compute_dot_product,
};
pub use bitwise_dot_product::{
    compute_quantized_dot_product,
    compute_int4_bit_dot_product,
    compute_int1_bit_dot_product,
    compute_packed_bit_dot_product,
};
pub use batch_dot_product::{
    compute_batch_four_bit_dot_product_direct_packed,
    compute_batch_one_bit_dot_product_direct_packed,
    create_direct_packed_buffer,
};
pub use optimized_scalar_quantizer::{
    OptimizedScalarQuantizer,
    QuantizationResult,
};
pub use binary_quantized_scorer::{
    BinaryQuantizedScorer,
    QuantizedScoreResult,
};
pub use quantized_index::{
    QuantizedIndex,
    QuantizedIndexConfig,
    QuantizedVectorValues,
    QuantizedVectorValuesImpl,
    QueryResult,
};

// WASM绑定
use wasm_bindgen::prelude::*;

/// WASM模块初始化
#[wasm_bindgen(start)]
pub fn init() {
    // 设置panic hook以便在浏览器控制台看到更好的错误信息
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// 获取版本信息
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
