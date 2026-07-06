package vamana

import (
	"os"
	"testing"
)

func requireDiagnosticTest(t *testing.T) {
	t.Helper()
	if testing.Short() || os.Getenv("VECTORDB_DIAGNOSTIC_TEST") != "1" {
		t.Skip("跳过诊断型测试：设置 VECTORDB_DIAGNOSTIC_TEST=1 且不使用 -short 后运行")
	}
}

func requireScaleTest(t *testing.T) {
	t.Helper()
	if testing.Short() || os.Getenv("VECTORDB_SCALE_TEST") != "1" {
		t.Skip("跳过规模型测试：设置 VECTORDB_SCALE_TEST=1 且不使用 -short 后运行")
	}
}
