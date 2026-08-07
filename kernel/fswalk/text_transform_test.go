package fswalk

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func exactReplace(oldText, newText string) TextTransformer {
	return func(document TextDocument) (TextTransformation, error) {
		count := strings.Count(document.Text, oldText)
		if count == 0 {
			return TextTransformation{}, nil
		}
		if count != 1 {
			return TextTransformation{}, errors.New("source text must occur exactly once")
		}
		return TextTransformation{Text: strings.Replace(document.Text, oldText, newText, 1), Changed: true}, nil
	}
}

func TestTextTransformPlansBeforeWritingAndPreservesTextFormat(t *testing.T) {
	root := t.TempDir()
	original := append([]byte{0xef, 0xbb, 0xbf}, []byte("old\r\nline\r\n")...)
	writeTextSearchFixture(t, root, "src/a.go", original)
	writeTextSearchFixture(t, root, "src/unchanged.go", []byte("none\n"))
	writeTextSearchFixture(t, root, "src/binary.go", []byte{'o', 0, 'l', 'd'})
	writeTextSearchFixture(t, root, "ignored/skip.go", []byte("old\n"))

	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	plan, planned, err := walker.PlanTextTransform(context.Background(), "", TextTransformQuery{
		Walk:         WalkOptions{SortEntries: true, Workers: 4},
		MaxFileBytes: 1024,
		PruneDirectory: func(entry Metadata) bool {
			return entry.Path == "ignored"
		},
		SelectFile: func(entry Metadata) bool {
			return strings.HasSuffix(entry.Name, ".go")
		},
		Transform: exactReplace("old", "new"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if planned.SelectedFileCount != 3 || planned.ScannedFileCount != 2 ||
		planned.UnchangedFileCount != 1 || planned.SkippedBinaryCount != 1 ||
		len(planned.Candidates) != 1 || planned.Candidates[0].Path != "src/a.go" {
		t.Fatalf("unexpected plan: %+v", planned)
	}
	before, err := os.ReadFile(filepath.Join(root, "src", "a.go"))
	if err != nil || !bytes.Equal(before, original) {
		t.Fatalf("planning modified the source: %q err=%v", before, err)
	}

	applied, err := walker.ApplyTextTransform(context.Background(), plan, TextApplyPolicy{
		Backup: true, StopOnError: true,
	})
	if err != nil || applied.ErrorCount != 0 || !slices.Equal(applied.Changed, []string{"src/a.go"}) {
		t.Fatalf("apply failed: result=%+v err=%v", applied, err)
	}
	updated, err := os.ReadFile(filepath.Join(root, "src", "a.go"))
	if err != nil || !bytes.Equal(updated, append([]byte{0xef, 0xbb, 0xbf}, []byte("new\r\nline\r\n")...)) {
		t.Fatalf("text format or replacement changed: %q err=%v", updated, err)
	}
	backup, err := os.ReadFile(filepath.Join(root, "src", "a.go.bak"))
	if err != nil || !bytes.Equal(backup, original) {
		t.Fatalf("backup is not the exact original: %q err=%v", backup, err)
	}
	if _, err = walker.ApplyTextTransform(context.Background(), plan, TextApplyPolicy{}); !errors.Is(err, ErrTransformPlanApplied) {
		t.Fatalf("plan reuse was accepted: %v", err)
	}
	other, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = other.ApplyTextTransform(context.Background(), plan, TextApplyPolicy{}); !errors.Is(err, ErrTransformPlanOwner) {
		t.Fatalf("another walker accepted the plan: %v", err)
	}
}

func TestTextTransformRejectsChangedFileBeforeBackupOrWrite(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "target.txt")
	writeTextSearchFixture(t, root, "target.txt", []byte("old\n"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	plan, planned, err := walker.PlanTextTransform(context.Background(), "target.txt", TextTransformQuery{
		Transform: exactReplace("old", "new"),
	})
	if err != nil || len(planned.Candidates) != 1 {
		t.Fatalf("plan failed: %+v err=%v", planned, err)
	}
	if err = os.WriteFile(path, []byte("changed elsewhere\n"), 0600); err != nil {
		t.Fatal(err)
	}
	applied, err := walker.ApplyTextTransform(context.Background(), plan, TextApplyPolicy{
		Backup: true, StopOnError: true,
	})
	if err != nil || applied.ErrorCount != 1 || len(applied.Errors) != 1 ||
		!errors.Is(applied.Errors[0].Err, ErrFileChanged) {
		t.Fatalf("stale plan was not rejected: result=%+v err=%v", applied, err)
	}
	current, err := os.ReadFile(path)
	if err != nil || string(current) != "changed elsewhere\n" {
		t.Fatalf("stale apply modified the file: %q err=%v", current, err)
	}
	if _, err = os.Stat(path + ".bak"); !os.IsNotExist(err) {
		t.Fatalf("stale apply created a backup: %v", err)
	}
}

func TestTextTransformRejectsNonDeterministicPureTransform(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "target.txt")
	writeTextSearchFixture(t, root, "target.txt", []byte("old"))
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	invocation := 0
	transform := func(TextDocument) (TextTransformation, error) {
		invocation++
		return TextTransformation{Text: "new-" + string(rune('0'+invocation)), Changed: true}, nil
	}
	plan, _, err := walker.PlanTextTransform(context.Background(), "target.txt", TextTransformQuery{Transform: transform})
	if err != nil {
		t.Fatal(err)
	}
	applied, err := walker.ApplyTextTransform(context.Background(), plan, TextApplyPolicy{Backup: true})
	if err != nil || applied.ErrorCount != 1 || !errors.Is(applied.Errors[0].Err, ErrTransformChanged) {
		t.Fatalf("non-deterministic transform was accepted: result=%+v err=%v", applied, err)
	}
	current, err := os.ReadFile(path)
	if err != nil || string(current) != "old" {
		t.Fatalf("invalidated transform wrote the file: %q err=%v", current, err)
	}
}
