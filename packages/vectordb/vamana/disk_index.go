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

// Package vamana implements the Vamana graph index algorithm for approximate nearest neighbor search.
//
// This file implements the disk-based Vamana index structure (DiskVamanaIndex),
// which stores the graph on disk while keeping frequently accessed data in memory:
//   - BBQ codes: 1-bit quantized vectors for fast distance estimation
//   - Neighbor lists: graph adjacency information
//   - Deleted bitmap: soft-delete tracking
//
// The disk index uses memory-mapped I/O for efficient random access to node data.
package vamana

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"sync"

	"log"

	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/storage"
)

// ============================================================================
// 错误定义
// ============================================================================

var (
	// ErrDiskIndexClosed 磁盘索引已关闭
	ErrDiskIndexClosed = errors.New("disk index is closed")

	// ErrBBQMagicMismatch BBQ 文件魔数不匹配
	ErrBBQMagicMismatch = errors.New("invalid BBQ file magic number")

	// ErrBBQVersionMismatch BBQ 文件版本不支持
	ErrBBQVersionMismatch = errors.New("unsupported BBQ file version")

	// ErrReaderNotConfigured 磁盘索引读取器未配置
	ErrReaderNotConfigured = errors.New("disk index reader not configured: call vamana.SetOpenDiskIndexReader")

	// ErrBBQDimensionMismatch BBQ 文件维度与索引不匹配
	ErrBBQDimensionMismatch = errors.New("BBQ dimension mismatch")

	// ErrVectorsEmpty 向量集合为空
	ErrVectorsEmpty = errors.New("vectors cannot be empty")

	// ErrDimensionZero 向量维度为零
	ErrDimensionZero = errors.New("vector dimension cannot be zero")

	// ErrDimensionInconsistent 向量维度不一致
	ErrDimensionInconsistent = errors.New("inconsistent vector dimension")

	// ErrBaseIndexNil 基础索引为空
	ErrBaseIndexNil = errors.New("base index cannot be nil")
)

// ============================================================================
// DiskVamanaIndex 结构体
// ============================================================================

// DiskVamanaIndex 基于磁盘的 Vamana 图索引。
//
// 内存驻留数据（快速访问）：
//   - BBQ 码：1-bit 量化向量，用于距离估算
//   - 邻居列表：图邻接关系（按需加载或全量缓存）
//   - 删除位图：软删除追踪
//
// 磁盘驻留数据（通过 mmap 访问）：
//   - 原始向量：全精度 float32 向量
//   - 图元数据：维度、节点数、medoid 等
//
// 线程安全性：
//   - 读操作支持并发访问
//   - 写操作需要外部同步
type DiskVamanaIndex struct {
	// 索引元数据
	basePath            string                 // 基础路径（不含扩展名）
	metadata            *storage.GraphMetadata // 磁盘图元数据
	maxDegree           int                    // 最大出度（从元数据计算）
	distanceMetric      bbq.SimilarityType     // BBQ 量化使用的距离度量
	bbqOverSearchFactor float64                // BBQ 搜索过搜索因子（internalL = efSearch * factor）

	// 删除修复参数（可通过 SetDeleteParams 配置）
	deleteC                int     // 每个邻居的替换边数（默认 DefaultDeleteC）
	deleteK                int     // 候选池大小（默认 DefaultDeleteK）
	deletePruneSlackFactor float32 // 删除修复后剪枝松弛因子（默认 DefaultDeletePruneSlackFactor）

	// Insert 路径参数
	insertGraphSlackFactor float32 // Insert 反向边剪枝松弛因子（默认 DefaultInsertGraphSlackFactor）

	// 磁盘 I/O
	reader storage.DiskIndexReader // 磁盘索引读取器（基于 mmap）

	// 应用层热节点缓存
	nodeCache *NodeCache // holds frequently-visited nodes (vectors + neighbors)

	// 内存驻留数据
	bbqCodes         []byte                 // 打包的 BBQ 码（每维 1-bit）
	bbqCentroid      []float32              // BBQ 质心向量
	bbqLowerBounds   []float32              // 量化区间下界
	bbqUpperBounds   []float32              // 量化区间上界
	bbqCorrections   []float32              // 校正因子
	bbqQuantizedSums []float32              // 量化分量和
	bbqHasMeta       bool                   // 是否有量化元数据
	bbqQueryBits     int                    // 查询向量量化位数（1 或 4）
	deleted          *storage.DeletedBitmap // Deleted node bitmap

	// 增量操作 - 追加缓冲区
	appendVectors   [][]float32 // 新插入向量的内存缓冲
	appendNeighbors [][]uint32  // 新插入向量的邻居表
	appendBBQLower  []float32   // 新增向量 BBQ lower bounds
	appendBBQUpper  []float32   // 新增向量 BBQ upper bounds
	appendBBQCorr   []float32   // 新增向量 BBQ correlation (校正因子)
	appendBBQSumSq  []float32   // 新增向量 BBQ sum of squares (量化分量和)

	// 增量操作 - 已修改的邻居表
	// Uses sync.Map for lock-free reads (atomic Load) and internally-synchronized writes (Store).
	// This eliminates the RWMutex overhead that caused timeout under -race in the Delete path,
	// where thousands of getNeighbors calls per delete each acquired modifiedMu.RLock/RUnlock.
	modifiedNeighbors sync.Map // map[uint64][]uint32

	// 并发控制
	nodeLocks []sync.RWMutex // 节点级读写锁，大小应等于总点数（或分片数）

	// 状态
	closed bool         // 索引是否已关闭
	mu     sync.RWMutex // 保护 closed 状态和写操作
}

