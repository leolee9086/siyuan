package coordinator

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type RecordResult int

const (
	RecordNormal RecordResult = iota
	RecordNudge
	RecordStop
)

const (
	maxConsecutiveToolCallNudge = 3
	maxConsecutiveToolCallStop  = 4
	maxTotalTurns               = 100
)

type repetitiveCallTracker struct {
	totalTurns       int
	maxTurns         int
	consecutiveCount int
	lastFingerprint  string
	nudgeInjected    bool
}

func newRepetitiveCallTracker() *repetitiveCallTracker {
	return &repetitiveCallTracker{
		maxTurns: maxTotalTurns,
	}
}

func isMetaTool(toolName string) bool {
	switch toolName {
	case config.WannaSpeakStartToolName,
		config.WannaSpeakContinueToolName,
		config.WannaSpeakStopToolName,
		config.WannaSleepRecordToolName,
		config.WannaSleepPlanToolName,
		config.WannaSleepDreamToolName,
		config.WannaRestPlanToolName,
		config.WannaRestDreamToolName,
		config.WannaRestRecordToolName,
		config.PersistSessionMemoryToolName,
		config.RecallCrossSessionMemoriesToolName:
		return true
	}
	return false
}

func normalizeArguments(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return "{}"
	}
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &args); err != nil {
		return raw
	}
	keys := make([]string, 0, len(args))
	for k := range args {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		v, _ := json.Marshal(args[k])
		pairs = append(pairs, fmt.Sprintf("%q:%s", k, string(v)))
	}
	return "{" + strings.Join(pairs, ",") + "}"
}

func (t *repetitiveCallTracker) BuildFingerprint(toolCalls []types.ToolCall) string {
	var parts []string
	for _, tc := range toolCalls {
		name := strings.TrimSpace(tc.Function.Name)
		if isMetaTool(name) {
			continue
		}
		parts = append(parts, name+":"+normalizeArguments(tc.Function.Arguments))
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, "|")
}

func (t *repetitiveCallTracker) Record(toolCalls []types.ToolCall) RecordResult {
	t.totalTurns++
	if t.totalTurns >= t.maxTurns {
		return RecordStop
	}

	fp := t.BuildFingerprint(toolCalls)
	if fp == "" {
		t.consecutiveCount = 0
		t.lastFingerprint = ""
		return RecordNormal
	}

	if fp == t.lastFingerprint {
		t.consecutiveCount++
	} else {
		t.consecutiveCount = 1
		t.lastFingerprint = fp
	}

	if t.consecutiveCount >= maxConsecutiveToolCallNudge {
		if !t.nudgeInjected {
			t.nudgeInjected = true
			return RecordNudge
		}
		if t.consecutiveCount >= maxConsecutiveToolCallStop {
			return RecordStop
		}
	}

	return RecordNormal
}
