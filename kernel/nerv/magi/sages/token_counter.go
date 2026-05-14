package sages

import (
	"encoding/base64"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pkoukk/tiktoken-go"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	gpt35Encoder    *tiktoken.Tiktoken
	gpt4oEncoder    *tiktoken.Tiktoken
	gpt4Encoder     *tiktoken.Tiktoken
	defaultEncoder  *tiktoken.Tiktoken
	encoderMap      = map[string]*tiktoken.Tiktoken{}
	encoderMu       sync.RWMutex
	encodersReady   bool
	tiktokenDirPath string
)

// InitTokenEncoders 预加载 token 编码器。
func InitTokenEncoders() error {
	return InitTokenEncodersWithDir(filepath.Join(util.WorkingDir, "tiktoken"))
}

func InitTokenEncodersWithDir(tiktokenDir string) error {
	http.DefaultClient.Timeout = 5 * time.Second

	if absDir, err := filepath.Abs(tiktokenDir); err == nil {
		tiktokenDir = absDir
	}
	os.MkdirAll(tiktokenDir, 0755)
	tiktokenDirPath = tiktokenDir

	defaultLoader := tiktoken.NewDefaultBpeLoader()
	tiktoken.SetBpeLoader(&localRedirectLoader{dir: tiktokenDir, fallback: defaultLoader})

	var err error
	gpt35Encoder, err = tiktoken.EncodingForModel("gpt-3.5-turbo")
	if err != nil {
		logging.LogWarnf("加载 gpt-3.5-turbo 编码器失败: %v (请将 cl100k_base.tiktoken 放入 %s)", err, tiktokenDir)
		return nil
	}
	defaultEncoder = gpt35Encoder

	gpt4oEncoder, err = tiktoken.EncodingForModel("gpt-4o")
	if err != nil {
		logging.LogWarnf("加载 gpt-4o 编码器失败: %v (请将 o200k_base.tiktoken 放入 %s)", err, tiktokenDir)
	}

	gpt4Encoder, err = tiktoken.EncodingForModel("gpt-4")
	if err != nil {
		logging.LogWarnf("加载 gpt-4 编码器失败: %v", err)
	}

	encodersReady = true
	logging.LogInfof("token 编码器初始化完成, 本地目录: %s", tiktokenDir)
	return nil
}

// localRedirectLoader 将 Azure blob URL 重定向到本地文件。
type localRedirectLoader struct {
	dir      string
	fallback tiktoken.BpeLoader
}

func (l *localRedirectLoader) LoadTiktokenBpe(blobpath string) (map[string]int, error) {
	if strings.HasPrefix(blobpath, "https://openaipublic.blob.core.windows.net/encodings/") {
		name := filepath.Base(blobpath)
		if ranks, err := loadBpeFile(filepath.Join(l.dir, name)); err == nil {
			return ranks, nil
		}
	}
	return l.fallback.LoadTiktokenBpe(blobpath)
}

func loadBpeFile(path string) (map[string]int, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	ranks := make(map[string]int)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) != 2 {
			continue
		}
		token, err := base64.StdEncoding.DecodeString(parts[0])
		if err != nil {
			return nil, err
		}
		rank, err := strconv.Atoi(parts[1])
		if err != nil {
			return nil, err
		}
		ranks[string(token)] = rank
	}
	return ranks, nil
}

func getTokenEncoder(model string) *tiktoken.Tiktoken {
	model = strings.TrimSpace(strings.ToLower(model))

	encoderMu.RLock()
	if enc, ok := encoderMap[model]; ok {
		encoderMu.RUnlock()
		return enc
	}
	encoderMu.RUnlock()

	if !encodersReady {
		return nil
	}

	switch {
	case strings.HasPrefix(model, "gpt-3.5"):
		encoderMap[model] = gpt35Encoder
	case strings.HasPrefix(model, "gpt-4o"):
		encoderMap[model] = gpt4oEncoder
	case strings.HasPrefix(model, "gpt-4"):
		encoderMap[model] = gpt4Encoder
	default:
		enc, err := tiktoken.EncodingForModel(model)
		if err != nil {
			encoderMap[model] = defaultEncoder
		} else {
			encoderMap[model] = enc
		}
	}
	return encoderMap[model]
}

