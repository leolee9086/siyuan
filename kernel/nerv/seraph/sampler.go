package seraph

import (
	"math"
	"math/rand"
	"time"
)

const (
	// EntityAvatar 外部参考基线（裸 LLM）。
	EntityAvatar ATFEntity = "avatar"
)

// DomainCategory 领域分类（用于靶向抽题）。
type DomainCategory string

const (
	CategoryCognitive DomainCategory = "cognitive" // 认知/逻辑维度 (O, C)
	CategoryEmotional DomainCategory = "emotional" // 情感/协调维度 (E, A)
	CategoryInstinct  DomainCategory = "instinct"  // 本能/应激维度 (N)
)

// NOTE(codex-sync): 这个分类与 ttt 文档保持一一映射，供另一条改动线复用。
func GetDomainCategory(domain Domain) DomainCategory {
	switch domain {
	case DomainO, DomainC:
		return CategoryCognitive
	case DomainE, DomainA:
		return CategoryEmotional
	case DomainN:
		return CategoryInstinct
	default:
		return CategoryCognitive
	}
}

// QuestionSampler 题库抽题器。
type QuestionSampler struct {
	questionBank []IpipNeo120Item
	rng          *rand.Rand
}

// NewQuestionSampler 创建抽题器（默认随机种子）。
func NewQuestionSampler() *QuestionSampler {
	return NewQuestionSamplerWithSeed(time.Now().UnixNano())
}

// NewQuestionSamplerWithSeed 创建可复现抽题器（测试友好）。
func NewQuestionSamplerWithSeed(seed int64) *QuestionSampler {
	copied := make([]IpipNeo120Item, len(IpipNeo120QuestionBank))
	copy(copied, IpipNeo120QuestionBank)
	return &QuestionSampler{
		questionBank: copied,
		rng:          rand.New(rand.NewSource(seed)),
	}
}

// SampleForEntity 为指定实体抽题。
// 注意：主导统合结果不独立抽题，而是对三贤人的题目集合进行统合作答。
func (s *QuestionSampler) SampleForEntity(entity ATFEntity, count int) []IpipNeo120Item {
	switch entity {
	case EntityAvatar:
		return s.sampleUniform(count)
	case EntityMelchior:
		return s.sampleTargeted(count, CategoryCognitive, 0.8)
	case EntityBalthazar:
		return s.sampleTargeted(count, CategoryEmotional, 0.8)
	case EntityCasper:
		return s.sampleTargeted(count, CategoryInstinct, 0.8)
	case EntityIntegrated:
		// 主导统合结果不独立抽题，返回空切片
		return nil
	default:
		return s.sampleUniform(count)
	}
}

// sampleUniform 全域随机抽题（Avatar/兜底）。
func (s *QuestionSampler) sampleUniform(count int) []IpipNeo120Item {
	count = minInt(count, len(s.questionBank))
	if count <= 0 {
		return nil
	}
	indices := s.rng.Perm(len(s.questionBank))[:count]
	result := make([]IpipNeo120Item, 0, count)
	for _, idx := range indices {
		result = append(result, s.questionBank[idx])
	}
	return result
}

// sampleTargeted 靶向比例抽题（80/20）。
func (s *QuestionSampler) sampleTargeted(count int, primaryCategory DomainCategory, primaryRatio float64) []IpipNeo120Item {
	count = minInt(count, len(s.questionBank))
	if count <= 0 {
		return nil
	}

	// 限制比例到 [0,1]，防止配置误入导致边界异常。
	if primaryRatio < 0 {
		primaryRatio = 0
	}
	if primaryRatio > 1 {
		primaryRatio = 1
	}

	var primaryQuestions []IpipNeo120Item
	var secondaryQuestions []IpipNeo120Item
	for _, q := range s.questionBank {
		if GetDomainCategory(q.Domain) == primaryCategory {
			primaryQuestions = append(primaryQuestions, q)
		} else {
			secondaryQuestions = append(secondaryQuestions, q)
		}
	}

	primaryCount := int(math.Round(float64(count) * primaryRatio))
	if primaryCount > count {
		primaryCount = count
	}
	secondaryCount := count - primaryCount

	// 如果某一侧题目不够，自动让另一侧补齐，确保返回数量稳定。
	if primaryCount > len(primaryQuestions) {
		secondaryCount += primaryCount - len(primaryQuestions)
		primaryCount = len(primaryQuestions)
	}
	if secondaryCount > len(secondaryQuestions) {
		primaryCount += secondaryCount - len(secondaryQuestions)
		secondaryCount = len(secondaryQuestions)
		if primaryCount > len(primaryQuestions) {
			primaryCount = len(primaryQuestions)
		}
	}

	result := make([]IpipNeo120Item, 0, primaryCount+secondaryCount)
	if primaryCount > 0 {
		indices := s.rng.Perm(len(primaryQuestions))[:primaryCount]
		for _, idx := range indices {
			result = append(result, primaryQuestions[idx])
		}
	}
	if secondaryCount > 0 {
		indices := s.rng.Perm(len(secondaryQuestions))[:secondaryCount]
		for _, idx := range indices {
			result = append(result, secondaryQuestions[idx])
		}
	}

	// 打散主场/跨界顺序，避免模式提示泄露。
	s.rng.Shuffle(len(result), func(i, j int) {
		result[i], result[j] = result[j], result[i]
	})
	return result
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
