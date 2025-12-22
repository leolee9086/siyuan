/// 量化索引结构
/// 对应TypeScript中的BinaryQuantizationFormat
/// 
/// 实现完整的二值量化索引系统，包括：
/// - 索引构建
/// - 查询功能
/// - TopK搜索
/// - 批量计算优化

use crate::constants::{QUERY_BITS, INDEX_BITS};
use crate::vector_similarity::SimilarityFunction;
use crate::optimized_scalar_quantizer::{OptimizedScalarQuantizer, QuantizationResult};
use crate::binary_quantized_scorer::BinaryQuantizedScorer;
use crate::vector_utils::{compute_centroid, normalize_vector};

/// 量化向量值接口
pub trait QuantizedVectorValues {
    /// 获取向量维度
    fn dimension(&self) -> usize;
    
    /// 获取向量数量
    fn size(&self) -> usize;
    
    /// 获取量化向量值
    fn vector_value(&self, ord: usize) -> &[u8];
    
    /// 获取未打包的1位向量（用于4位查询）
    fn get_unpacked_vector(&self, ord: usize) -> &[u8];
    
    /// 获取修正项
    fn get_corrective_terms(&self, ord: usize) -> &QuantizationResult;
    
    /// 获取质心向量
    fn get_centroid(&self) -> &[f32];
    
    /// 计算查询向量与质心的点积
    fn get_centroid_dp(&self, query_vector: Option<&[f32]>) -> f32;
}

/// 量化向量值实现
pub struct QuantizedVectorValuesImpl {
    /// 量化向量数组（打包格式）
    vectors: Vec<Vec<u8>>,
    /// 未打包的1位向量数组（用于4位查询）
    unpacked_vectors: Vec<Vec<u8>>,
    /// 修正项数组
    corrections: Vec<QuantizationResult>,
    /// 质心向量
    centroid: Vec<f32>,
    /// 向量维度
    dimension: usize,
}

impl QuantizedVectorValuesImpl {
    /// 创建新的量化向量值实例
    pub fn new(
        vectors: Vec<Vec<u8>>,
        unpacked_vectors: Vec<Vec<u8>>,
        corrections: Vec<QuantizationResult>,
        centroid: Vec<f32>,
    ) -> Self {
        let dimension = centroid.len();
        Self {
            vectors,
            unpacked_vectors,
            corrections,
            centroid,
            dimension,
        }
    }
}

impl QuantizedVectorValues for QuantizedVectorValuesImpl {
    fn dimension(&self) -> usize {
        self.dimension
    }
    
    fn size(&self) -> usize {
        self.vectors.len()
    }
    
    fn vector_value(&self, ord: usize) -> &[u8] {
        &self.vectors[ord]
    }
    
    fn get_unpacked_vector(&self, ord: usize) -> &[u8] {
        &self.unpacked_vectors[ord]
    }
    
    fn get_corrective_terms(&self, ord: usize) -> &QuantizationResult {
        &self.corrections[ord]
    }
    
    fn get_centroid(&self) -> &[f32] {
        &self.centroid
    }
    
    fn get_centroid_dp(&self, query_vector: Option<&[f32]>) -> f32 {
        if let Some(qv) = query_vector {
            crate::vector_utils::compute_dot_product(qv, &self.centroid)
        } else {
            crate::vector_utils::compute_dot_product(&self.centroid, &self.centroid)
        }
    }
}

/// 查询结果
#[derive(Debug, Clone)]
pub struct QueryResult {
    /// 向量索引
    pub index: usize,
    /// 相似性分数
    pub score: f32,
    /// 原始分数（可选）
    pub original_score: Option<f32>,
}

/// 量化索引配置
#[derive(Debug, Clone)]
pub struct QuantizedIndexConfig {
    /// 查询向量位数（默认4）
    pub query_bits: u8,
    /// 索引向量位数（默认1）
    pub index_bits: u8,
    /// 相似性函数
    pub similarity_function: SimilarityFunction,
    /// 各向异性权重（默认0.1）
    pub lambda: Option<f32>,
    /// 优化迭代次数（默认5）
    pub iters: Option<usize>,
}

impl Default for QuantizedIndexConfig {
    fn default() -> Self {
        Self {
            query_bits: QUERY_BITS,
            index_bits: INDEX_BITS,
            similarity_function: SimilarityFunction::Cosine,
            lambda: None,
            iters: None,
        }
    }
}

/// 量化索引结构
pub struct QuantizedIndex {
    /// 索引配置
    config: QuantizedIndexConfig,
    /// 标量量化器
    quantizer: OptimizedScalarQuantizer,
    /// 二值量化评分器
    scorer: BinaryQuantizedScorer,
    /// 量化向量值
    quantized_vectors: Option<Box<dyn QuantizedVectorValues>>,
}

