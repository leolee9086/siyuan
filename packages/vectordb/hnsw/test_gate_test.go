package hnsw

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
