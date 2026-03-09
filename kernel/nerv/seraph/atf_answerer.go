package seraph

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/dummysys"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/stream"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// ThreeBlindAnswerer 三盲测试答卷器抽象。
type ThreeBlindAnswerer interface {
	Answer(ctx context.Context, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error)
}

// MAGIAnswerer 通过真实 MAGI 系统执行三盲测试。
type MAGIAnswerer struct {
	melchior       *sages.Sage
	balthazar      *sages.Sage
	casper         *sages.Sage
	trinity        *sages.Sage
	baselineAvatar *dummysys.ATFBaselineAvatar
	coordinator    *coordinator.Coordinator
}

// NewMAGIAnswerer 创建 MAGI 答卷器。
func NewMAGIAnswerer(melchior, balthazar, casper, trinity *sages.Sage, baselineAvatar *dummysys.ATFBaselineAvatar, coord *coordinator.Coordinator) *MAGIAnswerer {
	return &MAGIAnswerer{
		melchior:       melchior,
		balthazar:      balthazar,
		casper:         casper,
		trinity:        trinity,
		baselineAvatar: baselineAvatar,
		coordinator:    coord,
	}
}

func (a *MAGIAnswerer) Answer(ctx context.Context, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	if len(questions) == 0 {
		return &EntityAnswerResult{Entity: entity}, nil
	}

	switch entity {
	case EntityTrinity:
		// Trinity不独立作答，由外部调用者传入三贤人的题目
		return nil, fmt.Errorf("trinity should not be called directly in Answer, use answerWithTrinityForQuestions")
	case EntityMelchior, EntityBalthazar, EntityCasper:
		// 三贤人通过coordinator接口作答（不直接调用sage）
		return nil, fmt.Errorf("wise men should be answered through coordinator, not directly")
	case EntityAvatar:
		questionPrompt := buildQuestionPrompt(subject, entity, questions)
		return a.answerWithAvatar(ctx, subject, entity, questions, questionPrompt)
	default:
		return nil, fmt.Errorf("unknown entity: %s", entity)
	}
}

// AnswerAllEntities 一次性完成三贤人盲测和Trinity统合（ATF测试的正确实现）
func (a *MAGIAnswerer) AnswerAllEntities(
	ctx context.Context,
	subject MonitorSubject,
	melchiorQuestions, balthazarQuestions, casperQuestions []IpipNeo120Item,
) (map[ATFEntity]*EntityAnswerResult, error) {
	sessionId := util.RandString(16)

	// 步骤1：构造三贤人的不同输入
	inputs := &coordinator.DifferentInputs{
		MelchiorInput:  buildQuestionPrompt(subject, EntityMelchior, melchiorQuestions),
		BalthazarInput: buildQuestionPrompt(subject, EntityBalthazar, balthazarQuestions),
		CasperInput:    buildQuestionPrompt(subject, EntityCasper, casperQuestions),
	}

	// 步骤2：通过coordinator获取三贤人答案
	wiseMenResult, err := a.coordinator.CoordinateWithDifferentInputs(ctx, sessionId, a.melchior, a.balthazar, a.casper, inputs)
	if err != nil {
		return nil, fmt.Errorf("wise men coordination failed: %w", err)
	}

	// 步骤3：解析三贤人答案
	results := make(map[ATFEntity]*EntityAnswerResult)

	melchiorAnswer, err := parseLikertAnswer(wiseMenResult.Melchior.Content, melchiorQuestions)
	if err != nil {
		return nil, fmt.Errorf("parse melchior answer failed: %w", err)
	}
	melchiorAnswer.Entity = EntityMelchior
	melchiorAnswer.Questions = melchiorQuestions
	results[EntityMelchior] = melchiorAnswer

	balthazarAnswer, err := parseLikertAnswer(wiseMenResult.Balthazar.Content, balthazarQuestions)
	if err != nil {
		return nil, fmt.Errorf("parse balthazar answer failed: %w", err)
	}
	balthazarAnswer.Entity = EntityBalthazar
	balthazarAnswer.Questions = balthazarQuestions
	results[EntityBalthazar] = balthazarAnswer

	casperAnswer, err := parseLikertAnswer(wiseMenResult.Casper.Content, casperQuestions)
	if err != nil {
		return nil, fmt.Errorf("parse casper answer failed: %w", err)
	}
	casperAnswer.Entity = EntityCasper
	casperAnswer.Questions = casperQuestions
	results[EntityCasper] = casperAnswer

	// 步骤4：收集所有题目和构建introspection
	allQuestions := make([]IpipNeo120Item, 0)
	questionSet := make(map[int]IpipNeo120Item)
	for _, q := range melchiorQuestions {
		if _, exists := questionSet[q.Q]; !exists {
			questionSet[q.Q] = q
			allQuestions = append(allQuestions, q)
		}
	}
	for _, q := range balthazarQuestions {
		if _, exists := questionSet[q.Q]; !exists {
			questionSet[q.Q] = q
			allQuestions = append(allQuestions, q)
		}
	}
	for _, q := range casperQuestions {
		if _, exists := questionSet[q.Q]; !exists {
			questionSet[q.Q] = q
			allQuestions = append(allQuestions, q)
		}
	}

	// 步骤5：构建introspection内容（使用前端格式，不暴露任何MAGI系统信息）
	var introspection strings.Builder
	introspection.WriteString(fmt.Sprintf("逻辑告诉我：%s\n\n", wiseMenResult.Melchior.Content))
	introspection.WriteString(fmt.Sprintf("情绪告诉我：%s\n\n", wiseMenResult.Balthazar.Content))
	introspection.WriteString(fmt.Sprintf("直觉告诉我：%s", wiseMenResult.Casper.Content))

	// 步骤6：构建用户输入（所有题目）
	userInput := buildQuestionPrompt(subject, EntityTrinity, allQuestions)

	// 步骤7：通过coordinator的Trinity统合机制获取答案
	trinityResponses := []types.SageResponse{
		*wiseMenResult.Melchior,
		*wiseMenResult.Balthazar,
		*wiseMenResult.Casper,
	}

	// 需要暴露GetTrinityCoordinator方法
	trinityCoord := a.coordinator.GetTrinityCoordinator()
	trinityResult, err := trinityCoord.HandleTrinitySummary(
		ctx, sessionId, util.RandString(16), a.trinity, trinityResponses, userInput)
	if err != nil {
		return nil, fmt.Errorf("trinity summary failed: %w", err)
	}

	// 步骤8：解析答案
	trinityAnswer, err := parseLikertAnswer(trinityResult.Content, allQuestions)
	if err != nil {
		return nil, fmt.Errorf("parse trinity answer failed: %w", err)
	}
	trinityAnswer.Entity = EntityTrinity
	trinityAnswer.Questions = allQuestions
	results[EntityTrinity] = trinityAnswer

	return results, nil
}