func getModelMaxContextTokens(model string) int {
	m := strings.ToLower(strings.TrimSpace(model))
	switch {
	case strings.Contains(m, "gpt-4.5"):
		return 128000
	case strings.Contains(m, "gpt-4.1"):
		return 1048576
	case strings.Contains(m, "gpt-4o"):
		return 128000
	case strings.Contains(m, "gpt-4-32k"):
		return 32768
	case strings.Contains(m, "gpt-4") && !strings.Contains(m, "gpt-4o"):
		return 8192
	case strings.Contains(m, "gpt-3.5-turbo-16k"):
		return 16385
	case strings.Contains(m, "gpt-3.5"):
		return 4096
	case strings.Contains(m, "sonnet") || strings.Contains(m, "haiku") || strings.Contains(m, "opus"):
		return 1000000
	case strings.Contains(m, "claude-3") || strings.Contains(m, "claude-4"):
		return 200000
	case strings.Contains(m, "claude-"):
		return 200000
	case strings.Contains(m, "deepseek"):
		return 1000000
	case strings.Contains(m, "gemini-2"):
		return 1048576
	case strings.Contains(m, "gemini"):
		return 32768
	case strings.Contains(m, "qwen2.5"):
		return 131072
	case strings.Contains(m, "qwen"):
		return 32768
	case strings.Contains(m, "llama3"):
		return 131072
	default:
		return 128000
	}
}

func countMessageTokens(enc *tiktoken.Tiktoken, msg types.ContextMessage) int {
	tokens := 3
	if msg.Content != "" {
		tokens += len(enc.Encode(msg.Content, nil, nil))
	}
	if msg.ReasoningContent != "" {
		tokens += len(enc.Encode(msg.ReasoningContent, nil, nil))
	}
	for _, tc := range msg.ToolCalls {
		tokens += len(enc.Encode(tc.Function.Name, nil, nil))
		tokens += len(enc.Encode(tc.Function.Arguments, nil, nil))
	}
	if msg.Role == types.RoleTool && msg.ToolID != "" {
		tokens += len(enc.Encode(msg.ToolID, nil, nil))
	}
	return tokens
}

func countContextTokens(messages []types.ContextMessage, enc *tiktoken.Tiktoken) int {
	total := 0
	for _, msg := range messages {
		total += countMessageTokens(enc, msg)
	}
	return total
}

// roundGroup 裁剪时使用的轮次分组。
type roundGroup struct {
	RoundID  string
	Messages []types.ContextMessage
	Tokens   int
	Dominant bool
	Heartbeat bool
}

// roundPriority 轮次保留优先级：主导 > 普通 > 心跳。
func (r roundGroup) priority() int {
	if r.Dominant {
		return 2
	}
	if r.Heartbeat {
		return 0
	}
	return 1
}

func groupByRound(messages []types.ContextMessage, startIdx int) []roundGroup {
	var rounds []roundGroup
	for i := startIdx; i < len(messages); i++ {
		msg := messages[i]
		rid := msg.RoundID
		if rid == "" {
			rid = "__no_round__"
		}
		if len(rounds) == 0 || rounds[len(rounds)-1].RoundID != rid {
			rounds = append(rounds, roundGroup{RoundID: rid, Dominant: msg.Dominant, Heartbeat: msg.Heartbeat})
		}
		if msg.Dominant {
			rounds[len(rounds)-1].Dominant = true
		}
		if msg.Heartbeat {
			rounds[len(rounds)-1].Heartbeat = true
		}
		rounds[len(rounds)-1].Messages = append(rounds[len(rounds)-1].Messages, msg)
	}
	return rounds
}

// sortRoundsForKeep 按优先级 + 倒序排序：高优先级在前，同优先级下最新的在前。
func sortRoundsForKeep(rounds []roundGroup) []roundGroup {
	sorted := make([]roundGroup, len(rounds))
	copy(sorted, rounds)
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			pi, pj := sorted[i].priority(), sorted[j].priority()
			if pi < pj || (pi == pj && i > j) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	return sorted
}

