// Package llm 提供 MAGI 系统的 LLM 客户端封装。
package llm

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"

	"s-forge.local/chatseqtrie"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
)

// PrefixCacheMonitor 统一的前缀缓存监控器。
//
// 设计目标（2026-08-02 确认，参考 Reasonix Cache-first 铁律与 chatseqtrie 暴露测试）：
//   - 在请求到达 go-openai 之前，通过 HTTPDoer 拦截原始请求/响应（复用 util.NewOpenAIClientWithHTTPDoer 扩展点）；
//   - 请求前：用 chatseqtrie（消息级前缀树，全字段策略）预测本次请求的「命中消息数 / 新增消息」，
//     并判断是否创建了新的前缀链条（IsVariant / BranchPoint）；
//   - 响应后：若原始响应包含缓存命中信息（DeepSeek 的 prompt_cache_hit_tokens / prompt_cache_miss_tokens，
//     go-openai 的 Usage 结构会丢弃这两个字段），用它持续校准本地预测算法（消息级 → token 级换算系数）；
//   - 当原始响应不含缓存命中信息时，用已校准的算法估算命中/新增 token 数——保证监控在任何时候都可用。
type PrefixCacheMonitor struct {
	trie *chatseqtrie.Trie

	mu sync.RWMutex
	// 校准状态：消息级预测 → token 级估算的换算系数（EMA 平滑）。
	// 每次拿到真实 usage 时更新；没有真实 usage 时用它估算。
	calibratedTokenPerMsg float64 // 每条新增消息平均 token 数
	calibSamples          int
	calibLastAt           time.Time
}

// NewPrefixCacheMonitor 创建前缀缓存监控器。
func NewPrefixCacheMonitor() *PrefixCacheMonitor {
	return &PrefixCacheMonitor{
		// 全字段策略（nil = 全部字段参与匹配）：与 DeepSeek token 化对齐
		// （暴露测试结论：默认 FieldPolicy 忽略 tool_calls id / reasoning_content，会高估命中）
		trie: chatseqtrie.New(chatseqtrie.WithFieldPolicy(nil)),
	}
}

// MonitorTransport 实现 openai.HTTPDoer，在请求到达 go-openai 之前拦截原始请求/响应。
type MonitorTransport struct {
	base    openai.HTTPDoer
	monitor *PrefixCacheMonitor
}

// Do 拦截一次 HTTP 往返：
//  1. 请求前：读取原始请求体（messages + tools），构造监控序列（tools 指纹 + OpenAI 消息），
//     chatseqtrie.Match 预测 → chatseqtrie.Insert 记录；随后恢复请求体原样转发；
//  2. 转发请求；
//  3. 响应后：读取原始响应体，提取 usage 缓存命中信息 → 校准或估算；随后恢复响应体。
//
// 请求来源（sage/业务类型/会话）通过 ctx 注入（llm.WithRequestSource），
// go-openai 用 http.NewRequestWithContext 构造请求，因此 req.Context() 可直接读取。
func (t *MonitorTransport) Do(req *http.Request) (*http.Response, error) {
	if t.monitor == nil || req == nil || req.Body == nil {
		return t.base.Do(req)
	}

	// 读取请求来源并补充 URL，供缓存命中日志定位调用方。
	src := RequestSourceFromContext(req.Context())
	if src.URL == "" && req.URL != nil {
		src.URL = req.URL.String()
	}

	// ---- 请求前：提取原始请求体，构造监控序列 ----
	rawBody, err := io.ReadAll(req.Body)
	if err != nil {
		// 读取失败不阻断请求：恢复原 body 后原样转发
		return t.base.Do(req)
	}
	// 恢复请求体（必须，go-openai 还需要它）
	req.Body = io.NopCloser(bytes.NewReader(rawBody))
	req.ContentLength = int64(len(rawBody))

	seq, parseErr := buildMonitorSequence(rawBody)
	var prediction *prefixPrediction
	if parseErr == nil && len(seq) > 0 {
		prediction = t.monitor.predictAndRecord(seq, src)
	} else if parseErr != nil {
		observability.Detailf("[prefix-cache] %s 请求体解析失败: %v", src, parseErr)
	}

	// ---- 转发 ----
	start := time.Now()
	resp, err := t.base.Do(req)
	elapsed := time.Since(start)
	if err != nil {
		if prediction != nil {
			t.monitor.recordRequest(prediction, nil, elapsed, err, src)
		}
		return nil, err
	}

	// ---- 响应后：提取 usage 缓存命中信息（原始响应体） ----
	t.monitor.captureResponseUsage(resp, prediction, elapsed, src)
	return resp, nil
}

