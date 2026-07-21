package observability

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestDetailfWritesUnderMagiLogDirectory(t *testing.T) {
	originalTempDir := util.TempDir
	util.TempDir = t.TempDir()
	t.Cleanup(func() {
		util.TempDir = originalTempDir
	})

	Detailf("full payload=%s", "private-content")

	files, err := filepath.Glob(filepath.Join(util.TempDir, "magi", "magi-*.log"))
	if err != nil {
		t.Fatalf("glob MAGI detail logs failed: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected one MAGI detail log, got %d: %v", len(files), files)
	}
	content, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatalf("read MAGI detail log failed: %v", err)
	}
	if !strings.Contains(string(content), "private-content") {
		t.Fatalf("MAGI detail log lost full payload: %s", content)
	}
}
