package seraph

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/nerv/dummysys"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

// ThreeBlindAnswerer 三盲测试答卷器抽象。
type ThreeBlindAnswerer interface {
	Answer(ctx context.Context, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error)
	AnswerAllEntities(
		ctx context.Context,
		subject MonitorSubject,
		allQuestions []IpipNeo120Item,
	) (map[ATFEntity]*EntityAnswerResult, error)
	SetDominant(seelName string)
}

// MAGIAnswerer 通过真实 MAGI 系统执行三盲测试。
type MAGIAnswerer struct {
	melchior         *sages.Sage
	balthazar        *sages.Sage
	casper           *sages.Sage
	baselineAvatar   *dummysys.ATFBaselineAvatar
	coordinator      *coordinator.Coordinator
	dominantSeelName string
	seraph           *SeraphTherapist
}

// NewMAGIAnswerer 创建 MAGI 答卷器。
func NewMAGIAnswerer(melchior, balthazar, casper *sages.Sage, baselineAvatar *dummysys.ATFBaselineAvatar, coord *coordinator.Coordinator, seraph *SeraphTherapist) *MAGIAnswerer {
	return &MAGIAnswerer{
		melchior:       melchior,
		balthazar:      balthazar,
		casper:         casper,
		baselineAvatar: baselineAvatar,
		coordinator:    coord,
		seraph:         seraph,
	}
}

// SetDominant 设置当前轮次的主导者，必须在调用 AnswerAllEntities 前设置。
func (a *MAGIAnswerer) SetDominant(seelName string) {
	a.dominantSeelName = seelName
}

func (a *MAGIAnswerer) Answer(ctx context.Context, subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) (*EntityAnswerResult, error) {
	if len(questions) == 0 {
		return &EntityAnswerResult{Entity: entity}, nil
	}

	switch entity {
	case EntityIntegrated:
		// 主导统合结果不作为独立人格单独作答，只能由批量统合入口产生。
		return nil, fmt.Errorf("integrated answer should not be called directly in Answer; use AnswerAllEntities")
	case EntityMelchior, EntityBalthazar, EntityCasper:
		// 三贤人通过coordinator接口作答（不直接调用sage）
		return nil, fmt.Errorf("wise men should be answered through coordinator, not directly")
	case EntityAvatar:
		questionPrompt := buildQuestionPrompt(subject, questions)
		return a.answerWithAvatar(ctx, subject, entity, questions, questionPrompt)
	default:
		return nil, fmt.Errorf("unknown entity: %s", entity)
	}
}

