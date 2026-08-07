package assetmeta

import (
	"errors"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

func TestTagDefinitionsNormalizeValidateAndComputeStableRevision(t *testing.T) {
	root := t.TempDir()
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	service := &AssetMetaService{
		manager:   NewManager(walker, "meta"),
		tagsCache: map[string]TagInfo{},
	}

	first, err := service.UpdateTagDefinitions(TagDefinitionsUpdate{Items: []TagInfo{
		{Name: "  Blue ", Color: "#aabbcc"},
		{Name: "red"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision == "" || len(first.Items) != 2 || first.Items[0].Name != "Blue" || first.Items[0].Color != "#AABBCC" {
		t.Fatalf("unexpected normalized snapshot: %+v", first)
	}
	second, err := service.UpdateTagDefinitions(TagDefinitionsUpdate{
		ExpectedRevision: first.Revision,
		Items:            []TagInfo{{Name: "red"}, {Name: "Blue", Color: "#AABBCC"}},
	})
	if err != nil || second.Revision != first.Revision {
		t.Fatalf("equivalent definitions changed revision: second=%+v err=%v", second, err)
	}
	if _, err = service.UpdateTagDefinitions(TagDefinitionsUpdate{ExpectedRevision: "stale", Items: first.Items}); !errors.Is(err, ErrTagDefinitionsConflict) {
		t.Fatalf("stale update did not conflict: %v", err)
	}

	invalid := []TagInfo{{Name: "same"}, {Name: " SAME ", Color: "#ffffff"}}
	if _, err = service.UpdateTagDefinitions(TagDefinitionsUpdate{Items: invalid}); !errors.Is(err, ErrTagDefinitionInvalid) {
		t.Fatalf("duplicate names were accepted: %v", err)
	}
	if _, err = service.UpdateTagDefinitions(TagDefinitionsUpdate{Items: []TagInfo{{Name: "bad", Color: "red"}}}); !errors.Is(err, ErrTagDefinitionInvalid) {
		t.Fatalf("invalid color was accepted: %v", err)
	}
}

func TestTagDefinitionsPersistAndReloadThroughManager(t *testing.T) {
	root := t.TempDir()
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	manager := NewManager(walker, "meta")
	service := &AssetMetaService{manager: manager, tagsCache: map[string]TagInfo{}}
	updated, err := service.UpdateTagDefinitions(TagDefinitionsUpdate{Items: []TagInfo{{Name: "Review", Color: "#123456"}}})
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := manager.LoadTags()
	if err != nil {
		t.Fatal(err)
	}
	if loaded["review"].Name != "Review" || loaded["review"].Color != "#123456" {
		t.Fatalf("persisted definitions changed: %+v", loaded)
	}
	reloaded := &AssetMetaService{manager: manager, tagsCache: loaded}
	if got := reloaded.GetTagDefinitions(); got.Revision != updated.Revision || len(got.Items) != 1 {
		t.Fatalf("reloaded snapshot changed: got=%+v want=%+v", got, updated)
	}
}
