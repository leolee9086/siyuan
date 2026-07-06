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

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// 索引持久化
// ============================================================================

// SaveToDisk 将内存索引保存到磁盘
//
// 保存的文件包括：
//   - {path}.index: 主索引文件（图头 + 节点数据）
//   - {path}.bbq: BBQ 量化码（如果启用）
//   - {path}.deleted: 删除位图（如果有删除的节点）
//
// 参数：
//   - path: 基础路径（不含扩展名）
//
// 返回错误如果：
//   - 文件创建失败
//   - 写入失败
func (idx *VamanaIndex) SaveToDisk(path string) error {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	// 保存主索引文件
	if err := idx.saveIndexFile(path + diskIndexExt); err != nil {
		return fmt.Errorf("保存索引文件失败: %w", err)
	}

	// 如果启用了 BBQ 并且有 BBQ 数据，保存 BBQ 文件
	if idx.bbqEnabled && idx.bbqPacked != nil {
		if err := idx.saveBBQFile(path + diskBBQExt); err != nil {
			return fmt.Errorf("保存BBQ文件失败: %w", err)
		}
	}

	// 如果有删除的节点，保存删除位图
	if idx.nDeleted > 0 {
		if err := idx.saveDeletedBitmap(path + diskDeletedExt); err != nil {
			return fmt.Errorf("保存删除位图失败: %w", err)
		}
	}

	return nil
}

// saveIndexFile 保存主索引文件
func (idx *VamanaIndex) saveIndexFile(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// 使用带缓冲的写入器
	w := bufio.NewWriterSize(f, 16*1024*1024) // 16MB buffer

	numPoints := uint64(len(idx.vectors))
	dims := uint64(idx.dimension)

	// 扫描所有节点，找出实际最大邻居数量
	// 内存索引中的邻居数量可能超过配置的 R 值，必须保存完整的邻居列表
	actualMaxDegree := uint64(0)
	for _, neighbors := range idx.neighbors {
		if neighbors != nil && uint64(len(neighbors)) > actualMaxDegree {
			actualMaxDegree = uint64(len(neighbors))
		}
	}
	// 至少使用配置的 R 值作为最小值，确保有足够空间
	if actualMaxDegree < uint64(idx.config.R) {
		actualMaxDegree = uint64(idx.config.R)
	}

	// 计算节点长度：vector(dims*4) + neighborCount(4) + neighbors(actualMaxDegree*4)
	// 显式使用 uint64 类型避免类型混合计算问题
	nodeLen := dims*4 + 4 + actualMaxDegree*4
	blockSize := uint64(storage.DefaultBlockSize)
	nodesPerBlock := blockSize / nodeLen
	if nodesPerBlock == 0 {
		nodesPerBlock = 1
	}

	// 计算总文件大小
	numBlocks := (numPoints + nodesPerBlock - 1) / nodesPerBlock
	dataSize := numBlocks * nodesPerBlock * nodeLen
	totalSize := blockSize + dataSize // 头块 + 数据块

	// 构建头部
	header := &storage.GraphHeader{
		Meta: storage.GraphMetadata{
			NumPoints:       numPoints,
			Dims:            dims,
			Medoid:          uint64(idx.medoid),
			NodeLen:         nodeLen,
			NodesPerBlock:   nodesPerBlock,
			FrozenNum:       0,
			FrozenLoc:       0,
			Reserved:        0,
			IndexFileSize:   totalSize,
			AssocDataLength: 0,
		},
		BlockSize: blockSize,
		Version: storage.LayoutVersion{
			Major: storage.CurrentMajorVersion,
			Minor: storage.CurrentMinorVersion,
		},
	}

	// 写入头部
	if err := storage.WriteGraphHeader(w, header); err != nil {
		return err
	}

	// 填充头块到 blockSize
	headerWritten := 4 + 80 + 8 + 8 // magic + metadata + blockSize + version
	padding := make([]byte, blockSize-uint64(headerWritten))
	if _, err := w.Write(padding); err != nil {
		return err
	}

	// 写入节点数据
	nodeData := make([]byte, nodeLen)
	maxDegreeInt := int(actualMaxDegree)
	for i := uint64(0); i < numPoints; i++ {
		idx.serializeNode(uint32(i), nodeData, maxDegreeInt)
		if _, err := w.Write(nodeData); err != nil {
			return err
		}
	}

	// 填充最后一个块
	remainder := numPoints % nodesPerBlock
	if remainder != 0 {
		paddingNodes := nodesPerBlock - remainder
		emptyNode := make([]byte, nodeLen)
		for i := uint64(0); i < paddingNodes; i++ {
			if _, err := w.Write(emptyNode); err != nil {
				return err
			}
		}
	}

	// 刷新缓冲区
	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}