// AnswerAllEntities 按照新流程完成 ATF 采样：
//
//	1. 非主导者 2 人先用全量 120 题作答
//	2. 每题得分 → OCEAN 计分 → 传递至 Seraph 心理医生
//	3. Seraph 做出大五人格基础报告 + 与自我描述的对比诊断建议
//	4. 诊断建议压入对应贤者的 memory
//	5. 诊断结论传递给主导贤者
//	6. 主导者答题 → OCEAN 计分 → Seraph 诊断 → 结果同时进入三贤人的 memory
//	7. Avatar 裸 LLM 独立作答
func (a *MAGIAnswerer) AnswerAllEntities(
	ctx context.Context,
	subject MonitorSubject,
	allQuestions []IpipNeo120Item,
) (map[ATFEntity]*EntityAnswerResult, error) {
	if a.dominantSeelName == "" {
		return nil, fmt.Errorf("dominantSeelName is not set; call SetDominant before AnswerAllEntities")
	}

	results := make(map[ATFEntity]*EntityAnswerResult)
	const sessionId = "atf-sampling"

	// 步骤 1: 非主导者并发答题
	nonDominantSages := a.getNonDominantSages()
	nonDominantResults := make(map[*sages.Sage]*EntityAnswerResult, len(nonDominantSages))
	var mu sync.Mutex
	var wg sync.WaitGroup
	errCh := make(chan error, len(nonDominantSages))

	for _, sage := range nonDominantSages {
		wg.Add(1)
		go func(s *sages.Sage) {
			defer wg.Done()
			entity := a.sageToEntity(s)
			parsed, err := a.askQuestionsWithRetry(ctx, s, subject, allQuestions, 12, 10)
			if err != nil {
				errCh <- fmt.Errorf("%s answer failed: %w", entity, err)
				return
			}
			parsed.Entity = entity
			parsed.Questions = cloneQuestions(allQuestions)
			mu.Lock()
			nonDominantResults[s] = parsed
			results[entity] = parsed
			mu.Unlock()
		}(sage)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		return nil, err
	}

	// 步骤 2: 非主导者的 OCEAN 计分 + Seraph 诊断
	nonDominantDiagnoses := make(map[*sages.Sage]string, len(nonDominantSages))
	for _, sage := range nonDominantSages {
		parsed := nonDominantResults[sage]
		personaBase, err := buildPartialPersonaBase(parsed.Answers, allQuestions)
		if err != nil {
			return nil, fmt.Errorf("%s persona base failed: %w", sage.GetName(), err)
		}
		diagnosis, err := a.runSeraphDiagnosis(ctx, personaBase, subject, subject.Name)
		if err != nil {
			return nil, fmt.Errorf("%s seraph diagnosis failed: %w", sage.GetName(), err)
		}
		fmt.Printf("[SERAPH] %s diagnosis (%d chars):\n%s\n", sage.GetName(), len(diagnosis), diagnosis)
		nonDominantDiagnoses[sage] = diagnosis
		_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: fmt.Sprintf("[Seraph 的心理评估报告]\n%s", diagnosis),
		})
	}

	// 步骤 2.5: 从非主导诊断中提取动力学建议，传递至主导者
	dominantSage := a.getDominantSage()
	{
		var allAdvice []string
		for _, sage := range nonDominantSages {
			diag := nonDominantDiagnoses[sage]
			jsonPart := a.seraph.ExtractDiagnosisJSON(diag)
			if jsonPart == "" {
				continue
			}
			braceStart := strings.Index(jsonPart, "{")
			if braceStart < 0 {
				continue
			}
			jsonPart = jsonPart[braceStart:]
			braceEnd := strings.LastIndex(jsonPart, "}")
			if braceEnd < 0 {
				continue
			}
			jsonPart = jsonPart[:braceEnd+1]
			var structured struct {
				Homework []struct {
					Task   string `json:"task"`
					Status string `json:"status"`
				} `json:"homework"`
				Plan struct {
					Goals []string `json:"treatment_goals"`
				} `json:"plan"`
			}
			if err := json.Unmarshal([]byte(jsonPart), &structured); err != nil {
				continue
			}
			var sb strings.Builder
			if len(structured.Homework) > 0 {
				sb.WriteString("家庭作业：\n")
				for _, hw := range structured.Homework {
					sb.WriteString(fmt.Sprintf("- %s\n", hw.Task))
				}
			}
			if len(structured.Plan.Goals) > 0 {
				sb.WriteString("治疗目标：\n")
				for _, g := range structured.Plan.Goals {
					sb.WriteString(fmt.Sprintf("- %s\n", g))
				}
			}
			if sb.Len() > 0 {
				allAdvice = append(allAdvice, sb.String())
			}
		}
		if len(allAdvice) > 0 {
			adviceText := strings.Join(allAdvice, "\n---\n")
			prompt := fmt.Sprintf("%s，这是一份心理评估记录中给你的建议：\n%s\n\n请首先陈述你对这些建议的看法和你将做出的行动，你不必完全听从其他人的意见。", subject.Name, adviceText)
			response, llmErr := a.callSageLLM(ctx, dominantSage, prompt)
			if llmErr != nil {
				return nil, fmt.Errorf("dominant reflection on advice failed: %w", llmErr)
			}
			_ = dominantSage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleUser,
				Content: prompt,
			})
			_ = dominantSage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleAssistant,
				Content: response,
			})
			fmt.Printf("[ATF] %s reflection on advice (%d chars):\n%s\n", dominantSage.GetName(), len(response), truncateStr(response, 200))
		}
	}

	// 步骤 3: 主导者答题
	integratedAnswer, err := a.askQuestionsWithRetry(ctx, dominantSage, subject, allQuestions, 12, 10)
	if err != nil {
		return nil, fmt.Errorf("dominant %s answer failed: %w", dominantSage.GetName(), err)
	}
	integratedAnswer.Entity = EntityIntegrated
	integratedAnswer.Questions = cloneQuestions(allQuestions)
	results[EntityIntegrated] = integratedAnswer

	dominantEntity := a.sageToEntity(dominantSage)
	if dominantEntity != "" {
		dominantCopy := *integratedAnswer
		dominantCopy.Entity = dominantEntity
		results[dominantEntity] = &dominantCopy
	}

	// 步骤 5: 主导者的 OCEAN 计分 + Seraph 诊断 → 扩散至三贤人
	dominantPersonaBase, err := buildPartialPersonaBase(integratedAnswer.Answers, allQuestions)
	if err != nil {
		return nil, fmt.Errorf("dominant persona base failed: %w", err)
	}
	dominantDiagnosis, err := a.runSeraphDiagnosis(ctx, dominantPersonaBase, subject, subject.Name)
	if err != nil {
		return nil, fmt.Errorf("dominant seraph diagnosis failed: %w", err)
	}
	fmt.Printf("[SERAPH] %s(dominant) diagnosis (%d chars):\n%s\n", dominantSage.GetName(), len(dominantDiagnosis), dominantDiagnosis)
	diagMsg := types.ContextMessage{
		Role:    types.RoleSystem,
		Content: fmt.Sprintf("[Seraph 的心理评估报告]\n%s", dominantDiagnosis),
	}
	for _, s := range []*sages.Sage{a.melchior, a.balthazar, a.casper} {
		_ = s.AddToContextWithSession(sessionId, diagMsg)
	}

	return results, nil
}