// ============================================================================
// 构造与析构
// ============================================================================

// Open 从指定路径打开基于磁盘的 Vamana 索引。
//
// path 应为不含扩展名的基础路径。函数将查找以下文件：
//   - {path}.index: 主索引文件（图头 + 节点数据）
//   - {path}.bbq: BBQ 量化码（可选）
//   - {path}.deleted: 删除位图（可选，不存在时自动创建）
//
// 参数：
//   - path: 索引文件的基础路径（不含扩展名）
//
// 返回打开的索引，或在以下情况返回错误：
//   - 索引文件不存在或无法打开
//   - 索引文件损坏或版本不兼容
//   - 内存分配失败
//
// 示例：
//
//	idx, err := vamana.Open("/data/vectors/my_index")
//	if err != nil {
//	    return err
//	}
//	defer idx.Close()
func Open(path string) (*DiskVamanaIndex, error) {
	return OpenWithMetric(path, bbq.EuclideanDistance)
}

// OpenWithMetric 从指定路径打开基于磁盘的 Vamana 索引，并指定 BBQ 距离度量。
//
// 参数：
//   - path: 索引文件的基础路径（不含扩展名）
//   - metric: BBQ 量化使用的距离度量类型
func OpenWithMetric(path string, metric bbq.SimilarityType) (*DiskVamanaIndex, error) {
	idx := &DiskVamanaIndex{
		basePath:               path,
		closed:                 false,
		distanceMetric:         metric,
		bbqOverSearchFactor:    DefaultBBQOverSearchFactor,
		bbqQueryBits:           DefaultBBQQueryBits,
		deleteC:                DefaultDeleteC,
		deleteK:                DefaultDeleteK,
		deletePruneSlackFactor: DefaultDeletePruneSlackFactor,
		insertGraphSlackFactor: DefaultInsertGraphSlackFactor,
	}

	// 打开主索引文件
	indexPath := path + diskIndexExt
	reader, err := openDiskIndexReader(indexPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open index file: %w", err)
	}
	idx.reader = reader
	idx.metadata = reader.Metadata()

	// 从元数据计算最大出度
	idx.maxDegree = storage.CalcMaxDegree(
		int(idx.metadata.NodeLen),
		int(idx.metadata.Dims),
		int(idx.metadata.AssocDataLength),
	)

	// 加载 BBQ 码（可选）
	bbqPath := path + diskBBQExt
	if err := idx.loadBBQCodes(bbqPath); err != nil {
		// BBQ 文件为可选项，加载失败不影响索引功能，仅记录警告
		log.Printf("加载 BBQ 码失败 [path=%s]: %v", bbqPath, err)
	}

	// 加载删除位图（不存在时创建空位图）
	deletedPath := path + diskDeletedExt
	deleted, err := storage.LoadDeletedBitmap(deletedPath)
	if err != nil {
		idx.reader.Close()
		return nil, fmt.Errorf("failed to load deleted bitmap: %w", err)
	}
	idx.deleted = deleted

	// 初始化节点锁
	// 注意：每个节点一把锁，内存开销约为 NumPoints * 24 bytes
	// 对于 100万 向量，约为 24MB，这是可接受的
	idx.nodeLocks = make([]sync.RWMutex, idx.metadata.NumPoints)

	return idx, nil
}