// serializeNode 序列化单个节点到 buffer
//
// 参数:
//   - id: 节点 ID
//   - buf: 预分配的缓冲区，大小必须足够容纳 vector + neighborCount + maxDegree 个邻居
//   - maxDegree: 缓冲区中邻居槽位的数量（用于填充）
//
// 注意: 不再截断邻居列表，调用者必须确保 maxDegree >= 实际邻居数量
func (idx *VamanaIndex) serializeNode(id uint32, buf []byte, maxDegree int) {
	offset := 0

	// 写入向量
	vec := idx.vectors[id]
	for _, v := range vec {
		binary.LittleEndian.PutUint32(buf[offset:], math.Float32bits(v))
		offset += 4
	}

	// 获取邻居列表
	neighbors := idx.neighbors[id]
	if neighbors == nil {
		neighbors = []uint32{}
	}

	// 写入邻居数量（保存实际数量，不截断）
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(neighbors)))
	offset += 4

	// 写入邻居 ID
	for _, n := range neighbors {
		binary.LittleEndian.PutUint32(buf[offset:], n)
		offset += 4
	}

	// 填充剩余空间到 maxDegree
	for i := len(neighbors); i < maxDegree; i++ {
		binary.LittleEndian.PutUint32(buf[offset:], 0xFFFFFFFF)
		offset += 4
	}
}

// saveBBQFile 保存 BBQ 量化码文件
//
// BBQ 文件格式 (版本 2):
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
func (idx *VamanaIndex) saveBBQFile(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)

	numPoints := uint64(len(idx.vectors))
	dimension := uint32(idx.dimension)

	// 写入头部 (24 bytes)
	header := make([]byte, 24)
	binary.LittleEndian.PutUint32(header[0:], bbqMagic)
	binary.LittleEndian.PutUint32(header[4:], bbqVersion)
	binary.LittleEndian.PutUint64(header[8:], numPoints)
	binary.LittleEndian.PutUint32(header[16:], dimension)
	binary.LittleEndian.PutUint32(header[20:], 0) // 保留字段

	if _, err := w.Write(header); err != nil {
		return err
	}

	// 写入质心向量
	centroidBuf := make([]byte, idx.dimension*4)
	for i, v := range idx.bbqCentroid {
		binary.LittleEndian.PutUint32(centroidBuf[i*4:], math.Float32bits(v))
	}
	if _, err := w.Write(centroidBuf); err != nil {
		return err
	}

	// 写入打包的 BBQ 码
	if _, err := w.Write(idx.bbqPacked); err != nil {
		return err
	}

	// 写入量化元数据 (LowerBounds, UpperBounds, Corrections, QuantizedSums)
	metaBuf := make([]byte, 4)

	// LowerBounds
	for _, v := range idx.bbqLowerBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// UpperBounds
	for _, v := range idx.bbqUpperBounds {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// Corrections
	for _, v := range idx.bbqCorrections {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	// QuantizedSums
	for _, v := range idx.bbqQuantizedSums {
		binary.LittleEndian.PutUint32(metaBuf, math.Float32bits(v))
		if _, err := w.Write(metaBuf); err != nil {
			return err
		}
	}

	if err := w.Flush(); err != nil {
		return err
	}

	return f.Sync()
}

// saveDeletedBitmap 保存删除位图
func (idx *VamanaIndex) saveDeletedBitmap(path string) error {
	// 将内部 Bitset 转换为 storage.DeletedBitmap
	bitmap := storage.NewDeletedBitmap()

	numPoints := len(idx.vectors)
	for i := 0; i < numPoints; i++ {
		if idx.deleted.Test(uint32(i)) {
			bitmap.MarkDeleted(uint64(i))
		}
	}

	return storage.SaveDeletedBitmap(path, bitmap)
}
