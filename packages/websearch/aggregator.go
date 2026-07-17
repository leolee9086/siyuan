package websearch

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

func itoa(n int) string { return strconv.Itoa(n) }

// ── 归一化 ─────────────────────────────────────────────

// Levenshtein 计算编辑距离（滚动数组优化，空间 O(n)）
func Levenshtein(a, b string) int {
	m, n := len(a), len(b)
	if m == 0 {
		return n
	}
	if n == 0 {
		return m
	}
	prev := make([]int, n+1)
	curr := make([]int, n+1)
	for j := 0; j <= n; j++ {
		prev[j] = j
	}
	for i := 1; i <= m; i++ {
		curr[0] = i
		for j := 1; j <= n; j++ {
			if a[i-1] == b[j-1] {
				curr[j] = prev[j-1]
			} else {
				curr[j] = min(prev[j], curr[j-1], prev[j-1]) + 1
			}
		}
		prev, curr = curr, prev
	}
	return prev[n]
}

func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

func isSimilarTitle(a, b string) bool {
	if a == b {
		return true
	}
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	if maxLen == 0 {
		return true
	}
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}
	if minLen > 0 && float64(maxLen-minLen)/float64(maxLen) > 0.3 {
		return false
	}
	return float64(Levenshtein(a, b))/float64(maxLen) < 0.2
}

// ── 评分 ───────────────────────────────────────────────

// CalculateScore 计算聚合评分
// 评分组成：
// 1. 基础分 = Σ(weight / position)
// 2. 多样性加分 = 基础分 × (1 + (引擎数-1) × 0.2)
// 3. 时效性衰减 = 分 × max(0.5, 1 - 天数/365)
// 4. 文本相关性加分 = 标题匹配 × 2.0 + snippet匹配 × 1.0
func CalculateScore(
	engines []string,
	positions []int,
	weights map[string]float64,
	publishedDate int64,
	title, snippet, query string,
) float64 {
	var score float64
	for i := range engines {
		w := 1.0
		if weights != nil {
			if v, ok := weights[engines[i]]; ok {
				w = v
			}
		}
		if positions[i] > 0 {
			score += w / float64(positions[i])
		}
	}

	// 引擎多样性加分
	if len(engines) > 1 {
		score *= 1 + float64(len(engines)-1)*0.2
	}

	// 时效性加分
	if publishedDate > 0 {
		daysAgo := float64(nowMs()-publishedDate) / 86400000.0
		recencyFactor := math.Max(0.5, 1.0-daysAgo/365.0)
		score *= recencyFactor
	}

	// 文本相关性加分
	if query != "" && (title != "" || snippet != "") {
		titleRel := snippetRelevance(title, query)
		snippetRel := snippetRelevance(snippet, query)
		score += titleRel*2.0 + snippetRel*1.0
	}

	return score
}

func snippetRelevance(snippet, query string) float64 {
	if query == "" || snippet == "" {
		return 0
	}
	terms := strings.Fields(strings.ToLower(query))
	lower := strings.ToLower(snippet)
	if len(terms) == 0 {
		return 0
	}
	count := 0
	for _, t := range terms {
		if strings.Contains(lower, t) {
			count++
		}
	}
	return float64(count) / float64(len(terms))
}

// ── 聚合 ───────────────────────────────────────────────

// AggregateContext 聚合上下文
type AggregateContext struct {
	Weights    map[string]float64
	MaxResults int
	Suggestion string
}

// Aggregate 执行多阶段聚合：URL 去重 → 相似标题合并 → 评分排序 → 域名多样化
func Aggregate(allResults []SearchResult, ctx *AggregateContext, query string) []AggregatedResult {
	// 提取拼写建议
	if ctx.Suggestion == "" {
		for _, r := range allResults {
			if r.Suggestion != "" {
				ctx.Suggestion = r.Suggestion
				break
			}
		}
	}

	// 阶段 1: URL 去重
	urlMap := make(map[string][]SearchResult)
	for _, r := range allResults {
		if !IsSearchResultURL(r.URL) {
			continue
		}
		key := NormalizeURL(r.URL)
		urlMap[key] = append(urlMap[key], r)
	}

	mergedByURL := make([]AggregatedResult, 0, len(urlMap))
	for _, group := range urlMap {
		mergedByURL = append(mergedByURL, mergeGroup(group, query))
	}

	// 阶段 2: 相似标题合并
	var merged []AggregatedResult
	used := make([]bool, len(mergedByURL))
	for i := range mergedByURL {
		if used[i] {
			continue
		}
		used[i] = true
		similarGroup := []AggregatedResult{mergedByURL[i]}
		for j := i + 1; j < len(mergedByURL); j++ {
			if used[j] {
				continue
			}
			if isSimilarTitle(mergedByURL[i].Title, mergedByURL[j].Title) {
				used[j] = true
				similarGroup = append(similarGroup, mergedByURL[j])
			}
		}
		if len(similarGroup) == 1 {
			merged = append(merged, similarGroup[0])
		} else {
			merged = append(merged, mergeSimilar(similarGroup))
		}
	}

	// 阶段 3: 评分 + 多样性排序
	for i := range merged {
		merged[i].Score = CalculateScore(merged[i].Engines, merged[i].Positions, ctx.Weights,
			merged[i].PublishedDate, merged[i].Title, merged[i].Snippet, query)
	}
	sortByScore(merged)

	return diversifyByDomain(merged, 3, ctx.MaxResults)
}

