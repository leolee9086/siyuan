package coordinator

import (
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type wannaSpeakStateTracker struct {
	phase            coreSageDeliberationPhase
	capturing        bool
	startCount       int
	continueCount    int
	stopCount        int
	transitionErrors []string
}

type coreSageDeliberationPhase string

const (
	coreSagePhaseReadThink coreSageDeliberationPhase = "read_think"
	coreSagePhaseSpeaking  coreSageDeliberationPhase = "speaking"
	coreSagePhaseCompleted coreSageDeliberationPhase = "completed"
)

func newWannaSpeakStateTracker() *wannaSpeakStateTracker {
	return &wannaSpeakStateTracker{phase: coreSagePhaseReadThink}
}

func (t *wannaSpeakStateTracker) ApplyTurnToolCalls(toolCalls []types.ToolCall) (bool, error) {
	if len(toolCalls) == 0 {
		return false, nil
	}

	madeProgress := false
	for _, tc := range toolCalls {
		toolName := strings.TrimSpace(tc.Function.Name)
		if toolName == "" {
			continue
		}

		if t.phase == coreSagePhaseCompleted {
			return madeProgress, t.appendTransitionError(
				fmt.Sprintf("表达已结束，不能继续调用 %s", toolName),
			)
		}

		switch toolName {
		case config.WannaSpeakStartToolName:
			if t.capturing {
				t.transitionErrors = append(t.transitionErrors,
					fmt.Sprintf("%s 重复调用已忽略，继续当前表达", config.WannaSpeakStartToolName),
				)
				madeProgress = true
				continue
			}
			t.phase = coreSagePhaseSpeaking
			t.startCount++
			t.capturing = true
			madeProgress = true
		case config.WannaSpeakContinueToolName:
			if !t.capturing {
				return madeProgress, t.appendTransitionError(
					fmt.Sprintf("%s 必须在 %s 与 %s 之间调用", config.WannaSpeakContinueToolName, config.WannaSpeakStartToolName, config.WannaSpeakStopToolName),
				)
			}
			t.continueCount++
			madeProgress = true
		case config.WannaSpeakStopToolName:
			if !t.capturing {
				return madeProgress, t.appendTransitionError(
					fmt.Sprintf("%s 必须在 %s 之后调用", config.WannaSpeakStopToolName, config.WannaSpeakStartToolName),
				)
			}
			t.stopCount++
			t.capturing = false
			madeProgress = true
			if t.startCount == t.stopCount {
				if t.continueCount == 0 {
					return madeProgress, t.appendTransitionError(
						fmt.Sprintf("%s 已调用但缺少 %s", config.WannaSpeakStartToolName, config.WannaSpeakContinueToolName),
					)
				}
				t.phase = coreSagePhaseCompleted
			}
		default:
			if t.phase == coreSagePhaseSpeaking || t.capturing {
				if isReadOnlyForgeTool(toolName) {
					madeProgress = true
				} else {
					return madeProgress, t.appendTransitionError(
						fmt.Sprintf("进入表达状态后不能再调用 %s", toolName),
					)
				}
			} else {
				madeProgress = true
			}
		}
	}

	return madeProgress, nil
}

func (t *wannaSpeakStateTracker) appendTransitionError(message string) error {
	t.transitionErrors = append(t.transitionErrors, message)
	return fmt.Errorf("%s", message)
}

func (t *wannaSpeakStateTracker) ValidatePairedState() error {
	if len(t.transitionErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(t.transitionErrors, "; "))
	}
	if t.startCount == 0 && t.stopCount == 0 && t.continueCount == 0 {
		return nil
	}
	if t.startCount == 0 && t.continueCount > 0 {
		return fmt.Errorf("%s 必须在 %s 之后调用", config.WannaSpeakContinueToolName, config.WannaSpeakStartToolName)
	}
	if t.startCount == 0 || t.stopCount == 0 {
		return fmt.Errorf("%s 与 %s 必须成对调用", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	if t.startCount != t.stopCount {
		return fmt.Errorf("%s 与 %s 调用次数不一致", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	if t.continueCount == 0 {
		return fmt.Errorf("%s 已调用但缺少 %s", config.WannaSpeakStartToolName, config.WannaSpeakContinueToolName)
	}
	if t.capturing {
		return fmt.Errorf("%s 已调用但未正确结束，缺少 %s", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	return nil
}

func (t *wannaSpeakStateTracker) GetCapturedContent() string {
	return ""
}

func (t *wannaSpeakStateTracker) IsPhaseCompleted() bool {
	return t.phase == coreSagePhaseCompleted
}

func (t *wannaSpeakStateTracker) IsCompletedPair() bool {
	return t.startCount > 0 &&
		t.continueCount > 0 &&
		t.startCount == t.stopCount &&
		!t.capturing &&
		len(t.transitionErrors) == 0
}

func (t *wannaSpeakStateTracker) HasEffectiveTransition() bool {
	return t.startCount > 0 || t.continueCount > 0 || t.stopCount > 0 || t.capturing
}

func (t *wannaSpeakStateTracker) HasCapturedContent() bool {
	return t.continueCount > 0
}

func (t *wannaSpeakStateTracker) ShouldInjectContinuationPrompt() bool {
	if t.phase == coreSagePhaseCompleted {
		return false
	}
	return t.phase == coreSagePhaseSpeaking
}

func (t *wannaSpeakStateTracker) HasNoExpressionProgress() bool {
	return t.phase == coreSagePhaseReadThink &&
		t.startCount == 0 &&
		t.continueCount == 0 &&
		t.stopCount == 0 &&
		!t.capturing
}

func (t *wannaSpeakStateTracker) IsPostStop() bool {
	return t.phase == coreSagePhaseSpeaking && !t.capturing && t.startCount > 0 && t.startCount == t.stopCount
}

func (t *wannaSpeakStateTracker) BuildContinuationPrompt() string {
	if len(t.transitionErrors) > 0 {
		return fmt.Sprintf(
			"上一次状态转移不合法：%s。请重新按顺序执行：先调用 %s，再调用 %s 追加内容，最后调用 %s。",
			strings.Join(t.transitionErrors, "; "),
			config.WannaSpeakStartToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	if t.startCount > 0 && t.startCount == t.stopCount && t.continueCount == 0 {
		return fmt.Sprintf(
			"你已经调用了 %s 与 %s，但没有调用 %s。请重新调用 %s，再调用 %s 追加至少一段内容，最后调用 %s。",
			config.WannaSpeakStartToolName,
			config.WannaSpeakStopToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStartToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	if t.capturing || t.startCount > t.stopCount {
		return fmt.Sprintf(
			"你已进入流式回复状态,输出内容将会推送给消息接收方。请继续调用 %s 追加内容，结束时必须调用 %s。",
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	return fmt.Sprintf(
		"不要在状态外直接输出最终内容。请先调用 %s，再调用 %s 追加内容，最后调用 %s。",
		config.WannaSpeakStartToolName,
		config.WannaSpeakContinueToolName,
		config.WannaSpeakStopToolName,
	)
}

func buildWannaSpeakToolAck(toolName string) string {
	switch strings.TrimSpace(toolName) {
	case config.WannaSpeakStartToolName:
		return fmt.Sprintf(
			`{"ok":true,"state":"speaking","instruction":"继续调用 %s 追加内容，结束时调用 %s"}`,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	case config.WannaSpeakContinueToolName:
		return `{"ok":true,"state":"continuing"}`
	case config.WannaSpeakStopToolName:
		return `{"ok":true,"state":"stopped"}`
	default:
		return `{"ok":true}`
	}
}

func buildCoreSageToolAck(toolName string) string {
	switch strings.TrimSpace(toolName) {
	case config.WannaSleepRecordToolName, config.WannaSleepPlanToolName, config.WannaSleepDreamToolName:
		return `{"ok":true,"state":"sleeping"}`
	case config.WannaRestRecordToolName, config.WannaRestPlanToolName, config.WannaRestDreamToolName:
		return `{"ok":true,"state":"rested"}`
	default:
		return buildWannaSpeakToolAck(toolName)
	}
}

func isReadOnlyForgeTool(toolName string) bool {
	return toolName == config.ForgeDevRepoListToolName ||
		toolName == config.ForgeDevRepoReadToolName ||
		toolName == config.ForgeDevRepoSearchToolName
}

func isInvestigationTool(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.NoteKeywordSearchToolName,
		config.NoteByIDReadToolName,
		config.ForgeDevRepoListToolName,
		config.ForgeDevRepoReadToolName,
		config.ForgeDevRepoSearchToolName,
		config.RecallCrossSessionMemoriesToolName:
		return true
	default:
		return false
	}
}

func isActionTool(toolName string) bool {
	return isGovernedActionToolName(toolName) ||
		toolName == config.PersistSessionMemoryToolName
}

func isAnyWannaRestTool(toolCalls []types.ToolCall) bool {
	for _, tc := range toolCalls {
		if config.IsWannaRestToolName(strings.TrimSpace(tc.Function.Name)) {
			return true
		}
	}
	return false
}

func isHeartbeatActionTool(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.WriteDiaryToolName,
		config.CreateNoteDocumentToolName,
		config.AppendNoteBlocksToolName,
		config.ModifyNoteBlockToolName,
		config.RevertNoteBlockToolName,
		config.SendChannelMessageToolName,
		config.ForgeDevRepoEditToolName,
		config.ForgeDevRepoBatchReplaceToolName,
		config.ForgeDevRepoBashToolName:
		return true
	default:
		return false
	}
}