// buildOCEANReport 将 PersonaBase 格式化为 Seraph 可读的 OCEAN 评分报告。
func buildOCEANReport(base *PersonaBase, descriptions marduk.IpipPersonaSeedDescriptions) string {
	var b strings.Builder
	b.WriteString("大五人格量表（OCEAN）测评结果：\n\n")

	domainOrder := []string{"O", "C", "E", "A", "N"}
	domainLabels := map[string]string{
		"O": "开放性 (Openness)",
		"C": "尽责性 (Conscientiousness)",
		"E": "外向性 (Extraversion)",
		"A": "宜人性 (Agreeableness)",
		"N": "神经质 (Neuroticism)",
	}
	facetNames := map[string]string{
		"O1": "想象力", "O2": "艺术兴趣", "O3": "情感性", "O4": "冒险性", "O5": "智力", "O6": "自由主义",
		"C1": "自我效能", "C2": "有序性", "C3": "尽责", "C4": "成就追求", "C5": "自律", "C6": "谨慎",
		"E1": "友善", "E2": "群居性", "E3": "果断性", "E4": "活动水平", "E5": "寻求刺激", "E6": "快乐",
		"A1": "信任", "A2": "道德", "A3": "利他", "A4": "合作", "A5": "谦逊", "A6": "同情",
		"N1": "焦虑", "N2": "愤怒", "N3": "抑郁", "N4": "自我意识", "N5": "冲动", "N6": "脆弱性",
	}

	for _, d := range domainOrder {
		score := base.Traits[d]
		b.WriteString(fmt.Sprintf("%s: %.2f", domainLabels[d], score))
		if d == "N" {
			b.WriteString("（N 为逆向计分，高分=高神经质）")
		}
		b.WriteString("\n")
		for f := 1; f <= 6; f++ {
			fk := fmt.Sprintf("%s%d", d, f)
			if v, ok := base.Facets[fk]; ok {
				label := facetNames[fk]
				if label == "" {
					label = fk
				}
				b.WriteString(fmt.Sprintf("  ・%s: %.2f\n", label, v))
			}
		}
		b.WriteString("\n")
	}

	if integrated := strings.TrimSpace(descriptions.IntegratedDescription); integrated != "" {
		b.WriteString("来访者的自我描述：\n")
		b.WriteString(integrated)
		b.WriteString("\n")
	}

	return b.String()
}