func mergeGroup(group []SearchResult, query string) AggregatedResult {
	first := group[0]
	engines := make([]string, 0, len(group))
	positions := make([]int, 0, len(group))
	bestTitle := first.Title
	bestSnippet := first.Snippet
	var bestDate int64
	var suggestion string

	for _, r := range group {
		engines = append(engines, r.Engine)
		positions = append(positions, r.Position)
		if len(r.Title) > len(bestTitle) {
			bestTitle = r.Title
		}
		if snippetRelevance(r.Snippet, query) > snippetRelevance(bestSnippet, query) ||
			(snippetRelevance(r.Snippet, query) == snippetRelevance(bestSnippet, query) &&
				len(r.Snippet) > len(bestSnippet)) {
			bestSnippet = r.Snippet
		}
		if r.PublishedDate > 0 && (bestDate == 0 || r.PublishedDate > bestDate) {
			bestDate = r.PublishedDate
		}
		if r.Suggestion != "" && suggestion == "" {
			suggestion = r.Suggestion
		}
	}

	return AggregatedResult{
		Title: bestTitle, URL: first.URL, Snippet: bestSnippet,
		Engines: engines, Positions: positions, PublishedDate: bestDate,
		Category: first.Category, Suggestion: suggestion,
	}
}

func mergeSimilar(group []AggregatedResult) AggregatedResult {
	first := group[0]
	var suggestion string
	for _, r := range group {
		if r.Suggestion != "" {
			suggestion = r.Suggestion
			break
		}
	}

	engineSet := make(map[string]struct{})
	var allEngines []string
	var allPositions []int
	bestSnippet := first.Snippet
	var bestDate int64

	for _, r := range group {
		for _, e := range r.Engines {
			if _, ok := engineSet[e]; !ok {
				engineSet[e] = struct{}{}
				allEngines = append(allEngines, e)
			}
		}
		allPositions = append(allPositions, r.Positions...)
		if len(r.Snippet) > len(bestSnippet) {
			bestSnippet = r.Snippet
		}
		if r.PublishedDate > 0 && (bestDate == 0 || r.PublishedDate > bestDate) {
			bestDate = r.PublishedDate
		}
	}

	return AggregatedResult{
		Title: first.Title, URL: first.URL, Snippet: bestSnippet,
		Engines: allEngines, Positions: allPositions, PublishedDate: bestDate,
		Category: first.Category, Suggestion: suggestion,
	}
}

func diversifyByDomain(results []AggregatedResult, maxPerDomain int, maxResults int) []AggregatedResult {
	domainCount := make(map[string]int)
	var diversified []AggregatedResult
	var remaining []AggregatedResult

	for _, r := range results {
		domain := ExtractDomain(r.URL)
		count := domainCount[domain]
		if count < maxPerDomain {
			domainCount[domain] = count + 1
			diversified = append(diversified, r)
		} else {
			remaining = append(remaining, r)
		}
	}
	diversified = append(diversified, remaining...)

	if len(diversified) > maxResults {
		diversified = diversified[:maxResults]
	}
	return diversified
}

func sortByScore(results []AggregatedResult) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}

// ── 格式化输出 ─────────────────────────────────────────

// FormatResults 格式化搜索结果
func FormatResults(results []AggregatedResult, query, ctxSuggestion string) string {
	if len(results) == 0 {
		return ""
	}

	lines := make([]string, 0, len(results)+2)
	lines = append(lines, "搜索 \""+query+"\" 共 "+itoa(len(results))+" 条结果：")

	for i, r := range results {
		domain := ExtractDomain(r.URL)
		meta := "[" + domain + "]"
		if r.Category != "" {
			meta += " · " + strings.ToUpper(r.Category)
		}
		engineStr := r.Engines[0]
		if len(r.Engines) > 1 {
			engineStr += "+" + itoa(len(r.Engines)-1) + "更多"
		}

		line := itoa(i+1) + ". " + r.Title + "\n"
		line += "   " + meta + "\n"
		line += "   " + engineStr + " | " + r.URL
		if r.PublishedDate > 0 {
			// 时间戳转日期字符串
			line += "\n   日期: " + formatTimestamp(r.PublishedDate)
		}
		if r.Snippet != "" {
			line += "\n   " + r.Snippet
		}
		lines = append(lines, line)
	}

	// 拼写建议
	suggestion := ctxSuggestion
	if suggestion == "" {
		for _, r := range results {
			if r.Suggestion != "" {
				suggestion = r.Suggestion
				break
			}
		}
	}
	if suggestion != "" {
		lines = append(lines, "\n您是不是想找: "+suggestion)
	}

	return strings.Join(lines, "\n\n")
}