// prefixPrediction chatseqtrie 对一次请求的预测结果。
type prefixPrediction struct {
	commonPrefixLen int  // 命中消息条数（含 tools_fingerprint，若已命中）
	suffixMsgs      int  // 新增消息条数（含 tools_fingerprint，若未命中）
	isVariant       bool // 是否创建新前缀链条
	branchPoint     int  // 分叉位置
	seqLen          int  // 监控序列总消息数
}

// newModelMsgs 返回本次请求「新增的实际消息条数」——排除 tools_fingerprint 辅助条目。
// 指纹位于监控序列首位：commonPrefixLen==0 时指纹未命中（属于新增部分），需减 1；
// commonPrefixLen>=1 时指纹已命中，新增部分全部是实际消息。
// 校准系数语义为「每条新增实际消息的平均 token 数」，必须排除指纹，否则首次请求
// 会把指纹当作一条消息摊薄系数（如 miss=200/新增2条=100，实际应为 200/1=200）。
func (p *prefixPrediction) newModelMsgs() int {
	if p == nil {
		return 0
	}
	n := p.suffixMsgs
	if p.commonPrefixLen <= 0 && n > 0 {
		n--
	}
	if n < 0 {
		n = 0
	}
	return n
}

// hitModelMsgs 返回本次请求「命中的实际消息条数」——排除 tools_fingerprint 辅助条目。
// 指纹代表 tools 定义的 token 量，不应按「每条消息」系数估算其 token 数。
func (p *prefixPrediction) hitModelMsgs() int {
	if p == nil || p.commonPrefixLen <= 0 {
		return 0
	}
	return p.commonPrefixLen - 1
}

// predictAndRecord 用 chatseqtrie 预测本次请求并记录新前缀链条。
// 每请求独立 sessionID（暴露测试结论：复用 sessionID 会移动终标记、丢失历史）。
// src 为请求来源（sage/业务类型/会话），写入日志便于事后定位低命中率来源。
func (m *PrefixCacheMonitor) predictAndRecord(seq []chatseqtrie.Message, src RequestSource) *prefixPrediction {
	m.mu.Lock()
	defer m.mu.Unlock()

	sessionID := "req-" + time.Now().UTC().Format("20060102T150405.000000000Z")
	// 先 Match 预测（不插入），再 Insert 记录
	match, err := m.trie.Match(seq)
	if err != nil {
		observability.Detailf("[prefix-cache] %s Match 失败: %v", src, err)
		return nil
	}
	if _, err := m.trie.Insert(sessionID, seq); err != nil {
		observability.Detailf("[prefix-cache] %s Insert 失败: %v", src, err)
	}

	pred := &prefixPrediction{
		commonPrefixLen: match.CommonPrefixLen,
		suffixMsgs:      len(match.Suffix),
		isVariant:       match.IsVariant,
		branchPoint:     match.BranchPoint,
		seqLen:          len(seq),
	}
	observability.Detailf("[prefix-cache] %s 预测: 命中=%d 新增=%d 变体=%v 分叉=%d 序列=%d",
		src, pred.commonPrefixLen, pred.suffixMsgs, pred.isVariant, pred.branchPoint, pred.seqLen)
	return pred
}

// usageCacheInfo DeepSeek 原始响应中的缓存命中信息。
type usageCacheInfo struct {
	HitTokens  int `json:"prompt_cache_hit_tokens"`
	MissTokens int `json:"prompt_cache_miss_tokens"`
	// 兼容 prompt_tokens_details.cached_tokens（部分网关只给这个）
	PromptTokens int `json:"prompt_tokens"`
	CachedTokens int `json:"cached_tokens"`
}

