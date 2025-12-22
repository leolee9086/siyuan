/// 优化的标量量化器
/// 对应TypeScript中的optimizedScalarQuantizer.ts
/// 
/// 基于Lucene的二值量化实现
/// 实现了各向异性损失函数和坐标下降优化算法

use crate::constants::{DEFAULT_LAMBDA, DEFAULT_ITERS, MINIMUM_MSE_GRID, NUMERICAL_CONSTANTS};
use crate::vector_similarity::SimilarityFunction;
use crate::vector_utils::compute_dot_product;

/// 量化结果结构体
#[derive(Debug, Clone)]
pub struct QuantizationResult {
    pub lower_interval: f32,
    pub upper_interval: f32,
    pub additional_correction: f32,
    pub quantized_component_sum: f32,
}

/// 优化的标量量化器结构体
pub struct OptimizedScalarQuantizer {
    lambda: f32,
    iters: usize,
    similarity_function: SimilarityFunction,
}

impl OptimizedScalarQuantizer {
    /// 创建新的量化器实例
    pub fn new(
        lambda: Option<f32>,
        iters: Option<usize>,
        similarity_function: Option<SimilarityFunction>,
    ) -> Self {
        Self {
            lambda: lambda.unwrap_or(DEFAULT_LAMBDA as f32),
            iters: iters.unwrap_or(DEFAULT_ITERS as usize),
            similarity_function: similarity_function.unwrap_or(SimilarityFunction::Euclidean),
        }
    }

    /// 标量量化
    /// 对单个向量进行标量量化
    /// 
    /// # 参数
    /// * `vector` - 输入向量
    /// * `destination` - 量化结果存储数组（会被修改）
    /// * `bits` - 量化位数
    /// * `centroid` - 质心向量
    /// 
    /// # 返回
    /// 量化结果元数据
    pub fn scalar_quantize(
        &self,
        vector: &[f32],
        destination: &mut [u8],
        bits: u8,
        centroid: &[f32],
    ) -> Result<QuantizationResult, String> {
        // 输入验证
        if vector.len() != centroid.len() {
            return Err("向量和质心维度不匹配".to_string());
        }
        if destination.len() != vector.len() {
            return Err("目标数组长度与向量长度不匹配".to_string());
        }
        if bits < 1 || bits > 8 {
            return Err("位数必须在1-8之间".to_string());
        }

        // 1. 计算原始向量与质心的点积（用于非欧氏距离的additionalCorrection）
        let mut centroid_dot = 0.0;
        if self.similarity_function != SimilarityFunction::Euclidean {
            centroid_dot = compute_dot_product(vector, centroid);
        }

        // 2. 质心中心化并计算统计信息
        let mut working_vector = vec![0.0; vector.len()];
        let mut min = f32::MAX;
        let mut max = f32::MIN;
        let mut sum = 0.0;
        let mut sum_sq = 0.0;

        for i in 0..vector.len() {
            let centered_val = vector[i] - centroid[i];
            working_vector[i] = centered_val;
            
            if centered_val < min { min = centered_val; }
            if centered_val > max { max = centered_val; }
            
            sum += centered_val;
            sum_sq += centered_val * centered_val;
        }

        let vec_mean = sum / vector.len() as f32;
        
        // 计算标准差
        let mut variance_sum = 0.0;
        for &val in &working_vector {
            let diff = val - vec_mean;
            variance_sum += diff * diff;
        }
        let vec_std = (variance_sum / vector.len() as f32).sqrt();
        let norm2 = sum_sq; // L2范数的平方

        // 4. 获取初始间隔
        let mut interval = self.get_initial_interval(bits, vec_std, vec_mean, min, max)?;

        // 5. 优化间隔
        self.optimize_intervals(&mut interval, &working_vector, norm2, 1 << bits);

        // 6. 量化向量并计算 quantizedComponentSum
        let (a, b) = interval;
        let points = 1 << bits;
        let n_steps = points - 1;
        let step = if n_steps > 0 { (b - a) / n_steps as f32 } else { 0.0 };
        let step_inv = if step > 0.0 { 1.0 / step } else { 0.0 };
        let mut quantized_component_sum = 0.0;

        for i in 0..working_vector.len() {
            let xi = working_vector[i];
            let clamped = xi.clamp(a, b);

            if bits == 1 {
                // 1bit量化：使用阈值二值化
                let threshold = (a + b) / 2.0;
                let quantized_value = if clamped >= threshold { 1 } else { 0 };
                destination[i] = quantized_value;
                quantized_component_sum += quantized_value as f32;
            } else {
                // 其他位数：使用原有的四舍五入方法
                let assignment = ((clamped - a) * step_inv).round();
                let quantized_value = assignment.min(n_steps as f32) as u8;
                destination[i] = quantized_value;
                quantized_component_sum += assignment;
            }
        }

        // 7. 根据相似性函数类型设置正确的additionalCorrection
        let final_additional_correction = if self.similarity_function == SimilarityFunction::Euclidean {
            norm2
        } else {
            centroid_dot
        };

        Ok(QuantizationResult {
            lower_interval: interval.0,
            upper_interval: interval.1,
            additional_correction: final_additional_correction,
            quantized_component_sum,
        })
    }