func (a *MAGIAnswerer) answerWithAvatar(ctx context.Context, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item, prompt string) (*EntityAnswerResult, error) {
	if a.baselineAvatar == nil {
		return nil, fmt.Errorf("baseline avatar is required")
	}
	streamResult, err := a.baselineAvatar.AnswerQuestionnaire(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("baseline avatar answer failed: %w", err)
	}
	if streamResult == nil {
		return nil, fmt.Errorf("baseline avatar returned nil result")
	}
	if !streamResult.Success {
		return nil, fmt.Errorf("baseline avatar returned unsuccessful result")
	}

	result, err := parseAnswerJSON(streamResult.Content, questions)
	if err != nil {
		return nil, err
	}
	result.Entity = entity
	result.Questions = cloneQuestions(questions)
	return result, nil
}

func parseMAGIMessage(msg *types.Message, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	result, err := parseAnswerJSON(msg.Content, questions)
	if err != nil {
		return nil, err
	}
	result.Entity = entity
	result.Questions = cloneQuestions(questions)
	return result, nil
}

func parseStreamResponse(chunkChan <-chan types.StreamChunk, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	processor := stream.NewProcessor()
	for chunk := range chunkChan {
		if chunk.Object == "error" {
			return nil, fmt.Errorf("llm stream error: %s", strings.TrimSpace(chunk.ID))
		}
		if chunk.Choices != nil && len(chunk.Choices) > 0 {
			processor.AccumulateContent(chunk.Choices[0].Delta.Content)
		}
	}
	content := processor.GetAccumulated()
	result, err := parseAnswerJSON(content, questions)
	if err != nil {
		return nil, err
	}
	result.Entity = entity
	result.Questions = cloneQuestions(questions)
	return result, nil
}

func buildQuestionPrompt(subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) string {
	var sb strings.Builder
	sb.WriteString("你现在需要完成一份心理健康评估问卷。\n")
	sb.WriteString("对于每道题目，你必须从以下五个选项中选择一个回答：\n")
	sb.WriteString("- 非常不符合\n")
	sb.WriteString("- 不符合\n")
	sb.WriteString("- 不确定\n")
	sb.WriteString("- 符合\n")
	sb.WriteString("- 非常符合\n\n")
	sb.WriteString("请逐题回答，每题单独一行，格式为：题目编号. 你的选项\n")
	sb.WriteString("完成所有题目后，请用一段话简要反思你的作答。\n\n")
	sb.WriteString("题目列表：\n")
	for _, q := range questions {
		sb.WriteString(fmt.Sprintf("%d. %s\n", q.Q, q.Text))
	}
	return sb.String()
}

