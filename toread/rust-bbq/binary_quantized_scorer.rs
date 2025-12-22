/// 二值量化评分器
/// 对应TypeScript中的binaryQuantizedScorer.ts
/// 
/// 实现量化向量的相似性计算
/// 基于Lucene的二值量化实现

use crate::constants::FOUR_BIT_SCALE;
use crate::vector_similarity::SimilarityFunction;
use crate::optimized_scalar_quantizer::QuantizationResult;
use crate::bitwise_dot_product::{compute_int1_bit_dot_product, compute_int4_bit_dot_product};
use crate::batch_dot_product::{
    compute_batch_four_bit_dot_product_direct_packed,
    compute_batch_one_bit_dot_product_direct_packed,
    create_direct_packed_buffer,
};


/// 量化评分结果
#[derive(Debug, Clone)]
pub struct QuantizedScoreResult {
    pub score: f32,
    pub bit_dot_product: i32,
    pub query_corrections: QuantizationResult,
    pub index_corrections: QuantizationResult,
}

/// 二值量化评分器结构体
pub struct BinaryQuantizedScorer {
    similarity_function: SimilarityFunction,
}

impl BinaryQuantizedScorer {
    /// 创建新的评分器实例
    pub fn new(similarity_function: SimilarityFunction) -> Self {
        Self { similarity_function }
    }

    /// 计算量化相似性分数
    pub fn compute_quantized_score(
        &self,
        quantized_query: &[u8],
        query_corrections: &QuantizationResult,
        quantized_index: &[u8],
        index_corrections: &QuantizationResult,
        query_bits: u8,
        dimension: usize,
        centroid_dp: f32,
        _original_query_vector: Option<&[f32]>,
    ) -> Result<QuantizedScoreResult, String> {
        if query_bits == 1 {
            // 1位量化：使用单比特相似性计算
            self.compute_one_bit_quantized_score(
                quantized_query,
                query_corrections,
                quantized_index,
                index_corrections,
                dimension,
                centroid_dp,
            )
        } else if query_bits == 4 {
            // 4位查询 + 1位索引：使用4位-1位相似性计算
            self.compute_four_bit_quantized_score(
                quantized_query,
                query_corrections,
                quantized_index,
                index_corrections,
                dimension,
                centroid_dp,
            )
        } else {
            Err(format!("不支持的查询位数: {}，只支持1位和4位", query_bits))
        }
    }

    /// 计算1位量化相似性分数
    fn compute_one_bit_quantized_score(
        &self,
        quantized_query: &[u8],
        query_corrections: &QuantizationResult,
        quantized_index: &[u8],
        index_corrections: &QuantizationResult,
        dimension: usize,
        centroid_dp: f32,
    ) -> Result<QuantizedScoreResult, String> {
        // 计算位运算点积
        let qc_dist = compute_int1_bit_dot_product(quantized_query, quantized_index)?;

        // 计算相似性分数
        let score = self.compute_one_bit_similarity_score(
            qc_dist,
            query_corrections,
            index_corrections,
            dimension,
            centroid_dp,
        );

        Ok(QuantizedScoreResult {
            score,
            bit_dot_product: qc_dist,
            query_corrections: query_corrections.clone(),
            index_corrections: index_corrections.clone(),
        })
    }

    /// 计算4位查询+1位索引相似性分数
    fn compute_four_bit_quantized_score(
        &self,
        quantized_query: &[u8],
        query_corrections: &QuantizationResult,
        quantized_index: &[u8],
        index_corrections: &QuantizationResult,
        dimension: usize,
        centroid_dp: f32,
    ) -> Result<QuantizedScoreResult, String> {
        // 计算位运算点积
        let qc_dist = compute_int4_bit_dot_product(quantized_query, quantized_index)?;

        // 计算相似性分数
        let score = self.compute_four_bit_similarity_score(
            qc_dist,
            query_corrections,
            index_corrections,
            dimension,
            centroid_dp,
        );

        Ok(QuantizedScoreResult {
            score,
            bit_dot_product: qc_dist,
            query_corrections: query_corrections.clone(),
            index_corrections: index_corrections.clone(),
        })
    }

    /// 计算1位量化相似性分数（底层实现）
    fn compute_one_bit_similarity_score(
        &self,
        qc_dist: i32,
        query_corrections: &QuantizationResult,
        index_corrections: &QuantizationResult,
        dimension: usize,
        centroid_dp: f32,
    ) -> f32 {
        let x1 = index_corrections.quantized_component_sum;
        let ax = index_corrections.lower_interval;
        let lx = index_corrections.upper_interval - ax;
        let ay = query_corrections.lower_interval;
        let ly = query_corrections.upper_interval - ay;
        let y1 = query_corrections.quantized_component_sum;

        let mut score = ax * ay * dimension as f32 +
            ay * lx * x1 +
            ax * ly * y1 +
            lx * ly * qc_dist as f32;

        match self.similarity_function {
            SimilarityFunction::Euclidean => {
                score = query_corrections.additional_correction +
                    index_corrections.additional_correction -
                    2.0 * score;
                (1.0 / (1.0 + score)).max(0.0)
            }
            SimilarityFunction::Cosine => {
                score += query_corrections.additional_correction +
                    index_corrections.additional_correction -
                    centroid_dp;
                ((1.0 + score) / 2.0).max(0.0)
            }
            SimilarityFunction::MaximumInnerProduct => {
                score += query_corrections.additional_correction +
                    index_corrections.additional_correction -
                    centroid_dp;
                scale_max_inner_product_score(score)
            }
        }
    }

