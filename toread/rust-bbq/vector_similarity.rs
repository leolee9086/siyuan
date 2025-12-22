/// 向量相似性计算
/// 对应TypeScript中的vectorSimilarity.ts

use wasm_bindgen::prelude::*;

/// 相似性函数类型
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SimilarityFunction {
    Euclidean,
    Cosine,
    MaximumInnerProduct,
}

/// 计算欧几里得距离
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// 
/// # 返回
/// 欧几里得距离
pub fn compute_euclidean_distance(a: &[f32], b: &[f32]) -> Result<f32, String> {
    if a.is_empty() || b.is_empty() {
        return Err("向量不能为空".to_string());
    }
    if a.len() != b.len() {
        return Err("向量维度不匹配".to_string());
    }
    
    let sum: f32 = a.iter()
        .zip(b.iter())
        .map(|(av, bv)| {
            let diff = av - bv;
            diff * diff
        })
        .sum();
    
    Ok(sum.sqrt())
}

/// 计算欧几里得相似性
/// 转换距离为相似性分数：1 / (1 + distance)
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// 
/// # 返回
/// 欧几里得相似性分数
pub fn compute_euclidean_similarity(a: &[f32], b: &[f32]) -> Result<f32, String> {
    let distance = compute_euclidean_distance(a, b)?;
    Ok(1.0 / (1.0 + distance))
}

/// 计算余弦相似性
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// 
/// # 返回
/// 余弦相似性分数（-1到1之间）
pub fn compute_cosine_similarity(a: &[f32], b: &[f32]) -> Result<f32, String> {
    if a.is_empty() || b.is_empty() {
        return Err("向量不能为空".to_string());
    }
    if a.len() != b.len() {
        return Err("向量维度不匹配".to_string());
    }
    
    let mut dot_product = 0.0_f32;
    let mut norm_a = 0.0_f32;
    let mut norm_b = 0.0_f32;
    
    for (av, bv) in a.iter().zip(b.iter()) {
        dot_product += av * bv;
        norm_a += av * av;
        norm_b += bv * bv;
    }
    
    if norm_a == 0.0 || norm_b == 0.0 {
        return Ok(0.0);
    }
    
    Ok(dot_product / (norm_a.sqrt() * norm_b.sqrt()))
}

/// 计算最大内积
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// 
/// # 返回
/// 最大内积值
pub fn compute_maximum_inner_product(a: &[f32], b: &[f32]) -> Result<f32, String> {
    if a.is_empty() || b.is_empty() {
        return Err("向量不能为空".to_string());
    }
    if a.len() != b.len() {
        return Err("向量维度不匹配".to_string());
    }
    
    let dot_product: f32 = a.iter()
        .zip(b.iter())
        .map(|(av, bv)| av * bv)
        .sum();
    
    Ok(dot_product)
}

/// 统一的相似性计算接口
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// * `similarity_function` - 相似性函数类型
/// 
/// # 返回
/// 相似性分数
pub fn compute_similarity(
    a: &[f32],
    b: &[f32],
    similarity_function: SimilarityFunction,
) -> Result<f32, String> {
    match similarity_function {
        SimilarityFunction::Euclidean => compute_euclidean_similarity(a, b),
        SimilarityFunction::Cosine => compute_cosine_similarity(a, b),
        SimilarityFunction::MaximumInnerProduct => compute_maximum_inner_product(a, b),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_euclidean_distance() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];
        let distance = compute_euclidean_distance(&a, &b).unwrap();
        // sqrt((3^2 + 3^2 + 3^2)) = sqrt(27) ≈ 5.196
        assert!((distance - 5.196).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = compute_cosine_similarity(&a, &b).unwrap();
        assert_eq!(similarity, 1.0);

        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let similarity = compute_cosine_similarity(&a, &b).unwrap();
        assert_eq!(similarity, 0.0);
    }

    #[test]
    fn test_maximum_inner_product() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];
        let product = compute_maximum_inner_product(&a, &b).unwrap();
        // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
        assert_eq!(product, 32.0);
    }
}
