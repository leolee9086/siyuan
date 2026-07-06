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

	// BBQ 文件头常量（唯一格式：量化码 + 完整元数据，无历史版本兼容）
	bbqMagic      uint32 = 0x42425100 // "BBQ\0"
	bbqVersion    uint32 = 2          // 唯一版本：包含量化码与元数据
	bbqHeaderSize int    = 24         // 头部大小
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

	// DefaultDeleteK is the number of closest candidates to retain (k).
	// IP-DiskANN 论文建议候选池应足够大以覆盖删除修复所需的替换边。
	// R=64 时，k=100 可提供充足的候选覆盖。
	DefaultDeleteK = 100

	// DefaultDeleteC is the number of replacement edges per neighbor (c).
	// IP-DiskANN 论文建议 c 值应与图平均度数成比例（约 R/10）。
	// R=64 时，c=6 提供足够的替换边以维持图连通性。
	DefaultDeleteC = 6

	// DefaultDeletePruneSlackFactor 是删除修复后剪枝的松弛因子。
	// 删除修复会临时增加受影响节点的度数，使用松弛因子允许节点度数
	// 临时超过 R，仅当超过 SlackFactor * R 时才触发剪枝。
	// 这与构建阶段的 GraphSlackFactor 策略一致（见 config.go）。
	DefaultDeletePruneSlackFactor float32 = 1.3

	// DefaultInsertGraphSlackFactor 是 Insert 路径反向边添加时的图松弛因子。
	// 与内存版 VamanaIndex 的 GraphSlackFactor 策略一致（见 config.go）：
	// 允许邻居数量临时超过 R，仅当超过 SlackFactor * R 时才触发剪枝，
	// 大幅减少不必要的剪枝操作，提升 Insert 吞吐量。
	DefaultInsertGraphSlackFactor float32 = 1.5
)

// ============================================================================
// Search Constants
// ============================================================================

// DefaultBBQQueryBits 是 BBQ 查询向量的默认量化位数。
//
// 生产默认取 4：使用 4-bit 非对称量化（查询 4-bit × 索引 1-bit），与 Rust 参考实现
// （toread/rust-bbq/quantized_index.rs：query_bits=4, index_bits=1）一致，保证召回率。
//
// 取值 1 或 4：
//   - 4: 非对称量化，精度更高（生产默认）
//   - 1: 1-bit 对称量化 + POPCNT 硬件加速，仅作为可选性能路径，通过 SetBBQQueryBits(1) 启用
const DefaultBBQQueryBits = 4

// DefaultBBQOverSearchFactor 是 BBQ 搜索路径的默认过搜索因子。
//
// BBQ 1-bit 量化分辨率有限（128维仅129个离散值），导致贪心搜索中
// 真近邻容易被淘汰。通过扩大内部 beam 宽度（internalL = efSearch * overSearchFactor），
// 可以在 BBQ 粗筛阶段保留更多候选，再由 rerank 阶段精确选出 topK。
// 这是 DiskANN 论文的标准做法。
const DefaultBBQOverSearchFactor = 5.0

// LargeInvalidDistance 用于表示无效或缺失节点的大距离值。
// 当 BBQ 元数据缺失或向量无法获取时，返回此值以确保该节点在排序中排到最后。
const LargeInvalidDistance float32 = 1e9