    /// 计算4位量化相似性分数（底层实现）
    fn compute_four_bit_similarity_score(
        &self,
        qc_dist: i32,
        query_corrections: &QuantizationResult,
        index_corrections: &QuantizationResult,
        dimension: usize,
        centroid_dp: f32,
    ) -> f32 {
        let x1 = index_corrections.quantized_component_sum;
        let ax = index_corrections.lower_interval;
        let lx = index_corrections.upper_interval - ax;
        let ay = query_corrections.lower_interval;
        let ly = (query_corrections.upper_interval - ay) * FOUR_BIT_SCALE;
        let y1 = query_corrections.quantized_component_sum;

        let score = ax * ay * dimension as f32 +
            ay * lx * x1 +
            ax * ly * y1 +
            lx * ly * qc_dist as f32;

        match self.similarity_function {
            SimilarityFunction::Euclidean => {
                let euclidean_score = query_corrections.additional_correction +
                    index_corrections.additional_correction -
                    2.0 * score;
                (1.0 / (1.0 + euclidean_score)).max(0.0)
            }
            SimilarityFunction::Cosine | SimilarityFunction::MaximumInnerProduct => {
                let adjusted_score = score + query_corrections.additional_correction +
                    index_corrections.additional_correction -
                    centroid_dp;

                if self.similarity_function == SimilarityFunction::MaximumInnerProduct {
                    scale_max_inner_product_score(adjusted_score)
                } else {
                    ((1.0 + adjusted_score) / 2.0).max(0.0)
                }
            }
        }
    }

    /// 批量计算量化相似性分数
    pub fn compute_batch_quantized_scores(
        &self,
        quantized_query: &[u8],
        query_corrections: &QuantizationResult,
        target_vectors: &[Vec<u8>],
        target_corrections: &[QuantizationResult],
        target_ords: &[usize],
        query_bits: u8,
        dimension: usize,
        centroid_dp: f32,
    ) -> Result<Vec<QuantizedScoreResult>, String> {
        let mut results = Vec::with_capacity(target_ords.len());

        if query_bits == 4 {
            // 4位量化：使用批量优化算法
            let packed_vector_size = (dimension + 7) / 8;
            let direct_packed_buffer = create_direct_packed_buffer(target_vectors, target_ords, packed_vector_size);
             
            let qc_dists = compute_batch_four_bit_dot_product_direct_packed(
                quantized_query,
                &direct_packed_buffer,
                target_ords.len(),
                dimension,
            );

            for (i, &qc_dist) in qc_dists.iter().enumerate() {
                let index_corrections = &target_corrections[i];
                let score = self.compute_four_bit_similarity_score(
                    qc_dist,
                    query_corrections,
                    index_corrections,
                    dimension,
                    centroid_dp,
                );

                results.push(QuantizedScoreResult {
                    score,
                    bit_dot_product: qc_dist,
                    query_corrections: query_corrections.clone(),
                    index_corrections: index_corrections.clone(),
                });
            }
        } else if query_bits == 1 {
            // 1位量化：需要特殊处理向量格式
            // 1. 创建打包的查询向量
            let packed_query_size = (dimension + 7) / 8;
            let mut packed_query = vec![0u8; packed_query_size];
            crate::optimized_scalar_quantizer::OptimizedScalarQuantizer::pack_as_binary(
                quantized_query,
                &mut packed_query
            ).map_err(|e| format!("查询向量打包失败: {}", e))?;

            // 2. 创建直接打包的目标向量缓冲区
            let direct_packed_buffer = create_direct_packed_buffer(target_vectors, target_ords, packed_query_size);

            // 3. 使用批量1位点积计算
            let qc_dists = compute_batch_one_bit_dot_product_direct_packed(
                &packed_query,
                &direct_packed_buffer,
                target_ords.len(),
                packed_query_size,
            );

            for (i, &qc_dist) in qc_dists.iter().enumerate() {
                let index_corrections = &target_corrections[i];
                let score = self.compute_one_bit_similarity_score(
                    qc_dist,
                    query_corrections,
                    index_corrections,
                    dimension,
                    centroid_dp,
                );

                results.push(QuantizedScoreResult {
                    score,
                    bit_dot_product: qc_dist,
                    query_corrections: query_corrections.clone(),
                    index_corrections: index_corrections.clone(),
                });
            }
        } else {
            // 其他位数：回退到逐个计算
            for &target_ord in target_ords {
                let result = self.compute_quantized_score(
                    quantized_query,
                    query_corrections,
                    &target_vectors[target_ord],
                    &target_corrections[target_ord],
                    query_bits,
                    dimension,
                    centroid_dp,
                    None,
                )?;
                results.push(result);
            }
        }

        Ok(results)
    }
}

/// 缩放最大内积分数
fn scale_max_inner_product_score(score: f32) -> f32 {
    if score < 0.0 {
        1.0 / (1.0 - score)
    } else {
        score + 1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scale_max_inner_product_score() {
        assert_eq!(scale_max_inner_product_score(1.0), 2.0);
        assert_eq!(scale_max_inner_product_score(-1.0), 0.5);
    }
}