// captureResponseUsage 从原始响应体提取 usage 缓存命中信息。
//   - 非流式（JSON）：直接解析响应体；
//   - 流式（SSE）：DeepSeek 在流末尾的 data 块携带 usage，需边透传边解析。
//
// 响应体会被包装/恢复，不破坏原始消费方（go-openai）。
// src 为请求来源（sage/业务类型/会话），随记录写入日志便于事后定位。
func (m *PrefixCacheMonitor) captureResponseUsage(resp *http.Response, prediction *prefixPrediction, elapsed time.Duration, src RequestSource) {
	if resp == nil || resp.Body == nil {
		return
	}
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") {
		// 流式：包装 body 为透传 + SSE usage 解析器
		resp.Body = &sseUsageBody{
			src: resp.Body,
			onUsage: func(hit, miss int) {
				m.recordRequest(prediction, &usageCacheInfo{HitTokens: hit, MissTokens: miss}, elapsed, nil, src)
			},
		}
		return
	}

	// 非流式：读取原始响应体，解析 usage，恢复 body
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	var payload struct {
		Usage *struct {
			PromptTokens          int `json:"prompt_tokens"`
			PromptCacheHitTokens  int `json:"prompt_cache_hit_tokens"`
			PromptCacheMissTokens int `json:"prompt_cache_miss_tokens"`
			PromptTokensDetails   struct {
				CachedTokens int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.Usage == nil {
		// 无 usage 字段：用已校准算法估算（本地预测仍有效）
		m.recordRequest(prediction, nil, elapsed, nil, src)
		return
	}
	u := payload.Usage
	hit := u.PromptCacheHitTokens
	if hit == 0 && u.PromptTokensDetails.CachedTokens > 0 {
		hit = u.PromptTokensDetails.CachedTokens
	}
	miss := u.PromptCacheMissTokens
	m.recordRequest(prediction, &usageCacheInfo{
		HitTokens:    hit,
		MissTokens:   miss,
		PromptTokens: u.PromptTokens,
		CachedTokens: u.PromptTokensDetails.CachedTokens,
	}, elapsed, nil, src)
}

// recordRequest 汇总一次请求的监控数据：
//   - 有真实 usage → 校准本地算法（EMA 更新每条新增消息的平均 token 数），并记录实际值；
//   - 无真实 usage → 用已校准系数估算命中/新增 token，记录估算值。
//
// src 为请求来源（sage/业务类型/会话），随记录写入日志便于事后定位。
func (m *PrefixCacheMonitor) recordRequest(pred *prefixPrediction, usage *usageCacheInfo, elapsed time.Duration, err error, src RequestSource) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if pred == nil {
		pred = &prefixPrediction{}
	}

	// 有真实 usage：校准换算系数
	if usage != nil {
		// 新增条数排除 tools_fingerprint 辅助条目（校准系数语义 = 每条实际消息的 token 数）
		if newMsgs := pred.newModelMsgs(); newMsgs > 0 && usage.MissTokens > 0 {
			perMsg := float64(usage.MissTokens) / float64(newMsgs)
			// EMA 平滑：新样本权重 0.2，历史权重 0.8（前 5 个样本快速收敛）
			alpha := 0.2
			if m.calibSamples < 5 {
				alpha = 0.5
			}
			if m.calibratedTokenPerMsg == 0 {
				m.calibratedTokenPerMsg = perMsg
			} else {
				m.calibratedTokenPerMsg = alpha*perMsg + (1-alpha)*m.calibratedTokenPerMsg
			}
			m.calibSamples++
			m.calibLastAt = time.Now()
		}
		observability.Detailf("[prefix-cache] %s 实际: hit=%d miss=%d prompt=%d 校准系数=%.2f/条(样本%d)",
			src, usage.HitTokens, usage.MissTokens, usage.PromptTokens, m.calibratedTokenPerMsg, m.calibSamples)
		return
	}

	// 无真实 usage：用已校准系数估算（新增/命中条数均排除 tools_fingerprint 辅助条目）
	estMiss := int(m.calibratedTokenPerMsg * float64(pred.newModelMsgs()))
	estHit := 0
	if m.calibratedTokenPerMsg > 0 {
		// 命中消息的估算：命中消息条数 × 系数（命中与新增消息平均 token 近似相同，保守起见不放大）
		estHit = int(m.calibratedTokenPerMsg * float64(pred.hitModelMsgs()))
	}
	status := "估算(无usage)"
	if m.calibSamples == 0 {
		status = "估算(未校准)"
	}
	observability.Detailf("[prefix-cache] %s %s: 命中≈%d 新增≈%d tokens (系数=%.2f/条, 样本=%d) 变体=%v 分叉=%d 耗时=%v err=%v",
		src, status, estHit, estMiss, m.calibratedTokenPerMsg, m.calibSamples, pred.isVariant, pred.branchPoint, elapsed, err)
}

// buildMonitorSequence 从原始请求体构造监控序列：
// [tools_fingerprint] + OpenAI 消息序列。
// tools 指纹作为首条消息：tools 一旦变化，首条不匹配 → 全量 MISS 被精确捕获
// （对应 DeepSeek 前缀最前部，暴露测试结论 4）。
func buildMonitorSequence(rawBody []byte) ([]chatseqtrie.Message, error) {
	var payload struct {
		Messages []map[string]any `json:"messages"`
		Tools    []any            `json:"tools"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, err
	}

	// tools 指纹
	toolsJSON, _ := json.Marshal(payload.Tools)
	sum := sha256.Sum256(toolsJSON)
	seq := []chatseqtrie.Message{
		{"type": "tools_fingerprint", "content": hex.EncodeToString(sum[:])},
	}

	seq = append(seq, chatseqtrie.ConvertOpenAIMessages(payload.Messages)...)
	return seq, nil
}

// sseUsageBody 透传 SSE 流，同时解析 data 块中的 usage 缓存命中信息。
// 不缓冲、不修改流内容，仅在读到含 usage 的 data 行时回调 onUsage。
type sseUsageBody struct {
	src     io.Reader
	onUsage func(hit, miss int)
	pending []byte // 行缓冲（处理跨 Read 的行边界）
}

func (b *sseUsageBody) Read(p []byte) (int, error) {
	n, err := b.src.Read(p)
	if n > 0 {
		b.parse(p[:n])
	}
	return n, err
}

func (b *sseUsageBody) Close() error {
	if closer, ok := b.src.(io.Closer); ok {
		return closer.Close()
	}
	return nil
}

func (b *sseUsageBody) parse(chunk []byte) {
	b.pending = append(b.pending, chunk...)
	for {
		idx := bytes.IndexByte(b.pending, '\n')
		if idx < 0 {
			if len(b.pending) > 64*1024 {
				b.pending = b.pending[:0] // 异常长行，丢弃防内存膨胀
			}
			return
		}
		line := b.pending[:idx]
		b.pending = b.pending[idx+1:]
		trimmed := bytes.TrimSpace(line)
		if !bytes.HasPrefix(trimmed, []byte("data:")) {
			continue
		}
		data := bytes.TrimSpace(trimmed[len("data:"):])
		if len(data) == 0 {
			continue
		}
		var block struct {
			Usage *struct {
				PromptCacheHitTokens  int `json:"prompt_cache_hit_tokens"`
				PromptCacheMissTokens int `json:"prompt_cache_miss_tokens"`
				PromptTokensDetails   struct {
					CachedTokens int `json:"cached_tokens"`
				} `json:"prompt_tokens_details"`
			} `json:"usage"`
		}
		if err := json.Unmarshal(data, &block); err != nil || block.Usage == nil {
			continue
		}
		hit := block.Usage.PromptCacheHitTokens
		if hit == 0 && block.Usage.PromptTokensDetails.CachedTokens > 0 {
			hit = block.Usage.PromptTokensDetails.CachedTokens
		}
		if b.onUsage != nil {
			b.onUsage(hit, block.Usage.PromptCacheMissTokens)
		}
	}
}

var _ = logging.LogInfof // 保留 logging 导入（后续扩展告警用）