// ── 引擎健康状态报告 ──────────────────────────────────

// FormatEngineStatusReport 格式化引擎健康状态
func FormatEngineStatusReport(statuses map[string]*EngineStatus) string {
	if len(statuses) == 0 {
		return "无引擎健康数据"
	}
	lines := []string{"引擎健康状态报告："}
	for name, s := range statuses {
		latency := "no data"
		if s.Metrics.SuccessfulRequests > 0 {
			latency = fmtDuration(s.Metrics.AvgLatency) + " avg"
		}
		successRate := "no data"
		if s.Metrics.TotalRequests > 0 {
			rate := float64(s.Metrics.SuccessfulRequests) / float64(s.Metrics.TotalRequests) * 100
			successRate = fmt.Sprintf("%.0f%%", rate)
		}
		status := "🟢正常"
		if s.Suspended {
			status = "🔴暂停中"
		}
		line := "  " + name + ":" + status + " 成功率=" + successRate + " 延迟=" + latency +
			" 连续失败=" + itoa(s.ConsecutiveFailures)
		if s.LastError != "" {
			line += " 上次错误=\"" + s.LastError + "\""
		}
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

func formatTimestamp(ms int64) string {
	if ms <= 0 {
		return ""
	}
	sec := ms / 1000
	// 简单的日期格式化
	days := int(sec / 86400)
	years := days / 365
	remainDays := days % 365
	months := remainDays / 30
	dayOfMonth := remainDays%30 + 1
	return itoa(years+1970) + "-" + pad2(months+1) + "-" + pad2(dayOfMonth)
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func fmtDuration(ms float64) string {
	if ms < 1000 {
		return itoa(int(ms)) + "ms"
	}
	return strconv.FormatFloat(ms/1000, 'f', 1, 64) + "s"
}

// ── 结构化报告 ─────────────────────────────────────────

// FormatStructuredReport 格式化为结构化分析报告
func FormatStructuredReport(results []AggregatedResult, query string) string {
	if len(results) == 0 {
		return ""
	}

	// 按类别分组
	groups := make(map[string][]AggregatedResult)
	for _, r := range results {
		cat := r.Category
		if cat == "" {
			cat = "general"
		}
		groups[cat] = append(groups[cat], r)
	}

	// 统计
	allSources := make(map[string]struct{})
	engineSet := make(map[string]struct{})
	for _, r := range results {
		allSources[ExtractDomain(r.URL)] = struct{}{}
		for _, e := range r.Engines {
			engineSet[e] = struct{}{}
		}
	}

	var sections []string
	sections = append(sections, "## 搜索结果分析报告: \""+query+"\"\n")

	// 概览
	enginesList := make([]string, 0, len(engineSet))
	for e := range engineSet {
		enginesList = append(enginesList, e)
	}
	sections[0] += "**概览**: 共检索到 " + itoa(len(results)) + " 条结果，来自 " +
		itoa(len(allSources)) + " 个来源（" + itoa(len(engineSet)) + " 个搜索引擎）。\n" +
		"**主要引擎**: " + strings.Join(enginesList, ", ") + "。"

	// 各类别
	catLabels := map[string]string{
		"general": "综合信息", "video": "视频", "image": "图片",
		"music": "音乐", "code": "代码/技术", "academic": "学术",
		"news": "新闻", "social": "社交", "shopping": "购物比价",
	}
	rank := 0
	for cat, items := range groups {
		label := catLabels[cat]
		if label == "" {
			label = cat
		}

		var itemLines []string
		for _, r := range items {
			rank++
			line := itoa(rank) + ". **" + r.Title + "**\n"
			line += "   [" + ExtractDomain(r.URL) + "] | " + r.URL + "\n"
			if r.Snippet != "" {
				line += "   " + r.Snippet
			}
			itemLines = append(itemLines, line)
		}
		sections = append(sections, "### "+label+"（"+itoa(len(items))+" 条）\n"+
			strings.Join(itemLines, "\n\n"))
	}

	return strings.Join(sections, "\n\n")
}