impl QuantizedIndex {
    /// 创建新的量化索引实例
    pub fn new(config: QuantizedIndexConfig) -> Result<Self, String> {
        // 验证配置参数
        if config.query_bits < 1 || config.query_bits > 8 {
            return Err("query_bits必须在1-8之间".to_string());
        }
        if config.index_bits < 1 || config.index_bits > 8 {
            return Err("index_bits必须在1-8之间".to_string());
        }

        let quantizer = OptimizedScalarQuantizer::new(
            config.lambda,
            config.iters,
            Some(config.similarity_function),
        );

        let scorer = BinaryQuantizedScorer::new(config.similarity_function);

        Ok(Self {
            config,
            quantizer,
            scorer,
            quantized_vectors: None,
        })
    }

    /// 构建索引
    /// 
    /// # 参数
    /// * `vectors` - 原始向量集合
    /// 
    /// # 返回
    /// 量化向量值
    pub fn build_index(&mut self, vectors: &[Vec<f32>]) -> Result<&dyn QuantizedVectorValues, String> {
        if vectors.is_empty() {
            return Err("向量集合不能为空".to_string());
        }

        // 标准化向量（如果使用余弦相似度）
        let processed_vectors = if self.config.similarity_function == SimilarityFunction::Cosine {
            vectors.iter()
                .map(|vec| {
                    let mut vec_copy = vec.clone();
                    normalize_vector(&mut vec_copy);
                    vec_copy
                })
                .collect()
        } else {
            vectors.to_vec()
        };

        let first_vector = &processed_vectors[0];
        let dimension = first_vector.len();

        // 检查所有向量维度是否一致
        for (i, vector) in processed_vectors.iter().enumerate() {
            if vector.len() != dimension {
                return Err(format!(
                    "向量 {} 维度 {} 与第一个向量维度 {} 不匹配",
                    i, vector.len(), dimension
                ));
            }
        }

        // 检查向量值是否有效
        for (i, vector) in processed_vectors.iter().enumerate() {
            for (j, &val) in vector.iter().enumerate() {
                if !val.is_finite() {
                    return Err(format!(
                        "向量 {} 位置 {} 包含无效值: {}",
                        i, j, val
                    ));
                }
            }
        }

        // 1. 计算质心
        let centroid = compute_centroid(&processed_vectors)?;

        // 2. 量化所有向量
        let mut quantized_vectors = Vec::with_capacity(processed_vectors.len());
        let mut unpacked_vectors = Vec::with_capacity(processed_vectors.len());
        let mut corrections = Vec::with_capacity(processed_vectors.len());

        for vector in &processed_vectors {
            // 量化索引向量
            let mut quantized_vector = vec![0u8; dimension];
            let correction = self.quantizer.scalar_quantize(
                vector,
                &mut quantized_vector,
                self.config.index_bits,
                &centroid,
            )?;

            // 根据量化位数选择正确的处理方法
            let processed_vector = if self.config.index_bits == 1 {
                // 1位索引量化：使用二进制打包
                let packed_size = (dimension + 7) / 8;
                let mut packed_vector = vec![0u8; packed_size];
                OptimizedScalarQuantizer::pack_as_binary(&quantized_vector, &mut packed_vector)
                    .map_err(|e| format!("二进制打包失败: {}", e))?;
                
                // 保存未打包的1位向量（用于4位查询）
                unpacked_vectors.push(quantized_vector.clone());
                packed_vector
            } else {
                // 其他位数：直接使用量化结果
                unpacked_vectors.push(quantized_vector.clone());
                quantized_vector
            };

            quantized_vectors.push(processed_vector);
            corrections.push(correction);
        }

        // 3. 创建量化向量值对象
        let quantized_values = Box::new(QuantizedVectorValuesImpl::new(
            quantized_vectors,
            unpacked_vectors,
            corrections,
            centroid,
        ));

        self.quantized_vectors = Some(quantized_values);
        Ok(self.quantized_vectors.as_ref().unwrap().as_ref())
    }

    /// 量化查询向量
    ///
    /// # 参数
    /// * `query_vector` - 查询向量
    /// * `centroid` - 质心向量
    ///
    /// # 返回
    /// 量化结果
    pub fn quantize_query_vector(
        &self,
        query_vector: &[f32],
        centroid: &[f32],
    ) -> Result<(Vec<u8>, QuantizationResult), String> {
        // 标准化查询向量（如果使用余弦相似度）
        let processed_query_vector = if self.config.similarity_function == SimilarityFunction::Cosine {
            let mut query_copy = query_vector.to_vec();
            normalize_vector(&mut query_copy);
            query_copy
        } else {
            query_vector.to_vec()
        };

        let dimension = processed_query_vector.len();
        let mut quantized_query = vec![0u8; dimension];

        let query_corrections = self.quantizer.scalar_quantize(
            &processed_query_vector,
            &mut quantized_query,
            self.config.query_bits,
            centroid,
        )?;

        // 修复：根据查询位数正确处理向量格式
        let final_quantized_query = if self.config.query_bits == 1 {
            // 1位查询：保持未打包格式，用于批量计算时的打包
            quantized_query
        } else {
            // 4位查询：直接使用量化结果
            quantized_query
        };

        Ok((final_quantized_query, query_corrections))
    }