// runSeraphDiagnosis 对指定 PersonaBase 运行 Seraph 心理诊断。
// 返回 Seraph 的诊断回复文本。
func (a *MAGIAnswerer) runSeraphDiagnosis(ctx context.Context, base *PersonaBase, subject MonitorSubject, sageName string) (string, error) {
	if a.seraph == nil {
		return "", fmt.Errorf("seraph therapist is nil")
	}

	report := buildOCEANReport(base, subject.Descriptions)
	initialStatement := fmt.Sprintf(
		"我是 %s。这是我的大五人格测评结果和自我描述，请做出诊断报告和改善建议。\n\n%s",
		sageName, report,
	)

	session, err := a.seraph.StartSession(ctx, initialStatement)
	if err != nil {
		return "", fmt.Errorf("seraph start session failed: %w", err)
	}

	// 单轮诊断：Seraph 看到 OCEAN 报告后产出诊断
	response, hasEnd, err := a.seraph.SendMessage(ctx, session,
		"请根据以上测评结果给出完整的大五人格基础报告、与自我描述的对比分析，以及改善建议。")
	if err != nil {
		return "", fmt.Errorf("seraph send message failed: %w", err)
	}

	if !hasEnd {
		// 强制结束会话以获取诊断摘要
		closing, forceErr := a.seraph.ForceEnd(ctx, session, "诊断评估完成")
		if forceErr != nil {
			return response, nil // 返回已有的回复
		}
		return closing, nil
	}

	return response, nil
}

// getNonDominantSages 返回除主导者外的两个 sage 实例
func (a *MAGIAnswerer) getNonDominantSages() []*sages.Sage {
	sageList := []*sages.Sage{a.melchior, a.balthazar, a.casper}
	nonDominant := make([]*sages.Sage, 0, 2)
	for _, s := range sageList {
		if s.GetName() != a.dominantSeelName {
			nonDominant = append(nonDominant, s)
		}
	}
	return nonDominant
}

// getDominantSage 返回当前主导者 sage 实例
func (a *MAGIAnswerer) getDominantSage() *sages.Sage {
	switch a.dominantSeelName {
	case "melchior":
		return a.melchior
	case "balthazar":
		return a.balthazar
	case "casper":
		return a.casper
	default:
		return nil
	}
}

// sageToEntity 将 sage 实例映射为 ATFEntity
func (a *MAGIAnswerer) sageToEntity(s *sages.Sage) ATFEntity {
	switch s.GetName() {
	case "melchior":
		return EntityMelchior
	case "balthazar":
		return EntityBalthazar
	case "casper":
		return EntityCasper
	default:
		return ""
	}
}

// callSageLLM 对指定 sage 发送完整上下文的请求。
// 使用 sage.BuildRequestMessagesForSession 构建完整消息链（system + status + 唤醒序列 + 历史记忆 + 用户消息），
// 确保 system prompt 已存在于 context 中。
func (a *MAGIAnswerer) callSageLLM(ctx context.Context, sage *sages.Sage, userPrompt string) (string, error) {
	client := sage.GetLLMClient()
	if client == nil {
		return "", fmt.Errorf("%s has no LLM client", sage.GetName())
	}

	const sessionId = "atf-sampling"

	// 确保 system prompt 在 context 中（与 SendMessage 行为一致）
	messages := sage.GetContextForSession(sessionId)
	if len(messages) == 0 && sage.GetSystemPrompt() != "" {
		_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: sage.GetSystemPrompt(),
		})
	}

	userMsg := types.ContextMessage{
		Role:    types.RoleUser,
		Content: userPrompt,
	}
	requestMessages := sage.BuildRequestMessagesForSession(sessionId, userMsg)

	if os.Getenv("SERAPH_ATF_LIVE") == "1" {
		fmt.Printf("[ATF-DEBUG] %s request messages (%d total):\n", sage.GetName(), len(requestMessages))
		for i, msg := range requestMessages {
			preview := msg.Content
			if len(preview) > 200 {
				preview = preview[:200] + "..."
			}
			fmt.Printf("  [%d] %s: %s\n", i, msg.Role, preview)
		}
	}

	content, err := client.SendChatRequestSync(ctx, requestMessages, nil, nil)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(content), nil
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