// SetDeleteParams 配置删除修复参数。
//
// 参数：
//   - c: 每个邻居的替换边数（<=0 时使用 DefaultDeleteC）
//   - k: 候选池大小（<=0 时使用 DefaultDeleteK）
//   - pruneSlackFactor: 剪枝松弛因子（<=0 时使用 DefaultDeletePruneSlackFactor）
//
// 线程安全：必须在索引使用前调用，不支持并发修改。
func (idx *DiskVamanaIndex) SetDeleteParams(c, k int, pruneSlackFactor float32) {
	if c > 0 {
		idx.deleteC = c
	}
	if k > 0 {
		idx.deleteK = k
	}
	if pruneSlackFactor > 0 {
		idx.deletePruneSlackFactor = pruneSlackFactor
	}
}

// SetInsertGraphSlackFactor 设置 Insert 路径反向边添加时的图松弛因子。
//
// 与内存版 VamanaIndex 的 GraphSlackFactor 策略一致：允许邻居数量临时超过 R，
// 仅当超过 slackFactor * R 时才触发 robustPrune，减少不必要的剪枝操作。
//
// 参数：
//   - factor: 松弛因子（<=1.0 时使用 DefaultInsertGraphSlackFactor）
//
// 线程安全：必须在索引使用前调用，不支持并发修改。
func (idx *DiskVamanaIndex) SetInsertGraphSlackFactor(factor float32) {
	if factor > 1.0 {
		idx.insertGraphSlackFactor = factor
	}
}

// Close 释放磁盘索引关联的所有资源。
//
// 调用 Close 后，索引上的所有操作将返回 ErrDiskIndexClosed。
// 多次调用 Close 是安全的。
//
// 如果底层读取器关闭失败，返回错误。
func (idx *DiskVamanaIndex) Close() error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if idx.closed {
		return nil
	}

	idx.closed = true

	// 如果删除位图有变更则保存
	if idx.deleted != nil && idx.deleted.IsDirty() {
		deletedPath := idx.basePath + diskDeletedExt
		if err := storage.SaveDeletedBitmap(deletedPath, idx.deleted); err != nil {
			// 保存删除位图失败不阻止关闭流程，但记录错误
			log.Printf("保存删除位图失败 [path=%s]: %v", deletedPath, err)
		}
	}

	// 关闭磁盘读取器
	if idx.reader != nil {
		if err := idx.reader.Close(); err != nil {
			return fmt.Errorf("failed to close reader: %w", err)
		}
	}

	// 清理内存驻留数据
	idx.bbqCodes = nil
	idx.deleted = nil

	return nil
}

// ============================================================================
// 内部加载函数
// ============================================================================