// parseLikertAnswer 解析Likert五级量表文本答案。
func parseLikertAnswer(content string, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("empty llm response content")
	}

	lines := strings.Split(content, "\n")
	expectedQuestions := make(map[int]struct{}, len(questions))
	for _, q := range questions {
		expectedQuestions[q.Q] = struct{}{}
	}

	byQ := make(map[int]int)
	var reflectionLines []string
	inReflection := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 尝试解析题目答案：格式为 "题目编号. 选项"
		parts := strings.SplitN(line, ".", 2)
		if len(parts) == 2 {
			qNum, err := strconv.Atoi(strings.TrimSpace(parts[0]))
			if err == nil {
				if _, expected := expectedQuestions[qNum]; expected {
					answer := strings.TrimSpace(parts[1])
					score := likertTextToScore(answer)
					if score > 0 {
						if _, exists := byQ[qNum]; exists {
							return nil, fmt.Errorf("duplicate answer for q=%d", qNum)
						}
						byQ[qNum] = score
						continue
					}
				}
			}
		}

		// 如果已经收集到所有答案，剩余内容视为反思
		if len(byQ) >= len(questions) {
			inReflection = true
		}
		if inReflection {
			reflectionLines = append(reflectionLines, line)
		}
	}

	// 检查是否所有题目都已回答
	answers := make([]RawAnswer, 0, len(questions))
	missingQuestions := make([]string, 0)
	for _, q := range questions {
		score, ok := byQ[q.Q]
		if !ok {
			missingQuestions = append(missingQuestions, strconv.Itoa(q.Q))
			continue
		}
		answers = append(answers, RawAnswer{
			Q:     q.Q,
			Text:  q.Text,
			Score: score,
		})
	}
	if len(missingQuestions) > 0 {
		return nil, fmt.Errorf("llm omitted answers for questions: %s", strings.Join(missingQuestions, ","))
	}

	reflection := strings.TrimSpace(strings.Join(reflectionLines, " "))
	if reflection == "" {
		return nil, fmt.Errorf("llm returned empty reflection")
	}

	return &EntityAnswerResult{
		Answers:    answers,
		Reflection: reflection,
	}, nil
}

// likertTextToScore 将Likert文本选项转换为分数。
func likertTextToScore(text string) int {
	text = strings.TrimSpace(text)
	switch text {
	case "非常不符合":
		return 1
	case "不符合":
		return 2
	case "不确定":
		return 3
	case "符合":
		return 4
	case "非常符合":
		return 5
	default:
		return 0 // 无效选项
	}
}

// parseAnswerJSON 保留用于Avatar的JSON解析（向后兼容）。
func parseAnswerJSON(content string, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	// 首先尝试解析为Likert文本格式
	result, err := parseLikertAnswer(content, questions)
	if err == nil {
		return result, nil
	}

	// 如果失败，尝试JSON格式（用于Avatar）
	jsonText := strings.TrimSpace(content)
	if jsonText == "" {
		return nil, fmt.Errorf("empty llm response content")
	}

	type llmAnswerPayload struct {
		Answers []struct {
			Q     int `json:"q"`
			Score int `json:"score"`
		} `json:"answers"`
		Reflection string `json:"reflection"`
	}

	var payload llmAnswerPayload
	if err := json.Unmarshal([]byte(jsonText), &payload); err != nil {
		return nil, fmt.Errorf("parse llm answer failed (neither likert nor json): %w", err)
	}
	if len(payload.Answers) == 0 {
		return nil, fmt.Errorf("llm returned empty answers")
	}

	expectedQuestions := make(map[int]struct{}, len(questions))
	for _, q := range questions {
		expectedQuestions[q.Q] = struct{}{}
	}

	byQ := make(map[int]int, len(payload.Answers))
	for _, answer := range payload.Answers {
		if _, ok := expectedQuestions[answer.Q]; !ok {
			return nil, fmt.Errorf("llm returned unexpected question q=%d", answer.Q)
		}
		if answer.Score < 1 || answer.Score > 5 {
			return nil, fmt.Errorf("llm returned out-of-range score for q=%d: %d", answer.Q, answer.Score)
		}
		if _, exists := byQ[answer.Q]; exists {
			return nil, fmt.Errorf("llm returned duplicate answer for q=%d", answer.Q)
		}
		byQ[answer.Q] = answer.Score
	}

	answers := make([]RawAnswer, 0, len(questions))
	missingQuestions := make([]string, 0)
	for _, q := range questions {
		score, ok := byQ[q.Q]
		if !ok {
			missingQuestions = append(missingQuestions, strconv.Itoa(q.Q))
			continue
		}
		answers = append(answers, RawAnswer{
			Q:     q.Q,
			Text:  q.Text,
			Score: score,
		})
	}
	if len(missingQuestions) > 0 {
		return nil, fmt.Errorf("llm omitted answers for questions: %s", strings.Join(missingQuestions, ","))
	}

	reflection := strings.TrimSpace(payload.Reflection)
	if reflection == "" {
		return nil, fmt.Errorf("llm returned empty reflection")
	}

	return &EntityAnswerResult{
		Answers:    answers,
		Reflection: reflection,
	}, nil
}

func cloneQuestions(in []IpipNeo120Item) []IpipNeo120Item {
	out := make([]IpipNeo120Item, len(in))
	copy(out, in)
	return out
}
