package bbq

// PreparedEuclideanQuery 缓存单次非对称 L2 查询中不随数据向量变化的校正项。
type PreparedEuclideanQuery struct {
	lowerBound   float32
	scaledRange  float32
	quantizedSum float32
	normSquare   float32
	dimension    float32
}

// PrepareAsymmetricEuclideanQuery 为 4-bit query × 1-bit data 距离准备查询常量。
func PrepareAsymmetricEuclideanQuery(correction QuantizationResult, dimension int) PreparedEuclideanQuery {
	return PreparedEuclideanQuery{
		lowerBound:   correction.LowerBound,
		scaledRange:  (correction.UpperBound - correction.LowerBound) * ScalingFactor4Bit,
		quantizedSum: correction.QuantizedSum,
		normSquare:   correction.Correction,
		dimension:    float32(dimension),
	}
}

// Distance 根据量化点积和数据向量校正项计算 L2 距离估计。
func (query PreparedEuclideanQuery) Distance(dotProduct int, data QuantizationResult) float32 {
	dataRange := data.UpperBound - data.LowerBound
	dotEstimate := data.LowerBound*query.lowerBound*query.dimension +
		query.lowerBound*dataRange*data.QuantizedSum +
		data.LowerBound*query.scaledRange*query.quantizedSum +
		dataRange*query.scaledRange*float32(dotProduct)
	distance := query.normSquare + data.Correction - 2*dotEstimate
	if distance < 0 {
		return 0
	}
	return distance
}

// QuantizeAsymmetricQuery 将查询固定量化为 4-bit BitTranspose 布局。
// quantizedScratch 必须至少容纳 vector 的维度，调用方可通过对象池复用它。
func QuantizeAsymmetricQuery(quantizer *ScalarQuantizer, vector, centroid []float32, quantizedScratch []byte) ([]byte, QuantizationResult) {
	return QuantizeAsymmetricQueryInto(quantizer, vector, centroid, quantizedScratch, nil)
}

// QuantizeAsymmetricQueryInto 使用调用方提供的两个缓冲区生成 4-bit 查询码。
func QuantizeAsymmetricQueryInto(quantizer *ScalarQuantizer, vector, centroid []float32, quantizedScratch, transposedScratch []byte) ([]byte, QuantizationResult) {
	if len(quantizedScratch) < len(vector) {
		quantizedScratch = make([]byte, len(vector))
	} else {
		quantizedScratch = quantizedScratch[:len(vector)]
	}
	correction := quantizer.Quantize(vector, quantizedScratch, QueryQuantizationBits, centroid)
	return PackBitTranspose4Into(quantizedScratch, transposedScratch), correction
}

// ComputeAsymmetricDistance 计算 4-bit BitTranspose query × 1-bit packed data 的校正距离。
func ComputeAsymmetricDistance(scorer *QuantizedScorer, queryCode []byte, queryCorrection QuantizationResult, dataCode []byte, dataCorrection QuantizationResult, dimension int) float32 {
	dotProduct := ComputeTransposedDotProduct(queryCode, dataCode)
	return scorer.ComputeQuantizedDistance(dotProduct, queryCorrection, dataCorrection, dimension, 0, true)
}
