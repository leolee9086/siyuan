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

// ============================================================================
// Graph Structure Constants
// ============================================================================

// MaxDegree 最大出度常量
const MaxDegree = 128

// ============================================================================
// Default Build Parameters
// ============================================================================

// 默认参数常量
const (
	DefaultR     = 64  // 最大出度
	DefaultL     = 100 // 构建时搜索列表大小
	DefaultAlpha = 1.2 // 剪枝阈值
)

// ============================================================================
// Disk I/O Constants
// ============================================================================

const (
	// SectorSize is the default sector size for disk alignment (4KB)
	SectorSize = 4096

	// IOAlignment is the I/O alignment boundary (512 bytes)
	IOAlignment = 512

	// DefaultWriteBufferSize is the default buffer size for streaming writes (16MB)
	DefaultWriteBufferSize = 16 * 1024 * 1024
)

// ============================================================================
// Disk Index File Format Constants
// ============================================================================

const (
	// 磁盘索引组件的文件扩展名
	diskIndexExt   = ".index"   // 主索引文件（图头 + 节点数据）
	diskBBQExt     = ".bbq"     // BBQ 量化码
	diskDeletedExt = ".deleted" // 删除位图

	// BBQ 文件头常量
	bbqMagic           uint32 = 0x42425100 // "BBQ\0"
	bbqVersion         uint32 = 1          // 旧版本：仅包含打包码
	bbqVersionWithMeta uint32 = 2          // 新版本：包含量化元数据
	bbqHeaderSizeV1    int    = 16         // 版本 1 头部大小
	bbqHeaderSizeV2    int    = 24         // 版本 2 头部大小
)

// ============================================================================
// Incremental Operation Constants
// ============================================================================

const (
	// DefaultCompactionThreshold is the default deletion ratio threshold for compaction
	DefaultCompactionThreshold = 0.3

	// DefaultInsertSearchL is the default search list size during insert
	DefaultInsertSearchL = 100

	// DefaultInsertAlpha is the default pruning threshold during insert
	DefaultInsertAlpha = 1.2

	// DefaultDeleteSearchL is the GreedySearch depth during delete (l_d)
	DefaultDeleteSearchL = 128

	// DefaultDeleteK is the number of closest candidates to retain (k)
	DefaultDeleteK = 50

	// DefaultDeleteC is the number of replacement edges per neighbor (c)
	DefaultDeleteC = 3
)

// ============================================================================
// Search Constants
// ============================================================================

// LargeInvalidDistance 用于表示无效或缺失节点的大距离值。
// 当 BBQ 元数据缺失或向量无法获取时，返回此值以确保该节点在排序中排到最后。
const LargeInvalidDistance float32 = 1e9