    /// 搜索最近邻
    /// 
    /// # 参数
    /// * `query_vector` - 查询向量
    /// * `k` - 返回的最近邻数量
    /// 
    /// # 返回
    /// 查询结果数组
    pub fn search_nearest_neighbors(
        &self,
        query_vector: &[f32],
        k: usize,
    ) -> Result<Vec<QueryResult>, String> {
        let quantized_vectors = self.quantized_vectors.as_ref()
            .ok_or("索引未构建，请先调用build_index")?;

        // 参数验证
        if query_vector.is_empty() {
            return Err("查询向量不能为空".to_string());
        }
        if k == 0 {
            return Ok(Vec::new());
        }
        if query_vector.len() != quantized_vectors.dimension() {
            return Err("查询向量维度与索引维度不匹配".to_string());
        }

        let centroid = quantized_vectors.get_centroid();

        // 1. 量化查询向量
        let (quantized_query, query_corrections) = self.quantize_query_vector(
            query_vector,
            centroid,
        )?;

        // 2. 计算所有目标向量的分数
        let vector_count = quantized_vectors.size();
        let k = k.min(vector_count);

        // 批量计算分数
        let batch_size = 1000;
        let mut all_results = Vec::with_capacity(vector_count);

        for batch_start in (0..vector_count).step_by(batch_size) {
            let batch_end = (batch_start + batch_size).min(vector_count);
            let batch_indices: Vec<usize> = (batch_start..batch_end).collect();

            // 准备批量数据
            // 关键修复：对于1位索引，需要使用打包后的向量格式
            let batch_vectors: Vec<Vec<u8>> = if self.config.index_bits == 1 {
                // 1位索引：使用打包后的向量
                batch_indices.iter()
                    .map(|&idx| quantized_vectors.vector_value(idx).to_vec())
                    .collect()
            } else {
                // 其他位数：使用未打包的向量
                batch_indices.iter()
                    .map(|&idx| quantized_vectors.get_unpacked_vector(idx).to_vec())
                    .collect()
            };
            
            let batch_corrections: Vec<QuantizationResult> = batch_indices.iter()
                .map(|&idx| quantized_vectors.get_corrective_terms(idx).clone())
                .collect();

            let batch_results = self.scorer.compute_batch_quantized_scores(
                &quantized_query,
                &query_corrections,
                &batch_vectors,
                &batch_corrections,
                &batch_indices,
                self.config.query_bits,
                quantized_vectors.dimension(),
                quantized_vectors.get_centroid_dp(Some(query_vector)),
            )?;

            for (i, result) in batch_results.into_iter().enumerate() {
                all_results.push((batch_start + i, result.score));
            }
        }

        // 3. 使用部分排序找到前k个最大值
        all_results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // 4. 构建结果
        let top_k_results: Vec<QueryResult> = all_results
            .into_iter()
            .take(k)
            .map(|(index, score)| QueryResult {
                index,
                score,
                original_score: None,
            })
            .collect();

        Ok(top_k_results)
    }

    /// 获取配置
    pub fn get_config(&self) -> &QuantizedIndexConfig {
        &self.config
    }

    /// 获取量化器
    pub fn get_quantizer(&self) -> &OptimizedScalarQuantizer {
        &self.quantizer
    }

    /// 获取评分器
    pub fn get_scorer(&self) -> &BinaryQuantizedScorer {
        &self.scorer
    }

    /// 获取量化向量值
    pub fn get_quantized_vectors(&self) -> Option<&dyn QuantizedVectorValues> {
        self.quantized_vectors.as_ref().map(|qv| qv.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vector_utils::create_random_vector;

    #[test]
    fn test_quantized_index_creation() {
        let config = QuantizedIndexConfig::default();
        let index = QuantizedIndex::new(config);
        assert_eq!(index.get_config().query_bits, 4);
        assert_eq!(index.get_config().index_bits, 1);
    }

    #[test]
    fn test_build_index() {
        let mut index = QuantizedIndex::new(QuantizedIndexConfig::default());
        
        // 创建测试向量
        let vectors: Vec<Vec<f32>> = (0..10)
            .map(|_| create_random_vector(128, -1.0, 1.0))
            .collect();
        
        let quantized_vectors = index.build_index(&vectors).unwrap();
        assert_eq!(quantized_vectors.size(), 10);
        assert_eq!(quantized_vectors.dimension(), 128);
    }

    #[test]
    fn test_search_nearest_neighbors() {
        let mut index = QuantizedIndex::new(QuantizedIndexConfig::default());
        
        // 创建测试向量
        let vectors: Vec<Vec<f32>> = (0..100)
            .map(|_| create_random_vector(64, -1.0, 1.0))
            .collect();
        
        index.build_index(&vectors).unwrap();
        
        let query_vector = create_random_vector(64, -1.0, 1.0);
        let results = index.search_nearest_neighbors(&query_vector, 5).unwrap();
        
        assert_eq!(results.len(), 5);
        
        // 验证结果按分数降序排列
        for i in 1..results.len() {
            assert!(results[i-1].score >= results[i].score);
        }
    }
}