    /// 获取初始量化区间
    fn get_initial_interval(
        &self,
        bits: u8,
        std: f32,
        vec_mean: f32,
        min: f32,
        max: f32,
    ) -> Result<(f32, f32), String> {
        if bits < 1 || bits > 8 {
            return Err(format!("位数必须在1-8之间，当前为{}", bits));
        }
        
        let grid_idx = (bits - 1) as usize;
        if grid_idx >= MINIMUM_MSE_GRID.len() {
            return Err(format!("未找到位数 {} 对应的网格配置", bits));
        }

        let grid = &MINIMUM_MSE_GRID[grid_idx];
        let grid0 = grid[0] as f32;
        let grid1 = grid[1] as f32;

        Ok((
            (grid0 * std + vec_mean).clamp(min, max),
            (grid1 * std + vec_mean).clamp(min, max)
        ))
    }

    /// 优化间隔
    fn optimize_intervals(
        &self,
        interval: &mut (f32, f32),
        vector: &[f32],
        norm2: f32,
        points: i32,
    ) {
        let mut initial_loss = self.compute_loss(vector, *interval, points, norm2);
        let scale = (1.0 - self.lambda) / norm2;

        if !scale.is_finite() {
            return;
        }

        for _ in 0..self.iters {
            let (a, b) = *interval;
            let step_inv = (points - 1) as f32 / (b - a);

            let mut daa = 0.0;
            let mut dab = 0.0;
            let mut dbb = 0.0;
            let mut dax = 0.0;
            let mut dbx = 0.0;

            for &xi in vector {
                let clamped = xi.clamp(a, b);
                let k = ((clamped - a) * step_inv).round();
                let s = k / (points - 1) as f32;

                daa += (1.0 - s) * (1.0 - s);
                dab += (1.0 - s) * s;
                dbb += s * s;
                dax += xi * (1.0 - s);
                dbx += xi * s;
            }

            let m0 = scale * dax * dax + self.lambda * daa;
            let m1 = scale * dax * dbx + self.lambda * dab;
            let m2 = scale * dbx * dbx + self.lambda * dbb;

            let det = m0 * m2 - m1 * m1;
            if det.abs() < NUMERICAL_CONSTANTS::MIN_DETERMINANT as f32 {
                return;
            }

            let a_opt = (m2 * dax - m1 * dbx) / det;
            let b_opt = (m0 * dbx - m1 * dax) / det;

            if (interval.0 - a_opt).abs() < NUMERICAL_CONSTANTS::EPSILON as f32 &&
               (interval.1 - b_opt).abs() < NUMERICAL_CONSTANTS::EPSILON as f32 {
                return;
            }

            let new_loss = self.compute_loss(vector, (a_opt, b_opt), points, norm2);

            if new_loss > initial_loss {
                return;
            }

            *interval = (a_opt, b_opt);
            initial_loss = new_loss;
        }
    }

    /// 计算损失函数
    fn compute_loss(
        &self,
        vector: &[f32],
        interval: (f32, f32),
        points: i32,
        norm2: f32,
    ) -> f32 {
        let (a, b) = interval;
        let step = (b - a) / (points - 1) as f32;
        let step_inv = 1.0 / step;
        let mut xe = 0.0;
        let mut e = 0.0;

        for &xi in vector {
            let clamped = xi.clamp(a, b);
            let k = ((clamped - a) * step_inv).round();
            let xiq = a + step * k;

            let diff = xi - xiq;
            xe += xi * diff;
            e += diff * diff;
        }

        (1.0 - self.lambda) * xe * xe / norm2 + self.lambda * e
    }

    /// 二进制打包
    pub fn pack_as_binary(vector: &[u8], packed: &mut [u8]) -> Result<(), String> {
        let mut i = 0;
        while i < vector.len() {
            let mut result = 0u8;
            
            for j in (0..8).rev() {
                if i < vector.len() {
                    let val = vector[i];
                    if val != 0 && val != 1 {
                        return Err("1位量化值必须为0或1".to_string());
                    }
                    result |= (val & 1) << j;
                    i += 1;
                } else {
                    break;
                }
            }
            
            let index = (i - 1) / 8;
            if index >= packed.len() {
                return Err("打包数组长度不足".to_string());
            }
            packed[index] = result;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scalar_quantize_1bit() {
        let quantizer = OptimizedScalarQuantizer::new(None, None, None);
        let vector = vec![1.0, -1.0, 0.5, -0.5];
        let centroid = vec![0.0, 0.0, 0.0, 0.0];
        let mut dest = vec![0u8; 4];
        
        let result = quantizer.scalar_quantize(&vector, &mut dest, 1, &centroid).unwrap();
        
        // 验证量化结果
        // 1.0 -> 1, -1.0 -> 0, 0.5 -> 1, -0.5 -> 0
        assert_eq!(dest, vec![1, 0, 1, 0]);
        assert_eq!(result.quantized_component_sum, 2.0);
    }

    #[test]
    fn test_pack_as_binary() {
        let vector = vec![1, 0, 1, 0, 1, 0, 1, 0];
        let mut packed = vec![0u8; 1];
        OptimizedScalarQuantizer::pack_as_binary(&vector, &mut packed).unwrap();
        assert_eq!(packed[0], 0b10101010);
    }
}
