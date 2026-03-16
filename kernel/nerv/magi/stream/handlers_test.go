package stream

import (
	"testing"

	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

func TestSpeakToolHandler_PublicChannelWithStateTransition(t *testing.T) {
	handler := NewSpeakToolHandler()

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 0,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakStartToolName,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 1,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakContinueToolName,
			Arguments: `{"content":"Hello World"}`,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 2,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakStopToolName,
		},
	})

	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasPublicSpeakCall() {
		t.Error("expected HasPublicSpeakCall to be true")
	}
	if got := handler.GetPublicContent(); got != "Hello World" {
		t.Errorf("GetPublicContent() = %q, want %q", got, "Hello World")
	}
	if len(handler.GetInternalMessages()) != 0 {
		t.Errorf("expected no internal messages, got %d", len(handler.GetInternalMessages()))
	}
}

func TestSpeakToolHandler_InternalChannelWithStateTransition(t *testing.T) {
	handler := NewSpeakToolHandler()

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 0,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStartToolName,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 1,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakInternalContinueToolName,
			Arguments: `{"content":"Internal message"}`,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 2,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStopToolName,
		},
	})

	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if handler.HasPublicSpeakCall() {
		t.Error("expected HasPublicSpeakCall to be false")
	}
	if got := handler.GetPublicContent(); got != "" {
		t.Errorf("GetPublicContent() = %q, want empty", got)
	}
	internal := handler.GetInternalMessages()
	if len(internal) != 1 {
		t.Fatalf("expected 1 internal message, got %d", len(internal))
	}
	if internal[0] != "Internal message" {
		t.Errorf("internal[0] = %q, want %q", internal[0], "Internal message")
	}
}

func TestSpeakToolHandler_MixedChannelsWithStateTransition(t *testing.T) {
	handler := NewSpeakToolHandler()

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 0,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStartToolName,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 1,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakInternalContinueToolName,
			Arguments: `{"content":"Internal 1"}`,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 2,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStopToolName,
		},
	})

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 3,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakStartToolName,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 4,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakContinueToolName,
			Arguments: `{"content":"Public message"}`,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 5,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakStopToolName,
		},
	})

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 6,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStartToolName,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 7,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakInternalContinueToolName,
			Arguments: `{"content":"Internal 2"}`,
		},
	})
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 8,
		Function: &utilstream.ToolCallFunctionDelta{
			Name: TrinitySpeakInternalStopToolName,
		},
	})

	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasPublicSpeakCall() {
		t.Error("expected HasPublicSpeakCall to be true")
	}
	if got := handler.GetPublicContent(); got != "Public message" {
		t.Errorf("GetPublicContent() = %q, want %q", got, "Public message")
	}
	internal := handler.GetInternalMessages()
	if len(internal) != 2 {
		t.Fatalf("expected 2 internal messages, got %d", len(internal))
	}
	if internal[0] != "Internal 1" || internal[1] != "Internal 2" {
		t.Errorf("internal messages = %v, want [Internal 1 Internal 2]", internal)
	}
}

func TestSpeakToolHandler_LegacySpeakDoesNotBypassStateTransition(t *testing.T) {
	handler := NewSpeakToolHandler()

	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 0,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{"content":"Legacy content","channel":"public"}`,
		},
	})

	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if handler.HasPublicSpeakCall() {
		t.Error("legacy speak should not be treated as public output")
	}
	if handler.GetPublicContent() != "" {
		t.Error("expected empty public content for legacy speak")
	}
	if err := handler.ValidatePairedState(); err == nil {
		t.Error("expected paired-state validation to fail without speak_start/speak_stop")
	}
}

func TestDeliberationHandler_RequiresDeliberation(t *testing.T) {
	handler := NewDeliberationHandler()
	handler.OnToolCall(&utilstream.ToolCallDelta{
		Index: 0,
		Function: &utilstream.ToolCallFunctionDelta{
			Name:      DeliberationSignalToolName,
			Arguments: `{"requires_deliberation":true,"reason":"Complex decision needed"}`,
		},
	})

	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasSignal() {
		t.Error("expected HasSignal to be true")
	}
	if !handler.RequiresDeliberation() {
		t.Error("expected RequiresDeliberation to be true")
	}
	if got := handler.GetReason(); got != "Complex decision needed" {
		t.Errorf("GetReason() = %q, want %q", got, "Complex decision needed")
	}
}

func TestDeliberationHandler_NoSignal(t *testing.T) {
	handler := NewDeliberationHandler()
	result := &utilstream.StreamResult{}
	handler.OnComplete(result)

	if handler.HasSignal() {
		t.Error("expected HasSignal to be false")
	}
	if handler.GetSignal() != nil {
		t.Error("expected GetSignal() to be nil")
	}
}
