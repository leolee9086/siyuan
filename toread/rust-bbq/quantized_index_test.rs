/// 量化索引测试
/// 
/// 测试量化索引的构建和查询功能

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vector_utils::create_random_vector;
    use crate::quantized_index::{QuantizedIndex, QuantizedIndexConfig};
    use crate::vector_similarity::SimilarityFunction;

    #[test]
    fn test_quantized_index_basic_functionality() {
        // 创建量化索引
        let mut index = QuantizedIndex::new(QuantizedIndexConfig::default());
        
        // 创建测试向量
        let vectors: Vec<Vec<f32>> = (0..100)
            .map(|_| create_random_vector(128, -1.0, 1.0))
            .collect();
        
        // 构建索引
        let quantized_vectors = index.build_index(&vectors).unwrap();
        
        // 验证索引构建成功
        assert_eq!(quantized_vectors.size(), 100);
        assert_eq!(quantized_vectors.dimension(), 128);
        
        // 测试查询功能
        let query_vector = create_random_vector(128, -1.0, 1.0);
        let results = index.search_nearest_neighbors(&query_vector, 5).unwrap();
        
        // 验证查询结果
        assert_eq!(results.len(), 5);
        
        // 验证结果按分数降序排列
        for i in 1..results.len() {
            assert!(results[i-1].score >= results[i].score);
        }
        
        // 验证索引有效性
        assert!(results[0].index < 100);
    }

    #[test]
    fn test_quantized_index_different_configurations() {
        // 测试不同的配置
        let configs = vec![
            QuantizedIndexConfig {
                query_bits: 4,
                index_bits: 1,
                similarity_function: SimilarityFunction::Cosine,
                lambda: Some(0.1),
                iters: Some(10),
            },
            QuantizedIndexConfig {
                query_bits: 1,
                index_bits: 1,
                similarity_function: SimilarityFunction::Euclidean,
                lambda: None,
                iters: None,
            },
        ];
        
        for config in configs {
            let mut index = QuantizedIndex::new(config.clone());
            
            // 创建小规模测试向量
            let vectors: Vec<Vec<f32>> = (0..10)
                .map(|_| create_random_vector(64, -1.0, 1.0))
                .collect();
            
            // 构建索引
            let quantized_vectors = index.build_index(&vectors).unwrap();
            assert_eq!(quantized_vectors.size(), 10);
            
            // 测试查询
            let query_vector = create_random_vector(64, -1.0, 1.0);
            let results = index.search_nearest_neighbors(&query_vector, 3).unwrap();
            assert_eq!(results.len(), 3);
        }
    }

    #[test]
    fn test_quantized_index_edge_cases() {
        let mut index = QuantizedIndex::new(QuantizedIndexConfig::default());
        
        // 测试空向量集合
        let empty_vectors: Vec<Vec<f32>> = vec![];
        let result = index.build_index(&empty_vectors);
        assert!(result.is_err());
        
        // 测试单向量
        let single_vector = vec![create_random_vector(32, -1.0, 1.0)];
        let quantized_vectors = index.build_index(&single_vector).unwrap();
        assert_eq!(quantized_vectors.size(), 1);
        
        // 测试查询k=0
        let query_vector = create_random_vector(32, -1.0, 1.0);
        let results = index.search_nearest_neighbors(&query_vector, 0).unwrap();
        assert_eq!(results.len(), 0);
        
        // 测试查询k大于向量数量
        let results = index.search_nearest_neighbors(&query_vector, 10).unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_quantized_index_query_validation() {
        let mut index = QuantizedIndex::new(QuantizedIndexConfig::default());
        
        let vectors: Vec<Vec<f32>> = (0..10)
            .map(|_| create_random_vector(32, -1.0, 1.0))
            .collect();
        
        index.build_index(&vectors).unwrap();
        
        // 测试错误维度的查询向量
        let wrong_query = create_random_vector(16, -1.0, 1.0); // 错误维度
        let result = index.search_nearest_neighbors(&wrong_query, 3);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("查询向量维度与索引维度不匹配"));
        
        // 测试空查询向量
        let empty_query: Vec<f32> = vec![];
        let result = index.search_nearest_neighbors(&empty_query, 3);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("查询向量不能为空"));
    }
}