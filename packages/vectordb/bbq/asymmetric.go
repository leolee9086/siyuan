package bbq

// QuantizeAsymmetricQuery 将查询固定量化为 4-bit BitTranspose 布局。
// quantizedScratch 必须至少容纳 vector 的维度，调用方可通过对象池复用它。
func QuantizeAsymmetricQuery(quantizer *ScalarQuantizer, vector, centroid []float32, quantizedScratch []byte) ([]byte, QuantizationResult) {
	if len(quantizedScratch) < len(vector) {
		quantizedScratch = make([]byte, len(vector))
	} else {
		quantizedScratch = quantizedScratch[:len(vector)]
	}
	correction := quantizer.Quantize(vector, quantizedScratch, QueryQuantizationBits, centroid)
	return PackBitTranspose4(quantizedScratch), correction
}

// ComputeAsymmetricDistance 计算 4-bit BitTranspose query × 1-bit packed data 的校正距离。
func ComputeAsymmetricDistance(scorer *QuantizedScorer, queryCode []byte, queryCorrection QuantizationResult, dataCode []byte, dataCorrection QuantizationResult, dimension int) float32 {
	dotProduct := ComputeTransposedDotProduct(queryCode, dataCode)
	return scorer.ComputeQuantizedDistance(dotProduct, queryCorrection, dataCorrection, dimension, 0, true)
}
