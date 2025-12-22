/// 向量工具函数
/// 对应TypeScript中的vectorUtils.ts

/// 计算向量幅度（模长）
/// 
/// # 参数
/// * `vector` - 输入向量
/// 
/// # 返回
/// 向量幅度
pub fn compute_vector_magnitude(vector: &[f32]) -> f32 {
    let sum: f32 = vector.iter()
        .map(|v| v * v)
        .sum();
    sum.sqrt()
}

/// 创建随机向量
/// 
/// # 参数
/// * `dimension` - 向量维度
/// * `min` - 最小值
/// * `max` - 最大值
/// 
/// # 返回
/// 随机向量
pub fn create_random_vector(dimension: usize, min: f32, max: f32) -> Vec<f32> {
    use std::cell::RefCell;
    thread_local! {
        static RNG: RefCell<fastrand::Rng> = RefCell::new(fastrand::Rng::new());
    }
    
    RNG.with(|rng| {
        let mut r = rng.borrow_mut();
        (0..dimension)
            .map(|_| {
                r.f32() * (max - min) + min
            })
            .collect()
    })
}

/// 创建零向量
/// 
/// # 参数
/// * `dimension` - 向量维度
/// 
/// # 返回
/// 零向量
pub fn create_zero_vector(dimension: usize) -> Vec<f32> {
    vec![0.0; dimension]
}

/// 向量归一化
/// 
/// # 参数
/// * `vector` - 输入向量（会被修改）
pub fn normalize_vector(vector: &mut [f32]) {
    let magnitude = compute_vector_magnitude(vector);
    if magnitude > 0.0 {
        for v in vector.iter_mut() {
            *v /= magnitude;
        }
    }
}

/// 计算向量集合的质心
///
/// # 参数
/// * `vectors` - 向量集合
///
/// # 返回
/// 质心向量
pub fn compute_centroid(vectors: &[Vec<f32>]) -> Result<Vec<f32>, String> {
    if vectors.is_empty() {
        return Err("向量集合不能为空".to_string());
    }

    let first_vector = &vectors[0];
    let dimension = first_vector.len();
    let mut centroid = vec![0.0; dimension];

    // 初始化质心为第一个向量
    for i in 0..dimension {
        centroid[i] = first_vector[i];
    }

    // 从第二个向量开始累加
    for vector in vectors.iter().skip(1) {
        for i in 0..dimension {
            centroid[i] += vector[i];
        }
    }

    // 除以向量数量
    let num_vectors = vectors.len() as f32;
    for i in 0..dimension {
        centroid[i] /= num_vectors;
    }

    Ok(centroid)
}

/// 计算向量点积
/// 
/// # 参数
/// * `a` - 向量a
/// * `b` - 向量b
/// 
/// # 返回
/// 点积结果
pub fn compute_dot_product(a: &[f32], b: &[f32]) -> f32 {
    a.iter()
        .zip(b.iter())
        .map(|(av, bv)| av * bv)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_magnitude() {
        let vector = vec![3.0, 4.0];
        let magnitude = compute_vector_magnitude(&vector);
        assert_eq!(magnitude, 5.0); // 3-4-5 直角三角形
    }

    #[test]
    fn test_zero_vector() {
        let vector = create_zero_vector(5);
        assert_eq!(vector.len(), 5);
        assert!(vector.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn test_normalize_vector() {
        let mut vector = vec![3.0, 4.0];
        normalize_vector(&mut vector);
        let magnitude = compute_vector_magnitude(&vector);
        assert!((magnitude - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_dot_product() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];
        let product = compute_dot_product(&a, &b);
        assert_eq!(product, 32.0); // 1*4 + 2*5 + 3*6 = 32
    }
}
