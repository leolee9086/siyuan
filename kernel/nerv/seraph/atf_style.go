package seraph

import (
	"math"
	"strings"
	"sync"
	"unicode"

	"github.com/go-ego/gse"
)

var (
	seg        gse.Segmenter
	segInitErr error
	segOnce    sync.Once
)

// initSegmenter 初始化分词器，只执行一次
func initSegmenter() {
	segOnce.Do(func() {
		segInitErr = seg.LoadDict()
	})
}

// ComputeStyleMetrics 计算文本的文体风格指纹
func ComputeStyleMetrics(text string) (StyleMetrics, error) {
	// 初始化分词器
	initSegmenter()
	if segInitErr != nil {
		return StyleMetrics{}, segInitErr
	}

	// 使用gse分词
	tokens := seg.Cut(text, true)

	// 句子分割
	sentences := splitSentences(text)

	// 词汇丰度 (Type-Token Ratio)
	typeTokenRatio := computeTypeTokenRatio(tokens)

	// 平均句长和标准差
	avgSentenceLength, sentenceLengthStd := computeSentenceStats(sentences)

	// 标点熵
	punctuationEntropy := computePunctuationEntropy(text)

	return StyleMetrics{
		TypeTokenRatio:     typeTokenRatio,
		AvgSentenceLength:  avgSentenceLength,
		SentenceLengthStd:  sentenceLengthStd,
		PunctuationEntropy: punctuationEntropy,
	}, nil
}

// splitSentences 按句子分割
func splitSentences(text string) []string {
	var sentences []string
	var current strings.Builder

	for _, r := range text {
		current.WriteRune(r)
		if r == '。' || r == '！' || r == '？' || r == '.' || r == '!' || r == '?' {
			if current.Len() > 0 {
				sentences = append(sentences, strings.TrimSpace(current.String()))
				current.Reset()
			}
		}
	}

	if current.Len() > 0 {
		sentences = append(sentences, strings.TrimSpace(current.String()))
	}

	return sentences
}

// computeTypeTokenRatio 计算词汇丰度
func computeTypeTokenRatio(tokens []string) float64 {
	if len(tokens) == 0 {
		return 0
	}

	uniqueTokens := make(map[string]bool)
	for _, token := range tokens {
		uniqueTokens[token] = true
	}

	return float64(len(uniqueTokens)) / float64(len(tokens))
}

// computeSentenceStats 计算句长统计
func computeSentenceStats(sentences []string) (avg, std float64) {
	if len(sentences) == 0 {
		return 0, 0
	}

	lengths := make([]float64, len(sentences))
	sum := 0.0
	for i, s := range sentences {
		length := float64(len([]rune(s)))
		lengths[i] = length
		sum += length
	}

	avg = sum / float64(len(sentences))

	variance := 0.0
	for _, length := range lengths {
		diff := length - avg
		variance += diff * diff
	}
	variance /= float64(len(sentences))
	std = math.Sqrt(variance)

	return avg, std
}

// computePunctuationEntropy 计算标点熵
func computePunctuationEntropy(text string) float64 {
	punctCounts := make(map[rune]int)
	totalPunct := 0

	for _, r := range text {
		if unicode.IsPunct(r) {
			punctCounts[r]++
			totalPunct++
		}
	}

	if totalPunct == 0 {
		return 0
	}

	entropy := 0.0
	for _, count := range punctCounts {
		p := float64(count) / float64(totalPunct)
		if p > 0 {
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

// ComputeStyleSimilarity 计算两个文体指纹的相似度，归一化到[-1,1]
func ComputeStyleSimilarity(s1, s2 StyleMetrics) float64 {
	v1 := []float64{s1.TypeTokenRatio, s1.AvgSentenceLength / 100.0, s1.SentenceLengthStd / 100.0, s1.PunctuationEntropy / 10.0}
	v2 := []float64{s2.TypeTokenRatio, s2.AvgSentenceLength / 100.0, s2.SentenceLengthStd / 100.0, s2.PunctuationEntropy / 10.0}

	distance := 0.0
	for i := range v1 {
		diff := v1[i] - v2[i]
		distance += diff * diff
	}
	distance = math.Sqrt(distance)

	maxDistance := 2.0
	similarity := 1.0 - math.Min(distance/maxDistance, 1.0)

	return 2.0*similarity - 1.0
}
