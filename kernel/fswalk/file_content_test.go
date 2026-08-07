package fswalk

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestReadLineRangePreservesRawFileReadSemantics(t *testing.T) {
	root := t.TempDir()
	raw := append([]byte{0xef, 0xbb, 0xbf}, []byte("one\r\ntwo\x00\n")...)
	raw = append(raw, 0xff)
	path := filepath.Join(root, "raw.bin")
	if err := os.WriteFile(path, raw, 0600); err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	window, err := walker.ReadLineRange(context.Background(), "raw.bin", LineRangeQuery{StartLine: 1, MaxLines: 2})
	if err != nil {
		t.Fatal(err)
	}
	expected := string(raw[:bytes.LastIndex(raw, []byte("\n"))+1-1])
	if window.Text != expected || window.TotalLines != 3 || window.StartLine != 1 || window.EndLine != 2 || !window.HasMore {
		t.Fatalf("raw line window changed bytes or pagination: %+v bytes=%v", window, []byte(window.Text))
	}
	tail, err := walker.ReadLineRange(context.Background(), "raw.bin", LineRangeQuery{StartLine: -1})
	if err != nil || !bytes.Equal([]byte(tail.Text), []byte{0xff}) || tail.StartLine != 3 {
		t.Fatalf("raw tail changed: %+v bytes=%v err=%v", tail, []byte(tail.Text), err)
	}
	outOfRange, err := walker.ReadLineRange(context.Background(), "raw.bin", LineRangeQuery{StartLine: 4})
	if !errors.Is(err, ErrTextLineOutOfRange) || outOfRange.TotalLines != 3 {
		t.Fatalf("out-of-range result lost total lines: %+v err=%v", outOfRange, err)
	}
}

func TestWriteFileContentPreservesArbitraryBytesAndRejectsLinks(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	content := []byte{0xef, 0xbb, 0xbf, 'a', '\r', '\n', 0, 0xff}
	if err = walker.WriteFileContent(context.Background(), "nested/raw.bin", content); err != nil {
		t.Fatal(err)
	}
	written, err := os.ReadFile(filepath.Join(root, "nested", "raw.bin"))
	if err != nil || !bytes.Equal(written, content) {
		t.Fatalf("raw write changed bytes: %v err=%v", written, err)
	}
	outside := filepath.Join(t.TempDir(), "outside.bin")
	if err = os.WriteFile(outside, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(root, "link.bin"))
	if err = walker.WriteFileContent(context.Background(), "link.bin", []byte("changed")); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked raw write returned %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err = walker.WriteFileContent(canceled, "canceled.bin", []byte("x")); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled raw write returned %v", err)
	}
}