// loadBBQCodes 从磁盘加载 BBQ 量化码。
//
// BBQ 文件格式（版本 1）：
//   - Magic (4 bytes): 0x42425100 ("BBQ\0")
//   - Version (4 bytes): 1
//   - NumVectors (8 bytes): 向量数量
//   - Codes: byte[numVectors * packedSize]
//
// BBQ 文件格式（版本 2，包含量化元数据）：
//   - Magic (4 bytes): 0x42425100 ("BBQ\0")
//   - Version (4 bytes): 2
//   - NumVectors (8 bytes): 向量数量
//   - Dimension (4 bytes): 向量维度
//   - Reserved (4 bytes): 保留字段
//   - Centroid (dimension * 4 bytes): 质心向量
//   - PackedCodes (numVectors * packedSize bytes): 打包的 BBQ 码
//   - LowerBounds (numVectors * 4 bytes): 量化区间下界
//   - UpperBounds (numVectors * 4 bytes): 量化区间上界
//   - Corrections (numVectors * 4 bytes): 校正因子
//   - QuantizedSums (numVectors * 4 bytes): 量化分量和
//
// 参数：
//   - path: BBQ 文件路径
//
// loadBBQCodes 加载 BBQ 量化码与完整元数据。文件不存在时返回 nil（BBQ 为可选项）。
//
// BBQ 文件只有一种格式：头部 + 质心 + 打包量化码 + 四个元数据数组
// （LowerBounds/UpperBounds/Corrections/QuantizedSums）。无历史版本兼容。
func (idx *DiskVamanaIndex) loadBBQCodes(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // BBQ file is optional
		}
		return err
	}

	// 验证头部大小
	if len(data) < bbqHeaderSize {
		return ErrBBQMagicMismatch
	}

	// 验证魔数
	magic := binary.LittleEndian.Uint32(data[0:4])
	if magic != bbqMagic {
		return ErrBBQMagicMismatch
	}

	// 验证版本号
	version := binary.LittleEndian.Uint32(data[4:8])
	if version != bbqVersion {
		return ErrBBQVersionMismatch
	}

	// 读取头部
	numVectors := binary.LittleEndian.Uint64(data[8:16])
	dimension := binary.LittleEndian.Uint32(data[16:20])

	// 验证维度
	if int(dimension) != int(idx.metadata.Dims) {
		return fmt.Errorf("%w: file=%d, index=%d", ErrBBQDimensionMismatch, dimension, idx.metadata.Dims)
	}

	packedSize := (int(dimension) + 7) / 8
	n := int(numVectors)

	// 计算各部分的偏移量和大小
	centroidSize := int(dimension) * 4
	codesSize := n * packedSize
	metaSize := n * 4 // 每个元数据数组的大小

	expectedSize := bbqHeaderSize + centroidSize + codesSize + metaSize*4
	if len(data) < expectedSize {
		return storage.ErrCorruptedFile
	}

	offset := bbqHeaderSize

	// 读取质心向量
	idx.bbqCentroid = make([]float32, dimension)
	for i := 0; i < int(dimension); i++ {
		idx.bbqCentroid[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取打包的 BBQ 码
	idx.bbqCodes = make([]byte, codesSize)
	copy(idx.bbqCodes, data[offset:offset+codesSize])
	offset += codesSize

	// 读取 LowerBounds
	idx.bbqLowerBounds = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqLowerBounds[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 UpperBounds
	idx.bbqUpperBounds = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqUpperBounds[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 Corrections
	idx.bbqCorrections = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqCorrections[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 读取 QuantizedSums
	idx.bbqQuantizedSums = make([]float32, n)
	for i := 0; i < n; i++ {
		idx.bbqQuantizedSums[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4
	}

	// 单一格式：加载即含完整元数据
	idx.bbqHasMeta = true

	return nil
}

// ============================================================================
// 访问器方法
// ============================================================================

// NumPoints 返回索引中的点数（不含已删除）。
func (idx *DiskVamanaIndex) NumPoints() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.NumPoints - idx.deleted.CountDeleted()
}

// NumPointsTotal 返回索引中的总点数（含已删除）。
func (idx *DiskVamanaIndex) NumPointsTotal() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.NumPoints
}

// Dimension 返回向量维度。
func (idx *DiskVamanaIndex) Dimension() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return int(idx.metadata.Dims)
}

// Medoid 返回入口点（medoid）节点 ID。
func (idx *DiskVamanaIndex) Medoid() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.metadata.Medoid
}

// MaxDegree 返回图的最大出度。
func (idx *DiskVamanaIndex) MaxDegree() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return 0
	}

	return idx.maxDegree
}

// GetNeighbors 返回指定节点的邻居列表。
//
// 通过 idx.reader.ReadNeighbors() 按需从磁盘读取。
// 节点不存在或索引已关闭时返回 nil。
func (idx *DiskVamanaIndex) GetNeighbors(nodeID uint64) []uint32 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed || nodeID >= idx.metadata.NumPoints {
		return nil
	}

	neighbors, err := idx.reader.ReadNeighbors(nodeID)
	if err != nil {
		return nil
	}
	return neighbors
}

// IsDeleted 检查节点是否已标记为删除。
func (idx *DiskVamanaIndex) IsDeleted(nodeID uint64) bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return false
	}

	return idx.deleted.IsDeleted(nodeID)
}

// HasBBQ 返回 BBQ 码是否已加载。
func (idx *DiskVamanaIndex) HasBBQ() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.bbqCodes != nil
}