// trimByRoundTokenPercent 按轮次裁剪上下文。
// percent 使用百分比值（如 50 表示 50%）；触发后裁剪到目标线。优先保留主导轮次，优先丢弃心跳轮次。
func trimByRoundTokenPercent(messages []types.ContextMessage, percent float64, model string) []types.ContextMessage {
	if percent <= 0 || percent > 100 || len(messages) == 0 {
		return messages
	}

	enc := getTokenEncoder(model)
	if enc == nil {
		logging.LogWarnf("trimByRoundTokenPercent: 编码器未就绪 [%s]，跳过token裁剪", model)
		return messages
	}

	maxContextTokens := getModelMaxContextTokens(model)
	triggerTokens := int(float64(maxContextTokens) * percent / 100.0)
	targetTokens := int(float64(maxContextTokens) * percent / 100.0 * 0.2)

	var systemMsg *types.ContextMessage
	startIdx := 0
	if len(messages) > 0 && messages[0].Role == types.RoleSystem {
		msg := messages[0]
		systemMsg = &msg
		startIdx = 1
	}

	rounds := groupByRound(messages, startIdx)

	systemTokens := 0
	if systemMsg != nil {
		systemTokens = countMessageTokens(enc, *systemMsg)
	}

	totalDataTokens := 0
	for i := range rounds {
		rounds[i].Tokens = countContextTokens(rounds[i].Messages, enc)
		totalDataTokens += rounds[i].Tokens
	}
	totalTokens := systemTokens + totalDataTokens

	if totalTokens <= triggerTokens {
		return messages
	}

	dataTarget := targetTokens - systemTokens
	if dataTarget <= 0 {
		if systemMsg != nil {
			return []types.ContextMessage{*systemMsg}
		}
		return []types.ContextMessage{}
	}

	// 按优先级排序后，从高到低累积至目标线
	sorted := sortRoundsForKeep(rounds)
	keptSet := map[string]bool{}
	accumulatedTokens := 0
	for _, r := range sorted {
		if accumulatedTokens+r.Tokens > dataTarget {
			continue
		}
		accumulatedTokens += r.Tokens
		keptSet[r.RoundID] = true
	}

	// 确保最后一轮（当前轮）始终保留
	lastRID := rounds[len(rounds)-1].RoundID
	keptSet[lastRID] = true

	keptTokens := systemTokens
	for _, r := range rounds {
		if keptSet[r.RoundID] {
			keptTokens += r.Tokens
		}
	}

	var dropCount int
	for _, r := range rounds {
		if !keptSet[r.RoundID] {
			dropCount += len(r.Messages)
		}
	}
	logging.LogInfof("trimByRoundTokenPercent: 裁剪 %d 条, %d → %d token (预警: %d, 目标: %d)",
		dropCount, totalTokens, keptTokens, triggerTokens, targetTokens)

	var result []types.ContextMessage
	if systemMsg != nil {
		result = append(result, *systemMsg)
	}
	for _, r := range rounds {
		if keptSet[r.RoundID] {
			result = append(result, r.Messages...)
		}
	}
	return result
}

// ─── 疲劳值/唤醒值算法 ───

// countContextTokensFallback 统计上下文 token 数，优先使用 tiktoken 编码器，
// 编码器未就绪时回退到字符估算。
func countContextTokensFallback(messages []types.ContextMessage, model string) int {
	enc := getTokenEncoder(model)
	if enc != nil {
		return countContextTokens(messages, enc)
	}
	logging.LogWarnf("countContextTokensFallback: 编码器未就绪 [%s]，tiktoken 目录 [%s]，回退到字符估算", model, tiktokenDirPath)
	return estimateContextTokens(messages)
}

// estimateContextTokens 基于字符类别估算 token 数。
// ASCII 字符按 4 chars/token，非 ASCII（含 CJK）按 2 chars/token。
func estimateContextTokens(messages []types.ContextMessage) int {
	total := 0
	for _, msg := range messages {
		total += estimateStringTokens(msg.Content)
		total += estimateStringTokens(msg.ReasoningContent)
	}
	if total <= 0 {
		return 0
	}
	if total < 1 {
		return 1
	}
	return total
}

func estimateStringTokens(s string) int {
	ascii := 0
	other := 0
	for _, r := range s {
		if r < 128 {
			ascii++
		} else {
			other++
		}
	}
	return ascii/4 + other/2
}

// countUniqueRounds 统计消息中不重复的轮次数（排除 RoundID 为空的条目）。
func countUniqueRounds(messages []types.ContextMessage) int {
	seen := make(map[string]bool)
	for _, msg := range messages {
		if msg.RoundID != "" {
			seen[msg.RoundID] = true
		}
	}
	return len(seen)
}

