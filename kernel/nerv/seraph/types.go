// Package seraph 提供IPIP-NEO-120问卷计分功能
// 命名来源：SERAPH（炽天使），系统监督和计算层
package seraph

import "github.com/siyuan-note/siyuan/kernel/nerv/marduk"

// Domain IPIP-NEO-120五大维度
type Domain string

const (
	DomainN Domain = "N" // Neuroticism 神经质
	DomainE Domain = "E" // Extraversion 外向性
	DomainO Domain = "O" // Openness 开放性
	DomainA Domain = "A" // Agreeableness 宜人性
	DomainC Domain = "C" // Conscientiousness 尽责性
)

// Facet 子维度编号 1-6
type Facet int

const (
	Facet1 Facet = 1
	Facet2 Facet = 2
	Facet3 Facet = 3
	Facet4 Facet = 4
	Facet5 Facet = 5
	Facet6 Facet = 6
)

// Keyed 计分方向
type Keyed string

const (
	KeyedPlus  Keyed = "plus"  // 正向计分
	KeyedMinus Keyed = "minus" // 反向计分
)

// IpipNeo120Item 题目元数据
type IpipNeo120Item struct {
	Q      int    // 题号 1-120
	Text   string // 题目文本
	Domain Domain // 所属维度
	Facet  Facet  // 所属子维度
	Keyed  Keyed  // 计分方向
}

// ScoringAccumulation 计分累加中间结果
type ScoringAccumulation struct {
	DomainSum   map[Domain]int
	DomainCount map[Domain]int
	FacetSum    map[string]int
	FacetCount  map[string]int
}

// 直接使用marduk的类型定义，避免重复
type (
	RawAnswer   = marduk.IpipNeo120RawAnswer
	PersonaBase = marduk.PersonaBase
)
