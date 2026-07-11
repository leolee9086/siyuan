// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// 本程序为自由软件；依据 AGPL-3.0 或更高版本授权。
//
// bbqStore 统一内存索引与磁盘索引的 BBQ 量化数据只读访问，
// 使查询距离计算收敛为单一 bbqQueryDistance，消除内存/磁盘并行重复编码。

package vamana

import "s-forge.local/vectordb/bbq"

// bbqStore 提供 BBQ 量化码与元数据的统一只读访问。
// VamanaIndex 与 DiskVamanaIndex 均实现该接口。
//
// 调用方必须已持有对应索引的读锁，与 getBBQCodeUnlocked 等既有约定一致。
type bbqStore interface {
	// bbqCode 返回 id 的 packed 1-bit 量化码；不存在时返回 nil。
	bbqCode(id uint32) []byte
	// bbqMeta 返回 id 的量化元数据（LowerBound/UpperBound/Correction/QuantizedSum）。
	bbqMeta(id uint32) bbq.QuantizationResult
	// bbqDimension 返回向量维度。
	bbqDimension() int
}

// bbqQueryDistance 计算已量化查询向量到索引中 id 向量的近似距离。
//
// queryCode 固定为 4-bit BitTranspose 布局，data code 固定为 packed 1-bit。
//
// 当 store.bbqCode 返回 nil（节点无 BBQ 码）时返回 LargeInvalidDistance 哨兵值，
// 使该节点在候选堆中排到最后，与既有 bbqCorrectedDistance 行为一致。
// bbqScoreWithCode 计算已量化查询向量与给定索引码的 BBQ 距离（核心共享实现）。
//
// 这是所有 BBQ 查询距离计算的唯一点积+评分入口：
//   - indexCode 为 nil 时返回 LargeInvalidDistance 哨兵值
//   - 最终委托 bbq.ComputeAsymmetricDistance
//
// bbqQueryDistance（store 抽象）与 appendBBQCorrectedDistance*（实时量化码）均复用此函数，
// 消除"点积 + 评分"在内存索引、磁盘节点、append 节点之间的重复编码。
func bbqScoreWithCode(scorer *bbq.QuantizedScorer, indexCode []byte, indexCorr bbq.QuantizationResult, dimension int, queryCode []byte, queryCorr bbq.QuantizationResult) float32 {
	if indexCode == nil {
		return LargeInvalidDistance
	}
	return bbq.ComputeAsymmetricDistance(scorer, queryCode, queryCorr, indexCode, indexCorr, dimension)
}

// bbqQueryDistance 计算已量化查询向量到索引中 id 向量的近似距离。
//
// 通过 bbqStore 抽象取码与元数据，委托 bbqScoreWithCode 完成点积与评分。
// scorer 由调用方按距离度量创建并传入：内存索引复用预创建评分器，磁盘索引按搜索创建。
func bbqQueryDistance(store bbqStore, scorer *bbq.QuantizedScorer, id uint32, queryCode []byte, queryCorr bbq.QuantizationResult) float32 {
	return bbqScoreWithCode(scorer, store.bbqCode(id), store.bbqMeta(id), store.bbqDimension(), queryCode, queryCorr)
}

// =========================================
// VamanaIndex 实现 bbqStore
// 从连续内存切片取码与元数据。调用方必须已持有 idx.mu 读锁。
// =========================================

func (idx *VamanaIndex) bbqCode(id uint32) []byte {
	offset := int(id) * idx.bbqPackedSize
	return idx.bbqPacked[offset : offset+idx.bbqPackedSize]
}

func (idx *VamanaIndex) bbqMeta(id uint32) bbq.QuantizationResult {
	return bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[id],
		UpperBound:   idx.bbqUpperBounds[id],
		Correction:   idx.bbqCorrections[id],
		QuantizedSum: idx.bbqQuantizedSums[id],
	}
}

func (idx *VamanaIndex) bbqDimension() int {
	return idx.dimension
}

// =========================================
// DiskVamanaIndex 实现 bbqStore
// 从磁盘/mmap 取码，从内存元数据数组取校正因子。调用方必须已持有 idx.mu 读锁。
// =========================================

func (idx *DiskVamanaIndex) bbqCode(id uint32) []byte {
	return idx.getBBQCodeUnlocked(uint64(id))
}

func (idx *DiskVamanaIndex) bbqMeta(id uint32) bbq.QuantizationResult {
	return bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[id],
		UpperBound:   idx.bbqUpperBounds[id],
		Correction:   idx.bbqCorrections[id],
		QuantizedSum: idx.bbqQuantizedSums[id],
	}
}

func (idx *DiskVamanaIndex) bbqDimension() int {
	return int(idx.metadata.Dims)
}
