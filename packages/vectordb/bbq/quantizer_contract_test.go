package bbq

import (
	"errors"
	"testing"
)

func TestQuantizeCheckedRejectsMalformedInput(t *testing.T) {
	quantizer := NewScalarQuantizer(EuclideanDistance)
	valid := []float32{1, 2, 3}
	if _, err := quantizer.QuantizeChecked(valid, make([]byte, 2), 1, make([]float32, 3)); !errors.Is(err, ErrQuantizerInput) {
		t.Fatalf("目标缓冲区长度错误未被拒绝：%v", err)
	}
	if _, err := quantizer.QuantizeChecked(valid, make([]byte, 3), 1, make([]float32, 2)); !errors.Is(err, ErrQuantizerInput) {
		t.Fatalf("质心维度错误未被拒绝：%v", err)
	}
	if _, err := quantizer.QuantizeChecked(valid, make([]byte, 3), 9, make([]float32, 3)); !errors.Is(err, ErrQuantizerInput) {
		t.Fatalf("非法 bit 数未被拒绝：%v", err)
	}
	if _, err := quantizer.QuantizeChecked(nil, nil, 1, nil); !errors.Is(err, ErrQuantizerInput) {
		t.Fatalf("空向量未被拒绝：%v", err)
	}
	legacy := quantizer.Quantize(valid, make([]byte, 2), 1, make([]float32, 3))
	if legacy != (QuantizationResult{}) {
		t.Fatalf("旧无错入口对非法输入应返回零结果：%+v", legacy)
	}
}