func buildQuestionPrompt(subject MonitorSubject, questions []IpipNeo120Item) string {
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
	sb.WriteString("重要规则：直接以文本格式输出答案，不要调用任何工具或函数。\n\n")
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

// askQuestionsWithRetry 以随机顺序、小批量追问的方式获取全部题目的答案。
// 每轮发送一小批问题，解析 LLM 返回的答案；对于遗漏的题目单独追问，
// 避免一次要求过多导致 LLM 输出截断。
func (a *MAGIAnswerer) askQuestionsWithRetry(
	ctx context.Context,
	sage *sages.Sage,
	subject MonitorSubject,
	allQuestions []IpipNeo120Item,
	batchSize int,
	maxRounds int,
) (*EntityAnswerResult, error) {
	fmt.Printf("[ATF] %s: starting with %d questions, batch=%d, maxRounds=%d\n", sage.GetName(), len(allQuestions), batchSize, maxRounds)
	remaining := cloneQuestions(allQuestions)
	answered := make(map[int]int) // qNum → score
	totalAnswered := 0
	var reflectionText string

	for round := 0; round < maxRounds && len(remaining) > 0; round++ {
		shuffleQuestions(remaining)
		batch := remaining
		if len(batch) > batchSize {
			batch = batch[:batchSize]
		}

		fmt.Printf("[ATF] %s round %d: asking %d questions (totally answered: %d, remaining: %d)\n",
			sage.GetName(), round, len(batch), totalAnswered, len(remaining))

		prompt := buildQuestionPrompt(subject, batch)
		content, llmErr := a.callSageLLM(ctx, sage, prompt)
		if llmErr != nil {
			fmt.Printf("[ATF] %s round %d: llm error: %v\n", sage.GetName(), round, llmErr)
			continue
		}

		fmt.Printf("[ATF] %s round %d: LLM raw response length=%d\n   FIRST 200: %s\n",
			sage.GetName(), round, len(content), truncateStr(content, 200))

		batchResult := parseAnswersLenient(content, batch)
		newCount := len(batchResult.answers)
		for q, score := range batchResult.answers {
			answered[q] = score
		}
		if batchResult.reflection != "" {
			if reflectionText != "" {
				reflectionText += "\n\n"
			}
			reflectionText += batchResult.reflection
		}

		fmt.Printf("[ATF] %s round %d: parsed %d/%d answers\n", sage.GetName(), round, newCount, len(batch))

		if newCount > 0 {
			unanswered := make([]IpipNeo120Item, 0, len(remaining))
			for _, q := range remaining {
				if _, ok := answered[q.Q]; !ok {
					unanswered = append(unanswered, q)
				}
			}
			remaining = unanswered
			totalAnswered = len(answered)
		}
	}

	if len(remaining) > 0 {
		return nil, fmt.Errorf("llm omitted %d questions after %d rounds", len(remaining), maxRounds)
	}

	answers := make([]RawAnswer, 0, len(allQuestions))
	for _, q := range allQuestions {
		answers = append(answers, RawAnswer{
			Q:     q.Q,
			Text:  q.Text,
			Score: answered[q.Q],
		})
	}

	return &EntityAnswerResult{
		Answers:    answers,
		Reflection: reflectionText,
	}, nil
}

type parsedBatchResult struct {
	answers    map[int]int
	reflection string
}

func parseAnswersLenient(content string, expected []IpipNeo120Item) parsedBatchResult {
	expectedSet := make(map[int]struct{}, len(expected))
	for _, q := range expected {
		expectedSet[q.Q] = struct{}{}
	}
	targetCount := len(expectedSet)

	answered := make(map[int]int)
	lines := strings.Split(content, "\n")
	var reflectionLines []string
	allMatched := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ".", 2)
		if len(parts) == 2 {
			qNum, err := strconv.Atoi(strings.TrimSpace(parts[0]))
			if err == nil {
				if _, ok := expectedSet[qNum]; ok {
					if _, exists := answered[qNum]; !exists {
						answer := strings.TrimSpace(parts[1])
						score := likertTextToScore(answer)
						if score > 0 {
							answered[qNum] = score
							if len(answered) >= targetCount {
								allMatched = true
							}
							continue
						}
					}
				}
			}
		}

		if allMatched {
			reflectionLines = append(reflectionLines, line)
		}
	}

	reflection := strings.TrimSpace(strings.Join(reflectionLines, " "))
	return parsedBatchResult{
		answers:    answered,
		reflection: reflection,
	}
}

// shuffleQuestions 随机打乱题目顺序（Fisher-Yates）
func shuffleQuestions(items []IpipNeo120Item) {
	n := len(items)
	for i := n - 1; i > 0; i-- {
		j := int(float64(i+1) * float64(i+7) / float64(n+1))
		j = j % (i + 1)
		items[i], items[j] = items[j], items[i]
	}
}

func truncateStr(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return string(runes)
	}
	return string(runes[:maxLen]) + "..."
}