func clampTo100(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

// ─── 疲劳值 —— 衡量认知过载 / 幻觉风险 ───

// CalculateFatigue 计算疲劳值 (0-100)。
// 以策略预算上限为分母，convex 增长（^1.5）：早期负荷影响小，接近上限时加速攀升。
// 疲劳值越高，上下文被裁剪的概率越大（开始遗忘信息）。
func CalculateFatigue(messages []types.ContextMessage, strategy *config.ContextStrategy, model string) float64 {
	if strategy == nil || len(messages) == 0 {
		return 0
	}

	switch strategy.Type {
	case "token_percent":
		if strategy.Percent <= 0 {
			return 0
		}
		maxTokens := getModelMaxContextTokens(model)
		if maxTokens <= 0 {
			return 0
		}
		limit := float64(maxTokens) * strategy.Percent / 100.0
		if limit <= 0 {
			return 0
		}
		actual := float64(countContextTokensFallback(messages, model))
		ratio := actual / limit
		return clampTo100(math.Pow(ratio, 1.5) * 100)

	case "round_count":
		if strategy.Count <= 0 {
			return 0
		}
		actual := float64(countUniqueRounds(messages))
		ratio := actual / float64(strategy.Count)
		return clampTo100(math.Pow(ratio, 1.5) * 100)

	case "message_count":
		if strategy.Count <= 0 {
			return 0
		}
		nonSystem := 0
		for _, msg := range messages {
			if msg.Role != types.RoleSystem {
				nonSystem++
			}
		}
		ratio := float64(nonSystem) / float64(strategy.Count)
		return clampTo100(math.Pow(ratio, 1.5) * 100)

	default:
		return 0
	}
}

// ─── 唤醒值 —— 衡量上下文信息丰富度 ───

// CalculateWakefulness 计算唤醒值 (0-100)。
// 以原始模型上限 / 3 为甜点，concave 增长（sqrt）：少量上下文即显著提升，随后边际递减。
// 唤醒值独立于策略预算——不同贤人以相同信息量获得相同唤醒值。
// 深度休息清空上下文后唤醒值暂时降低。
func CalculateWakefulness(messages []types.ContextMessage, strategy *config.ContextStrategy, model string) float64 {
	if strategy == nil || len(messages) == 0 {
		return 0
	}

	switch strategy.Type {
	case "token_percent":
		maxTokens := getModelMaxContextTokens(model)
		if maxTokens <= 0 {
			return 0
		}
		sweet := float64(maxTokens) / 3 // 原始模型上限，不受策略 Percent 影响
		if sweet <= 0 {
			return 0
		}
		actual := float64(countContextTokensFallback(messages, model))
		ratio := actual / sweet
		return clampTo100(math.Sqrt(ratio) * 100)

	case "round_count":
		if strategy.Count <= 0 {
			return 0
		}
		sweet := float64(strategy.Count) / 3
		if sweet <= 0 {
			return 0
		}
		actual := float64(countUniqueRounds(messages))
		return clampTo100(math.Sqrt(actual/sweet) * 100)

	case "message_count":
		if strategy.Count <= 0 {
			return 0
		}
		sweet := float64(strategy.Count) / 3
		if sweet <= 0 {
			return 0
		}
		nonSystem := 0
		for _, msg := range messages {
			if msg.Role != types.RoleSystem {
				nonSystem++
			}
		}
		return clampTo100(math.Sqrt(float64(nonSystem)/sweet) * 100)

	default:
		return 0
	}
}

// FatigueLevel 将疲劳值数值 (0-100) 映射为程度描述。
func FatigueLevel(fatigue float64) string {
	switch {
	case fatigue < 30:
		return "正常"
	case fatigue < 60:
		return "较高"
	case fatigue < 85:
		return "很高"
	default:
		return "极高"
	}
}

// WakefulnessLevel 将唤醒值数值 (0-100) 映射为程度描述。
func WakefulnessLevel(wakefulness float64) string {
	switch {
	case wakefulness < 30:
		return "低"
	case wakefulness < 60:
		return "正常"
	case wakefulness < 85:
		return "较高"
	default:
		return "高"
	}
}

// trimByRoundCount 保留最近 N 轮，优先保留主导轮次，优先丢弃心跳轮次。
func trimByRoundCount(messages []types.ContextMessage, maxRounds int) []types.ContextMessage {
	if maxRounds <= 0 || len(messages) == 0 {
		return messages
	}

	var systemMsg *types.ContextMessage
	startIdx := 0
	if len(messages) > 0 && messages[0].Role == types.RoleSystem {
		msg := messages[0]
		systemMsg = &msg
		startIdx = 1
	}

	rounds := groupByRound(messages, startIdx)
	if len(rounds) <= maxRounds {
		return messages
	}

	sorted := sortRoundsForKeep(rounds)
	keptSet := map[string]bool{}
	for _, r := range sorted {
		if len(keptSet) >= maxRounds {
			break
		}
		keptSet[r.RoundID] = true
	}

	var dropCount int
	for _, r := range rounds {
		if !keptSet[r.RoundID] {
			dropCount += len(r.Messages)
		}
	}
	logging.LogInfof("trimByRoundCount: 裁剪 %d 条, 保留 %d 轮 (优先主导, 优先丢弃心跳)", dropCount, len(keptSet))

	var result []types.ContextMessage
	if systemMsg != nil {
		result = append(result, *systemMsg)
	}
	for _, r := range rounds {
		if keptSet[r.RoundID] {
			result = append(result, r.Messages...)
		}
	}
	return result
}
