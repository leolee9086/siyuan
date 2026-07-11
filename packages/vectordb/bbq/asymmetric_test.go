package bbq

import (
	"bytes"
	"testing"
)

func TestAsymmetricQueryContract(t *testing.T) {
	for _, dimension := range []int{33, 128, 768} {
		vector := make([]float32, dimension)
		centroid := make([]float32, dimension)
		for index := range vector {
			vector[index] = float32((index*17)%29) - 14
			centroid[index] = float32((index*5)%11) - 5
		}
		quantizer := NewScalarQuantizer(EuclideanDistance)
		scratch := make([]byte, dimension)
		code, correction := QuantizeAsymmetricQuery(quantizer, vector, centroid, scratch)

		expectedQuantized := make([]byte, dimension)
		expectedCorrection := quantizer.Quantize(vector, expectedQuantized, QueryQuantizationBits, centroid)
		expectedCode := PackBitTranspose4(expectedQuantized)
		if !bytes.Equal(code, expectedCode) || correction != expectedCorrection {
			t.Fatalf("维度 %d 未遵守 4-bit query 编码契约", dimension)
		}
	}
}

func TestComputeAsymmetricDistance(t *testing.T) {
	const dimension = 128
	query := make([]float32, dimension)
	data := make([]float32, dimension)
	centroid := make([]float32, dimension)
	for index := 0; index < dimension; index++ {
		query[index] = float32((index*7)%23) - 11
		data[index] = float32((index*13)%31) - 15
		centroid[index] = float32((index*3)%5) - 2
	}
	quantizer := NewScalarQuantizer(EuclideanDistance)
	scorer := NewQuantizedScorer(EuclideanDistance)
	queryCode, queryCorrection := QuantizeAsymmetricQuery(quantizer, query, centroid, make([]byte, dimension))
	dataQuantized := make([]byte, dimension)
	dataCorrection := quantizer.Quantize(data, dataQuantized, IndexQuantizationBits, centroid)
	dataCode := PackBinary(dataQuantized)

	dotProduct := ComputeTransposedDotProduct(queryCode, dataCode)
	expected := scorer.ComputeQuantizedDistance(dotProduct, queryCorrection, dataCorrection, dimension, 0, true)
	if actual := ComputeAsymmetricDistance(scorer, queryCode, queryCorrection, dataCode, dataCorrection, dimension); actual != expected {
		t.Fatalf("非对称距离不一致：实际=%f，期望=%f", actual, expected)
	}
}