// HasBBQMeta 返回 BBQ 量化元数据是否已加载。
// 表示 BBQ 文件以版本 2 格式保存。
func (idx *DiskVamanaIndex) HasBBQMeta() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.bbqHasMeta
}

// BBQOverSearchFactor 返回当前的 BBQ 过搜索因子。
//
// 该因子控制 BBQ 搜索路径中贪心搜索的内部 beam 宽度：
//
//	internalL = efSearch * bbqOverSearchFactor
//
// 更大的值意味着更多的候选被保留用于 rerank，从而提高召回率，但会增加搜索延迟。
func (idx *DiskVamanaIndex) BBQOverSearchFactor() float64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.bbqOverSearchFactor
}

// SetBBQOverSearchFactor 设置 BBQ 过搜索因子。
//
// factor 必须 >= 1.0，否则将被钳位到 1.0（即不扩大 beam）。
// 线程安全：内部持有写锁。
func (idx *DiskVamanaIndex) SetBBQOverSearchFactor(factor float64) {
	if factor < 1.0 {
		factor = 1.0
	}

	idx.mu.Lock()
	idx.bbqOverSearchFactor = factor
	idx.mu.Unlock()
}

// GetBBQCode 返回指定节点的 BBQ 码。
//
// BBQ 未启用或节点不存在时返回 nil。
// 线程安全：自带读锁，可从外部直接调用。
func (idx *DiskVamanaIndex) GetBBQCode(nodeID uint64) []byte {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.getBBQCodeUnlocked(nodeID)
}

// getBBQCodeUnlocked 返回指定节点的 BBQ 码（无锁版本）。
//
// 调用方必须已持有 idx.mu 的读锁或写锁。
// BBQ 未启用或节点不存在时返回 nil。
func (idx *DiskVamanaIndex) getBBQCodeUnlocked(nodeID uint64) []byte {
	if idx.closed || idx.bbqCodes == nil {
		return nil
	}

	packedSize := (int(idx.metadata.Dims) + 7) / 8
	start := int(nodeID) * packedSize
	end := start + packedSize

	if end > len(idx.bbqCodes) {
		return nil
	}

	return idx.bbqCodes[start:end]
}

// ReadVector 读取指定节点的原始向量。
//
// 此方法从磁盘读取，应谨慎使用（例如仅用于重排序）。
func (idx *DiskVamanaIndex) ReadVector(nodeID uint64) ([]float32, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if idx.closed {
		return nil, ErrDiskIndexClosed
	}

	vec := make([]float32, idx.metadata.Dims)
	if err := idx.reader.ReadVector(nodeID, vec); err != nil {
		return nil, err
	}

	return vec, nil
}

// ============================================================================
// 平台相关的 Reader 工厂
// ============================================================================

// OpenDiskIndexReader 磁盘索引读取器的包级别工厂函数变量。
//
// 设计决策：保留为导出的包级别变量而非通过构造函数注入，原因如下：
//   - 测试中需要频繁替换实现（mock reader），导出变量使测试代码更简洁
//   - 生产环境通过 SetOpenDiskIndexReader 设置一次后不再变更
//   - 该变量仅在 openDiskIndexReader 内部读取，写入仅发生在初始化阶段和测试中
//
// 生产代码应使用 SetOpenDiskIndexReader 设置；测试代码可直接赋值。
var OpenDiskIndexReader func(path string, readOnly bool) (storage.DiskIndexReader, error)

// SetOpenDiskIndexReader 设置磁盘索引读取器工厂函数。
//
// 生产环境应在程序初始化阶段调用此函数设置平台相关的实现。
// 此函数是并发安全的。
func SetOpenDiskIndexReader(fn func(path string, readOnly bool) (storage.DiskIndexReader, error)) {
	OpenDiskIndexReader = fn
}

// openDiskIndexReader 使用已配置的工厂函数打开磁盘索引读取器。
//
// 如果 OpenDiskIndexReader 未设置，返回错误。
func openDiskIndexReader(path string) (storage.DiskIndexReader, error) {
	// 检查文件是否存在
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, storage.ErrFileNotFound
	}

	if OpenDiskIndexReader == nil {
		return nil, ErrReaderNotConfigured
	}

	return OpenDiskIndexReader(path, true) // 只读模式
}

