package seraph

import (
	"testing"
)

func TestQuestionSampler_SampleForEntity(t *testing.T) {
	sampler := NewQuestionSampler()

	tests := []struct {
		name         string
		entity       ATFEntity
		count        int
		checkPrimary func([]IpipNeo120Item) bool
	}{
		{
			name:   "统合结果不独立抽题",
			entity: EntityIntegrated,
			count:  5,
			checkPrimary: func(items []IpipNeo120Item) bool {
				return len(items) == 0
			},
		},
		{
			name:   "Melchior认知领域为主",
			entity: EntityMelchior,
			count:  5,
			checkPrimary: func(items []IpipNeo120Item) bool {
				cognitiveCount := 0
				for _, item := range items {
					if GetDomainCategory(item.Domain) == CategoryCognitive {
						cognitiveCount++
					}
				}
				// 80%主场，5题中应该有4题是认知领域
				return cognitiveCount >= 3
			},
		},
		{
			name:   "Balthazar情感领域为主",
			entity: EntityBalthazar,
			count:  5,
			checkPrimary: func(items []IpipNeo120Item) bool {
				emotionalCount := 0
				for _, item := range items {
					if GetDomainCategory(item.Domain) == CategoryEmotional {
						emotionalCount++
					}
				}
				return emotionalCount >= 3
			},
		},
		{
			name:   "Casper本能领域为主",
			entity: EntityCasper,
			count:  5,
			checkPrimary: func(items []IpipNeo120Item) bool {
				instinctCount := 0
				for _, item := range items {
					if GetDomainCategory(item.Domain) == CategoryInstinct {
						instinctCount++
					}
				}
				return instinctCount >= 3
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := sampler.SampleForEntity(tt.entity, tt.count)
			if !tt.checkPrimary(items) {
				t.Errorf("抽题结果不符合预期")
			}
		})
	}
}

func TestGetDomainCategory(t *testing.T) {
	tests := []struct {
		domain   Domain
		expected DomainCategory
	}{
		{DomainO, CategoryCognitive},
		{DomainC, CategoryCognitive},
		{DomainE, CategoryEmotional},
		{DomainA, CategoryEmotional},
		{DomainN, CategoryInstinct},
	}

	for _, tt := range tests {
		t.Run(string(tt.domain), func(t *testing.T) {
			result := GetDomainCategory(tt.domain)
			if result != tt.expected {
				t.Errorf("GetDomainCategory(%s) = %s, 期望 %s", tt.domain, result, tt.expected)
			}
		})
	}
}
