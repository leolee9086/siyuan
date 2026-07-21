package logging

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileLoggerWritesToIndependentShards(t *testing.T) {
	basePath := filepath.Join(t.TempDir(), "component.log")
	logger, err := NewFileLogger(FileLoggerConfig{
		Path:         basePath,
		LogToStdout:  false,
		ShardMaxSize: 80,
		Level:        "info",
	})
	if err != nil {
		t.Fatalf("NewFileLogger failed: %v", err)
	}

	logger.Debugf("debug detail must be filtered")
	logger.Infof("first payload=%s", strings.Repeat("a", 96))
	logger.Infof("second payload=%s", strings.Repeat("b", 96))

	files, err := filepath.Glob(filepath.Join(filepath.Dir(basePath), "component-*.log"))
	if err != nil {
		t.Fatalf("glob log shards failed: %v", err)
	}
	if len(files) != 2 {
		t.Fatalf("expected 2 log shards, got %d: %v", len(files), files)
	}

	combined := strings.Builder{}
	for _, file := range files {
		content, readErr := os.ReadFile(file)
		if readErr != nil {
			t.Fatalf("read log shard failed: %v", readErr)
		}
		combined.Write(content)
	}
	logged := combined.String()
	if !strings.Contains(logged, "first payload=") || !strings.Contains(logged, "second payload=") {
		t.Fatalf("independent logger lost payloads: %s", logged)
	}
	if strings.Contains(logged, "debug detail") {
		t.Fatalf("independent logger ignored configured level: %s", logged)
	}
}

func TestNewFileLoggerRejectsEmptyPath(t *testing.T) {
	if _, err := NewFileLogger(FileLoggerConfig{}); err == nil {
		t.Fatal("expected empty path to be rejected")
	}
}