// ============================================================================
// BBQ 查询量化配置
// ============================================================================

// BBQQueryBits 返回查询向量量化位数（1 或 4）。
func (idx *DiskVamanaIndex) BBQQueryBits() int {
	return idx.bbqQueryBits
}

// SetBBQQueryBits 设置查询向量量化位数。
//
// 仅接受 1 或 4，其他值将被忽略：
//   - 1: 使用 1-bit 对称量化 + POPCNT 硬件加速（默认）
//   - 4: 使用 4-bit 非对称量化（查询 4-bit × 索引 1-bit），精度更高
func (idx *DiskVamanaIndex) SetBBQQueryBits(bits int) {
	if bits != 1 && bits != 4 {
		return
	}
	idx.bbqQueryBits = bits
}

// ============================================================================
// Node Cache
// ============================================================================

// SetCacheSize sets the application-layer node cache capacity in MB.
// A value of 0 disables the cache. Must be called before WarmupCache.
func (idx *DiskVamanaIndex) SetCacheSize(mb int) {
	if mb <= 0 {
		idx.nodeCache = nil
		return
	}
	dim := int(idx.metadata.Dims)
	bytesPerNode := dim*4 + idx.maxDegree*4 + 4
	nodes := (mb * 1024 * 1024) / bytesPerNode
	if nodes < 1 {
		nodes = 1
	}
	maxNodeID := int(idx.metadata.NumPoints + uint64(len(idx.appendVectors)))
	idx.nodeCache = NewNodeCache(nodes, maxNodeID)
}

// WarmupCache populates the cache with up to numNodes nodes via BFS from the
// medoid. If numNodes is 0, fills to cache capacity. Nodes already cached
// are skipped. Returns the number of nodes cached.
func (idx *DiskVamanaIndex) WarmupCache(numNodes int) int {
	if idx.nodeCache == nil {
		return 0
	}
	if numNodes <= 0 {
		numNodes = idx.nodeCache.Capacity()
	}

	medoid := idx.metadata.Medoid
	// If the medoid is deleted, find the first non-deleted node as entry point.
	if idx.deleted.IsDeleted(medoid) {
		for i := uint64(0); i < idx.metadata.NumPoints; i++ {
			if !idx.deleted.IsDeleted(i) {
				medoid = i
				break
			}
		}
	}

	visited := make(map[uint64]bool, numNodes*2)
	queue := make([]uint64, 0, numNodes*2)
	queue = append(queue, medoid)
	visited[medoid] = true

	total := idx.totalPoints()
	dim := int(idx.metadata.Dims)

	for len(queue) > 0 && idx.nodeCache.Len() < numNodes {
		batchSize := len(queue)
		if batchSize > 1024 {
			batchSize = 1024
		}
		batch := queue[:batchSize]
		queue = queue[batchSize:]

		for _, nodeID := range batch {
			if idx.nodeCache.Len() >= numNodes {
				return idx.nodeCache.Len()
			}

			if nodeID >= idx.metadata.NumPoints {
				continue
			}
			if idx.deleted.IsDeleted(nodeID) {
				continue
			}

			vec := make([]float32, dim)
			if err := idx.reader.ReadVector(nodeID, vec); err != nil {
				continue
			}
			neighbors, err := idx.reader.ReadNeighbors(nodeID)
			if err != nil {
				continue
			}

			vc := make([]float32, len(vec))
			copy(vc, vec)
			if !idx.nodeCache.Insert(nodeID, vc, neighbors) {
				return idx.nodeCache.Len() // cache full
			}

			// Expand BFS: enqueue unvisited neighbors
			for _, nbr := range neighbors {
				if uint64(nbr) < total && !visited[uint64(nbr)] {
					visited[uint64(nbr)] = true
					queue = append(queue, uint64(nbr))
				}
			}
		}
		_ = dim
	}

	return idx.nodeCache.Len()
}

// CacheStats returns cache statistics.
func (idx *DiskVamanaIndex) CacheStats() CacheStats {
	if idx.nodeCache == nil {
		return CacheStats{}
	}
	return idx.nodeCache.Stats()
}

// 编译时接口检查
var _ MutableIndex = (*DiskVamanaIndex)(nil)
