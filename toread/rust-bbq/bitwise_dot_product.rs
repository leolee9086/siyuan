/// 位运算点积计算
/// 对应TypeScript中的bitwiseDotProduct.ts
/// 
/// JavaScript实现下，直接计算比Lucene中使用的位运算版本更加高效
/// 在Rust中，我们可以利用SIMD和更精确的位操作优化

/// 量化向量点积计算（朴素实现）
/// 直接使用字节乘法计算点积，不使用位运算
/// 
/// # 参数
/// * `q` - 查询向量
/// * `d` - 索引向量
/// 
/// # 返回
/// 点积结果
pub fn compute_quantized_dot_product(q: &[u8], d: &[u8]) -> Result<i32, String> {
    if q.len() != d.len() {
        return Err(format!(
            "向量长度不匹配：查询向量长度{}，索引向量长度{}",
            q.len(),
            d.len()
        ));
    }

    let sum: i32 = q.iter()
        .zip(d.iter())
        .map(|(&qval, &dval)| (qval as i32) * (dval as i32))
        .sum();

    Ok(sum)
}

/// 4位-1位点积计算（朴素实现）
/// 直接使用字节乘法计算点积，不使用位运算
/// 注意：这里应该使用未打包的1位索引向量进行计算
///
/// # 参数
/// * `q` - 4位量化的查询向量（未打包格式，每个元素是0-15）
/// * `d` - 1位量化的索引向量（未打包格式，每个元素是0或1）
///
/// # 返回
/// 点积结果
#[inline]
pub fn compute_int4_bit_dot_product(q: &[u8], d: &[u8]) -> Result<i32, String> {
    // 对于4位查询+1位索引，应该使用未打包的向量进行直接点积计算
    // 这与TypeScript版本保持一致
    compute_quantized_dot_product(q, d)
}

/// 单比特-单比特点积计算（朴素实现）
/// 直接使用字节乘法计算点积，不使用位运算
/// 注意：这里应该使用未打包的1位向量进行计算
///
/// # 参数
/// * `q` - 单比特量化的查询向量（未打包格式，每个元素是0或1）
/// * `d` - 单比特量化的索引向量（未打包格式，每个元素是0或1）
///
/// # 返回
/// 点积结果
#[inline]
pub fn compute_int1_bit_dot_product(q: &[u8], d: &[u8]) -> Result<i32, String> {
    // 对于1位量化，应该使用未打包的向量进行直接点积计算
    // 这与TypeScript版本保持一致
    compute_quantized_dot_product(q, d)
}

/// 使用位计数优化的1位点积计算
/// 对于打包的二进制向量，使用XOR+POPCNT优化
/// 
/// # 参数
/// * `q` - 打包的单比特查询向量
/// * `d` - 打包的单比特索引向量
/// 
/// # 返回
/// 点积结果
pub fn compute_packed_bit_dot_product(q: &[u8], d: &[u8]) -> Result<i32, String> {
    if q.len() != d.len() {
        return Err(format!(
            "向量长度不匹配：查询向量长度{}，索引向量长度{}",
            q.len(),
            d.len()
        ));
    }

    // 使用XOR和POPCNT计算汉明距离
    // dot_product = (total_bits - hamming_distance) / 2
    let xor_sum: u32 = q.iter()
        .zip(d.iter())
        .map(|(&qval, &dval)| (qval ^ dval).count_ones())
        .sum();

    let total_bits = (q.len() * 8) as i32;
    let hamming_distance = xor_sum as i32;
    
    // 汉明距离转点积：dot = (n - hamming) 其中n是总位数
    // 对于二进制向量，这个公式需要调整
    Ok(total_bits - 2 * hamming_distance)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quantized_dot_product() {
        let q = vec![1, 2, 3, 4];
        let d = vec![5, 6, 7, 8];
        let result = compute_quantized_dot_product(&q, &d).unwrap();
        // 1*5 + 2*6 + 3*7 + 4*8 = 5 + 12 + 21 + 32 = 70
        assert_eq!(result, 70);
    }

    #[test]
    fn test_int4_bit_dot_product() {
        let q = vec![15, 14, 13, 12]; // 4位量化值
        let d = vec![1, 1, 0, 1];      // 1位量化值
        let result = compute_int4_bit_dot_product(&q, &d).unwrap();
        // 15*1 + 14*1 + 13*0 + 12*1 = 15 + 14 + 0 + 12 = 41
        assert_eq!(result, 41);
    }

    #[test]
    fn test_packed_bit_dot_product() {
        // 测试打包的位向量点积
        let q = vec![0b11110000]; // 前4位为1
        let d = vec![0b11001100]; // 1,1,0,0,1,1,0,0
        let result = compute_packed_bit_dot_product(&q, &d).unwrap();
        // XOR: 0b00111100 (汉明距离 4)
        // 点积: 8 - 2*4 = 0
        assert_eq!(result, 0);
    }
}
