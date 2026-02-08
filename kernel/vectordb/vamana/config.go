// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package vamana

// Config Vamana 图索引的完整配置，包含图构建参数和高级调优参数。
// 同时作为 DiskBuildConfig 的嵌入基础，确保图参数在单一位置定义。
type Config struct {
	// 图构建参数
	R     int     // 最大出度 (默认64)
	L     int     // 构建时搜索列表大小 (默认100)
	Alpha float32 // 剪枝阈值 (默认1.2)

	// 高级参数
	MaxOcclusionSize   int     // 最大遮挡计算大小 (默认750)
	GraphSlackFactor   float32 // 图松弛因子 (默认1.3)
	SaturateAfterPrune bool    // 剪枝后饱和填充 (默认true)
	MaxBackedges       int     // 单次插入最大反向边数 (默认R)
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		R:                  DefaultR,
		L:                  DefaultL,
		Alpha:              DefaultAlpha,
		MaxOcclusionSize:   750,
		GraphSlackFactor:   1.3,
		SaturateAfterPrune: true,
		MaxBackedges:       DefaultR,
	}
}

// Validate 验证配置参数
func (c *Config) Validate() error {
	if c.R <= 0 {
		c.R = DefaultR
	}
	if c.L <= 0 {
		c.L = DefaultL
	}
	if c.L < c.R {
		c.L = c.R // L 应该 >= R
	}
	if c.Alpha <= 0 {
		c.Alpha = DefaultAlpha
	}
	if c.MaxOcclusionSize <= 0 {
		c.MaxOcclusionSize = 750
	}
	if c.GraphSlackFactor <= 0 {
		c.GraphSlackFactor = 1.3
	}
	if c.MaxBackedges <= 0 {
		c.MaxBackedges = c.R
	}
	return nil
}

// WithR 设置最大出度
func (c Config) WithR(r int) Config {
	c.R = r
	return c
}

// WithL 设置构建时搜索列表大小
func (c Config) WithL(l int) Config {
	c.L = l
	return c
}

// WithAlpha 设置剪枝阈值
func (c Config) WithAlpha(alpha float32) Config {
	c.Alpha = alpha
	return c
}
