package coordinator

import (
	"reflect"
	"testing"
)

func TestReplyToolStreamProjectorForwardsIncrementalToolContent(t *testing.T) {
	var snapshots []string
	projector := newReplyToolStreamProjector(func(content string) error {
		snapshots = append(snapshots, content)
		return nil
	})

	updates := []string{
		`{"content":"中`,
		`{"content":"中文 `,
		`{"content":"中文 reply`,
		`{"content":"中文 reply"}`,
	}
	for _, raw := range updates {
		if err := projector.update(1, "wanna_speak_continue", raw); err != nil {
			t.Fatalf("update failed for %q: %v", raw, err)
		}
	}

	want := []string{"中", "中文", "中文 reply"}
	if !reflect.DeepEqual(snapshots, want) {
		t.Fatalf("unexpected stream snapshots: got %#v, want %#v", snapshots, want)
	}
}

func TestReplyToolStreamProjectorDecodesSplitEscapesAndSegments(t *testing.T) {
	var snapshots []string
	projector := newReplyToolStreamProjector(func(content string) error {
		snapshots = append(snapshots, content)
		return nil
	})

	updates := []struct {
		index int
		raw   string
	}{
		{1, `{"content":"A\u4e`},
		{1, `{"content":"A\u4e2d`},
		{1, `{"content":"A\u4e2d `},
		{2, `{"content":"B\nC"}`},
	}
	for _, update := range updates {
		if err := projector.update(update.index, "wanna_speak_continue", update.raw); err != nil {
			t.Fatalf("update failed for %q: %v", update.raw, err)
		}
	}

	want := []string{"A", "A中", "A中 B\nC"}
	if !reflect.DeepEqual(snapshots, want) {
		t.Fatalf("unexpected decoded snapshots: got %#v, want %#v", snapshots, want)
	}
}

func TestReplyToolStreamProjectorRejectsChangedContent(t *testing.T) {
	projector := newReplyToolStreamProjector(func(string) error { return nil })
	if err := projector.update(1, "wanna_speak_continue", `{"content":"first"}`); err != nil {
		t.Fatalf("initial update failed: %v", err)
	}
	if err := projector.update(1, "wanna_speak_continue", `{"content":"other"}`); err == nil {
		t.Fatal("changed tool content must fail explicitly")
	}
}

func TestReplyToolStreamProjectorAccumulatesWithoutObserver(t *testing.T) {
	projector := newReplyToolStreamProjector(nil)
	if err := projector.update(1, "wanna_speak_continue", `{"content":"第一段"}`); err != nil {
		t.Fatalf("first update failed: %v", err)
	}
	if err := projector.update(2, "wanna_speak_continue", `{"content":"第二段"}`); err != nil {
		t.Fatalf("second update failed: %v", err)
	}
	if got, want := projector.current(), "第一段第二段"; got != want {
		t.Fatalf("current content = %q, want %q", got, want)
	}
}

func TestDecodePartialJSONStringFieldRejectsInvalidEscape(t *testing.T) {
	if _, _, err := decodePartialJSONStringField(`{"content":"bad\x"}`, "content"); err == nil {
		t.Fatal("invalid JSON escape must return an error")
	}
}
