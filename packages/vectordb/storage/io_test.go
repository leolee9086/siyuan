package storage

import (
	"testing"
)

// ============================================================================
// CalcNodeLength 测试
// ============================================================================

func TestCalcNodeLength_Basic(t *testing.T) {
	// dim=128, maxDegree=64, assocDataLen=0
	// vector: 128 * 4 = 512
	// neighbors: (1 + 64) * 4 = 260
	// total: 512 + 260 + 0 = 772
	got := CalcNodeLength(128, 64, 0)
	if got != 772 {
		t.Errorf("CalcNodeLength(128,64,0) = %d, want 772", got)
	}
}

func TestCalcNodeLength_WithAssocData(t *testing.T) {
	// dim=128, maxDegree=32, assocDataLen=16
	got := CalcNodeLength(128, 32, 16)
	want := 128*4 + (1+32)*4 + 16
	if got != want {
		t.Errorf("CalcNodeLength(128,32,16) = %d, want %d", got, want)
	}
}

func TestCalcNodeLength_ZeroDim(t *testing.T) {
	got := CalcNodeLength(0, 64, 0)
	want := (1 + 64) * 4
	if got != want {
		t.Errorf("CalcNodeLength(0,64,0) = %d, want %d", got, want)
	}
}

func TestCalcNodeLength_ZeroMaxDegree(t *testing.T) {
	got := CalcNodeLength(128, 0, 0)
	want := 128*4 + (1+0)*4
	if got != want {
		t.Errorf("CalcNodeLength(128,0,0) = %d, want %d", got, want)
	}
}

func TestCalcNodeLength_NegativeDim(t *testing.T) {
	// Go 中 int 是带符号类型，传负值会导致负数乘法
	// 这里确保函数不会 panic，返回值可能无意义但不会崩溃
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("CalcNodeLength with negative dim panicked: %v", r)
		}
	}()
	_ = CalcNodeLength(-1, 64, 0)
}

// ============================================================================
// CalcNodesPerBlock 测试
// ============================================================================

func TestCalcNodesPerBlock_Normal(t *testing.T) {
	got := CalcNodesPerBlock(4096, 772)
	// 4096 / 772 = 5
	if got != 5 {
		t.Errorf("CalcNodesPerBlock(4096,772) = %d, want 5", got)
	}
}

func TestCalcNodesPerBlock_ExactFit(t *testing.T) {
	// nodeLen 恰好整除 blockSize
	got := CalcNodesPerBlock(4096, 512)
	if got != 8 {
		t.Errorf("CalcNodesPerBlock(4096,512) = %d, want 8", got)
	}
}

func TestCalcNodesPerBlock_NodeLargerThanBlock(t *testing.T) {
	got := CalcNodesPerBlock(4096, 8192)
	// 4096 / 8192 = 0 (整数除法截断)
	if got != 0 {
		t.Errorf("CalcNodesPerBlock(4096,8192) = %d, want 0", got)
	}
}

func TestCalcNodesPerBlock_ZeroNodeLen(t *testing.T) {
	got := CalcNodesPerBlock(4096, 0)
	if got != 0 {
		t.Errorf("CalcNodesPerBlock(4096,0) = %d, want 0", got)
	}
}

func TestCalcNodesPerBlock_BlockSmallerThanNode(t *testing.T) {
	got := CalcNodesPerBlock(128, 256)
	if got != 0 {
		t.Errorf("CalcNodesPerBlock(128,256) = %d, want 0", got)
	}
}

// ============================================================================
// CalcMaxDegree 测试
// ============================================================================

func TestCalcMaxDegree_Normal(t *testing.T) {
	// nodeLen = 772, dims=128, assocDataLen=0
	// remainingBytes = 772 - 128*4 - 0 = 772 - 512 = 260
	// maxDegree = 260/4 - 1 = 65 - 1 = 64
	got := CalcMaxDegree(772, 128, 0)
	if got != 64 {
		t.Errorf("CalcMaxDegree(772,128,0) = %d, want 64", got)
	}
}

func TestCalcMaxDegree_WithAssocData(t *testing.T) {
	got := CalcMaxDegree(788, 128, 16)
	// remainingBytes = 788 - 512 - 16 = 260
	// maxDegree = 260/4 - 1 = 64
	if got != 64 {
		t.Errorf("CalcMaxDegree(788,128,16) = %d, want 64", got)
	}
}

func TestCalcMaxDegree_TooSmall(t *testing.T) {
	// remainingBytes = 4 -> <=4, return 0
	got := CalcMaxDegree(516, 128, 0)
	// 516 - 128*4 = 516 - 512 = 4
	if got != 0 {
		t.Errorf("CalcMaxDegree(516,128,0) = %d, want 0", got)
	}
}

func TestCalcMaxDegree_ZeroDim(t *testing.T) {
	got := CalcMaxDegree(260, 0, 0)
	// remainingBytes = 260 - 0 - 0 = 260
	// maxDegree = 260/4 - 1 = 64
	if got != 64 {
		t.Errorf("CalcMaxDegree(260,0,0) = %d, want 64", got)
	}
}

func TestCalcMaxDegree_ExactFit(t *testing.T) {
	// remainingBytes = 8 -> 8/4 - 1 = 2 - 1 = 1
	got := CalcMaxDegree(520, 128, 0)
	// 520 - 512 = 8
	if got != 1 {
		t.Errorf("CalcMaxDegree(520,128,0) = %d, want 1", got)
	}
}

// ============================================================================
// CalcNodeLength ↔ CalcMaxDegree 互逆性测试
// ============================================================================

func TestNodeLenMaxDegreeRoundTrip(t *testing.T) {
	testCases := []struct {
		dims        int
		maxDegree   int
		assocDataLen int
	}{
		{128, 64, 0},
		{64, 32, 0},
		{128, 128, 0},
		{256, 32, 16},
		{3, 1, 0},
		{0, 10, 0},
	}

	for _, tc := range testCases {
		nodeLen := CalcNodeLength(tc.dims, tc.maxDegree, tc.assocDataLen)
		recovered := CalcMaxDegree(nodeLen, tc.dims, tc.assocDataLen)
		if recovered != tc.maxDegree {
			t.Errorf("Round-trip failed: dims=%d, maxDegree=%d, assocDataLen=%d: nodeLen=%d, recovered=%d",
				tc.dims, tc.maxDegree, tc.assocDataLen, nodeLen, recovered)
		}
	}
}

// ============================================================================
// CalcNodesPerBlock 边界 — NodeLen 恰好=BlockSize
// ============================================================================

func TestCalcNodesPerBlock_NodeEqualsBlock(t *testing.T) {
	got := CalcNodesPerBlock(4096, 4096)
	if got != 1 {
		t.Errorf("CalcNodesPerBlock(4096,4096) = %d, want 1", got)
	}
}

// ============================================================================
// CalcMaxDegree 边界 — 大数值运算验证
// ============================================================================

func TestCalcMaxDegree_LargeValues(t *testing.T) {
	// 验证大维度不会导致整数溢出
	got := CalcMaxDegree(20000, 4096, 0)
	if got < 0 {
		t.Errorf("CalcMaxDegree with large values returned negative: %d", got)
	}
}
