/// 批量点积优化算法
/// 对应TypeScript中的computeBatchFourBitDotProductDirectPacked.ts
/// 
/// 使用八路循环展开和SIMD优化批量计算

/// 优化的4位批量点积（查询未打包，目标打包）
/// 
/// # 参数
/// * `query_vector` - 4比特量化查询向量（未打包格式）
/// * `continuous_buffer` - 连续打包的1比特目标向量
/// * `num_vectors` - 向量数量
/// * `dimension` - 向量维度
/// 
/// # 返回
/// 点积结果数组
pub fn compute_batch_four_bit_dot_product_direct_packed(
    query_vector: &[u8],
    continuous_buffer: &[u8],
    num_vectors: usize,
    dimension: usize,
) -> Vec<i32> {
    let mut results = vec![0i32; num_vectors];
    let packed_dimension = (dimension + 7) / 8; // Math.ceil(dimension / 8)
    let main_packed_dimension = dimension / 8;

    for i in 0..num_vectors {
        let mut dot_product = 0i32;
        let target_offset = i * packed_dimension;

        // 主循环：处理完整字节（8路展开优化）
        for j in 0..main_packed_dimension {
            let packed_value = continuous_buffer[target_offset + j];
            let query_offset = j * 8;

            // 手动展开8个位的计算
            dot_product += (query_vector[query_offset] as i32) * (((packed_value >> 7) & 1) as i32);
            dot_product += (query_vector[query_offset + 1] as i32) * (((packed_value >> 6) & 1) as i32);
            dot_product += (query_vector[query_offset + 2] as i32) * (((packed_value >> 5) & 1) as i32);
            dot_product += (query_vector[query_offset + 3] as i32) * (((packed_value >> 4) & 1) as i32);
            dot_product += (query_vector[query_offset + 4] as i32) * (((packed_value >> 3) & 1) as i32);
            dot_product += (query_vector[query_offset + 5] as i32) * (((packed_value >> 2) & 1) as i32);
            dot_product += (query_vector[query_offset + 6] as i32) * (((packed_value >> 1) & 1) as i32);
            dot_product += (query_vector[query_offset + 7] as i32) * ((packed_value & 1) as i32);
        }

        // 处理剩余位（如果维度不是8的倍数）
        let remainder_start_dim = main_packed_dimension * 8;
        if remainder_start_dim < dimension {
            let last_packed_value = continuous_buffer[target_offset + main_packed_dimension];
            for dim in remainder_start_dim..dimension {
                let bit_index = 7 - (dim % 8);
                let target_value = ((last_packed_value >> bit_index) & 1) as i32;
                dot_product += (query_vector[dim] as i32) * target_value;
            }
        }

        results[i] = dot_product;
    }

    results
}

/// 批量1位点积计算（直接打包算法）
/// 
/// # 参数
/// * `query_vector` - 打包的1位查询向量
/// * `continuous_buffer` - 连续打包的1位目标向量
/// * `num_vectors` - 向量数量
/// * `packed_dimension` - 打包后的维度（字节数）
/// 
/// # 返回
/// 点积结果数组
pub fn compute_batch_one_bit_dot_product_direct_packed(
    query_vector: &[u8],
    continuous_buffer: &[u8],
    num_vectors: usize,
    packed_dimension: usize,
) -> Vec<i32> {
    let mut results = vec![0i32; num_vectors];

    for i in 0..num_vectors {
        let target_offset = i * packed_dimension;
        let mut dot_product = 0i32;

        // 使用XOR+POPCNT优化
        for j in 0..packed_dimension {
            let q_byte = query_vector[j];
            let d_byte = continuous_buffer[target_offset + j];
            
            // XOR得到不同的位
            let xor_result = q_byte ^ d_byte;
            let hamming_distance = xor_result.count_ones() as i32;
            
            // 转换为点积贡献
            // 每个字节有8位，相同的位贡献+1，不同的贡献-1
            dot_product += 8 - 2 * hamming_distance;
        }

        results[i] = dot_product;
    }

    results
}

/// 创建直接打包缓冲区
/// 将多个向量连续打包到一个缓冲区中，提升缓存局部性
/// 
/// # 参数
/// * `vectors` - 向量列表
/// * `indices` - 要打包的向量索引
/// * `packed_size` - 每个向量的打包大小
/// 
/// # 返回
/// 连续打包的缓冲区
pub fn create_direct_packed_buffer(
    vectors: &[Vec<u8>],
    indices: &[usize],
    packed_size: usize,
) -> Vec<u8> {
    let mut buffer = vec![0u8; indices.len() * packed_size];
    
    for (i, &index) in indices.iter().enumerate() {
        let offset = i * packed_size;
        let vector = &vectors[index];
        buffer[offset..offset + packed_size.min(vector.len())]
            .copy_from_slice(&vector[..packed_size.min(vector.len())]);
    }
    
    buffer
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_four_bit_dot_product() {
        // 测试4位批量点积
        let query = vec![1, 2, 3, 4, 5, 6, 7, 8];
        // 两个打包的1位向量：0xFF (全1) 和 0x00 (全0)
        let buffer = vec![0xFF, 0x00];
        let results = compute_batch_four_bit_dot_product_direct_packed(
            &query,
            &buffer,
            2,
            8,
        );
        
        // 第一个向量全1: 1+2+3+4+5+6+7+8 = 36
        assert_eq!(results[0], 36);
        // 第二个向量全0: 0
        assert_eq!(results[1], 0);
    }

    #[test]
    fn test_batch_one_bit_dot_product() {
        let query = vec![0xFF]; // 全1
        let buffer = vec![0xFF, 0x00, 0xF0]; // 全1, 全0, 前4位1
        let results = compute_batch_one_bit_dot_product_direct_packed(
            &query,
            &buffer,
            3,
            1,
        );
        
        assert_eq!(results[0], 8);  // 全1：8位相同
        assert_eq!(results[1], -8); // 全0：8位不同
        assert_eq!(results[2], 0);  // 一半一半：4位相同4位不同
    }

    #[test]
    fn test_create_direct_packed_buffer() {
        let vectors = vec![
            vec![1, 2, 3],
            vec![4, 5, 6],
            vec![7, 8, 9],
        ];
        let indices = vec![0, 2];
        let buffer = create_direct_packed_buffer(&vectors, &indices, 3);
        
        assert_eq!(buffer.len(), 6); // 2个向量 × 3字节
        assert_eq!(&buffer[0..3], &[1, 2, 3]);
        assert_eq!(&buffer[3..6], &[7, 8, 9]);
    }
}
