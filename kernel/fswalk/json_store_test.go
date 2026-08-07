package fswalk

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestJSONStoreOwnsSaveLoadVisitAndRemove(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	store, err := walker.BindJSONStore("storage/meta", 1024)
	if err != nil {
		t.Fatal(err)
	}
	type document struct {
		Name string `json:"name"`
	}
	if err = store.Save(context.Background(), "folder/one", document{Name: "one"}); err != nil {
		t.Fatal(err)
	}
	if err = store.Save(context.Background(), "folder/two", document{Name: "two"}); err != nil {
		t.Fatal(err)
	}
	var loaded document
	if err = store.Load(context.Background(), "folder/one", &loaded); err != nil || loaded.Name != "one" {
		t.Fatalf("stored document changed: %+v err=%v", loaded, err)
	}
	keys := []string{}
	visited, err := store.Visit(context.Background(), "", JSONStoreQuery{}, func(snapshot JSONStoreDocument) error {
		keys = append(keys, snapshot.Key)
		if filepath.IsAbs(snapshot.Key) || filepath.Ext(snapshot.Key) == ".json" {
			t.Fatalf("store exposed a physical document path: %+v", snapshot)
		}
		return nil
	})
	if err != nil || visited.ReadFileCount != 2 || len(keys) != 2 || keys[0] != "folder/one" || keys[1] != "folder/two" {
		t.Fatalf("unexpected visit result: keys=%v result=%+v err=%v", keys, visited, err)
	}
	removed, err := store.Remove(context.Background(), "folder/one")
	if err != nil || !removed {
		t.Fatalf("remove failed: removed=%v err=%v", removed, err)
	}
	if err = store.Load(context.Background(), "folder/one", &loaded); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("removed document remained readable: %v", err)
	}
	removed, err = store.Remove(context.Background(), "folder/one")
	if err != nil || removed {
		t.Fatalf("missing remove changed semantics: removed=%v err=%v", removed, err)
	}
}

func TestJSONStoreRejectsEscapeLinksLargeDocumentsAndCancellation(t *testing.T) {
	root := t.TempDir()
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	store, err := walker.BindJSONStore("storage", 32)
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Save(context.Background(), "../outside", map[string]string{"value": "x"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("store key escape was accepted: %v", err)
	}
	if err = store.Save(context.Background(), "large", map[string]string{"value": "012345678901234567890123456789"}); !errors.Is(err, ErrTextFileTooLarge) {
		t.Fatalf("large JSON document was accepted: %v", err)
	}
	if err = os.MkdirAll(filepath.Join(root, "storage"), 0755); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	symlinkfixture.Create(t, outside, filepath.Join(root, "storage", "linked"))
	if err = store.Save(context.Background(), "linked/document", map[string]string{"value": "x"}); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked store component was accepted: %v", err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err = store.Save(canceled, "canceled", map[string]string{"value": "x"}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled save returned %v", err)
	}
}
