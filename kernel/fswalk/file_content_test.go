package fswalk

import (
	"bytes"
	"context"
	"errors"
	"io"
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

func TestWriteFileStreamIsAtomicAndReportsPartialFailures(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	written, err := walker.WriteFileStream(context.Background(), "nested/stream.bin", bytes.NewReader([]byte("streamed")))
	if err != nil || written != int64(len("streamed")) {
		t.Fatalf("stream write returned bytes=%d err=%v", written, err)
	}
	content, err := os.ReadFile(filepath.Join(root, "nested", "stream.bin"))
	if err != nil || string(content) != "streamed" {
		t.Fatalf("stream write content=%q err=%v", content, err)
	}

	existingPath := filepath.Join(root, "existing.bin")
	if err = os.WriteFile(existingPath, []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	partial := &failingReader{content: []byte("new"), err: errors.New("reader failed")}
	partialBytes, err := walker.WriteFileStream(context.Background(), "existing.bin", partial)
	if partialBytes != 3 || err == nil || err.Error() != "reader failed" {
		t.Fatalf("partial stream returned bytes=%d err=%v", partialBytes, err)
	}
	content, err = os.ReadFile(existingPath)
	if err != nil || string(content) != "old" {
		t.Fatalf("failed stream replaced existing content=%q err=%v", content, err)
	}
}

func TestWriteFileStreamRejectsInvalidInputBeforeCreatingParents(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if written, err := walker.WriteFileStream(context.Background(), "new-parent/file.bin", nil); written != 0 || !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("nil stream returned bytes=%d err=%v", written, err)
	}
	if _, err = os.Stat(filepath.Join(root, "new-parent")); !os.IsNotExist(err) {
		t.Fatalf("nil stream created parent: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancelOnEOF := &cancelOnEOFReader{cancel: cancel}
	if written, err := walker.WriteFileStream(ctx, "canceled.bin", cancelOnEOF); written != 0 || !errors.Is(err, context.Canceled) {
		t.Fatalf("post-read cancellation returned bytes=%d err=%v", written, err)
	}
	if _, err = os.Stat(filepath.Join(root, "canceled.bin")); !os.IsNotExist(err) {
		t.Fatalf("canceled stream created target: %v", err)
	}
}

type failingReader struct {
	content []byte
	err     error
}

func (r *failingReader) Read(buffer []byte) (int, error) {
	if len(r.content) == 0 {
		return 0, io.EOF
	}
	count := copy(buffer, r.content)
	r.content = r.content[count:]
	return count, r.err
}

type cancelOnEOFReader struct {
	cancel context.CancelFunc
}

func (r *cancelOnEOFReader) Read([]byte) (int, error) {
	r.cancel()
	return 0, io.EOF
}
