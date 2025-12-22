package vectordb

import (
    "sync"
    "sync/atomic"
)

// VectorStore manages storage for high-dimensional vectors.
// It uses contiguous memory layout for cache efficiency.
// 支持BBQ (Better Binary Quantization) 量化存储
type VectorStore struct {
    Dimension int
    
    // Primary storage: Flattened float32 array
    // vectors[docID * dim + i]
    vectors []float32
    
    // BBQ量化存储
    // 1-bit量化结果 (未打包, 每维度1字节, quantized[docID * dim + i])
    bbqQuantized []byte
    // 1-bit打包数据 (每8维度1字节, packed[docID * packedSize + i])
    bbqPacked []byte
    // 校正因子
    bbqCorrections []量化结果
    
    // 打包大小 (字节数 = (dimension + 7) / 8)
    packedSize int
    
    // BBQ组件
    quantizer *标量量化器
    scorer    *量化评分器
    centroid  []float32 // 默认使用零向量
    
    // Epoch-based Visited Set (P0优化)
    // 使用epoch替代map[DocID]bool,消除每次搜索的map分配
    visitedEpoch []uint32  // 每个节点的最后访问epoch
    currentEpoch uint32    // 当前搜索epoch (原子操作)
    
    mu sync.RWMutex
}

// NewVectorStore creates a new VectorStore
func NewVectorStore(dimension int) *VectorStore {
    packedSize := (dimension + 7) / 8
    return &VectorStore{
        Dimension:      dimension,
        vectors:        make([]float32, 0),
        bbqQuantized:   make([]byte, 0),
        bbqPacked:      make([]byte, 0),
        bbqCorrections: make([]量化结果, 0),
        packedSize:     packedSize,
        quantizer:      新建标量量化器(余弦相似度),
        scorer:         新建量化评分器(余弦相似度),
        centroid:       创建零质心(dimension),
        visitedEpoch:   make([]uint32, 0),
        currentEpoch:   1, // 从1开始,0表示未访问
    }
}


// Grow ensures space for n vectors (DocID from 0 to n-1)
func (s *VectorStore) Grow(n int) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    // 原始向量存储
    targetVecLen := n * s.Dimension
    if cap(s.vectors) < targetVecLen {
        newVecs := make([]float32, targetVecLen, targetVecLen*2)
        copy(newVecs, s.vectors)
        s.vectors = newVecs
    } else if len(s.vectors) < targetVecLen {
        s.vectors = s.vectors[:targetVecLen]
    }
    
    // BBQ量化存储 (未打包)
    targetQuantLen := n * s.Dimension
    if cap(s.bbqQuantized) < targetQuantLen {
        newQuant := make([]byte, targetQuantLen, targetQuantLen*2)
        copy(newQuant, s.bbqQuantized)
        s.bbqQuantized = newQuant
    } else if len(s.bbqQuantized) < targetQuantLen {
        s.bbqQuantized = s.bbqQuantized[:targetQuantLen]
    }
    
    // BBQ打包存储
    targetPackedLen := n * s.packedSize
    if cap(s.bbqPacked) < targetPackedLen {
        newPacked := make([]byte, targetPackedLen, targetPackedLen*2)
        copy(newPacked, s.bbqPacked)
        s.bbqPacked = newPacked
    } else if len(s.bbqPacked) < targetPackedLen {
        s.bbqPacked = s.bbqPacked[:targetPackedLen]
    }
    
    // BBQ校正因子
    if cap(s.bbqCorrections) < n {
        newCorr := make([]量化结果, n, n*2)
        copy(newCorr, s.bbqCorrections)
        s.bbqCorrections = newCorr
    } else if len(s.bbqCorrections) < n {
        s.bbqCorrections = s.bbqCorrections[:n]
    }
    
    // Visited Epoch (P0优化)
    if cap(s.visitedEpoch) < n {
        newVisited := make([]uint32, n, n*2)
        copy(newVisited, s.visitedEpoch)
        s.visitedEpoch = newVisited
    } else if len(s.visitedEpoch) < n {
        s.visitedEpoch = s.visitedEpoch[:n]
    }
}

// Set stores a vector at the given DocID
func (s *VectorStore) Set(docID DocID, vec []float32) {
    if len(vec) != s.Dimension {
        return
    }
    
    s.mu.Lock()
    defer s.mu.Unlock()
    
    id := int(docID)
    
    // 确保原始向量容量
    minLen := (id + 1) * s.Dimension
    if len(s.vectors) < minLen {
        newLen := minLen
        if cap(s.vectors) < newLen {
            newVecs := make([]float32, newLen, newLen*2)
            copy(newVecs, s.vectors)
            s.vectors = newVecs
        } else {
            s.vectors = s.vectors[:newLen]
        }
    }
    
    // 复制原始向量
    offset := id * s.Dimension
    copy(s.vectors[offset:], vec)
    
    // BBQ量化: 确保容量
    if len(s.bbqQuantized) < minLen {
        if cap(s.bbqQuantized) < minLen {
            newQuant := make([]byte, minLen, minLen*2)
            copy(newQuant, s.bbqQuantized)
            s.bbqQuantized = newQuant
        } else {
            s.bbqQuantized = s.bbqQuantized[:minLen]
        }
    }
    
    minPackedLen := (id + 1) * s.packedSize
    if len(s.bbqPacked) < minPackedLen {
        if cap(s.bbqPacked) < minPackedLen {
            newPacked := make([]byte, minPackedLen, minPackedLen*2)
            copy(newPacked, s.bbqPacked)
            s.bbqPacked = newPacked
        } else {
            s.bbqPacked = s.bbqPacked[:minPackedLen]
        }
    }
    
    if len(s.bbqCorrections) <= id {
        if cap(s.bbqCorrections) <= id {
            newCorr := make([]量化结果, id+1, (id+1)*2)
            copy(newCorr, s.bbqCorrections)
            s.bbqCorrections = newCorr
        } else {
            s.bbqCorrections = s.bbqCorrections[:id+1]
        }
    }
    
    // 执行BBQ量化
    quantDest := s.bbqQuantized[offset : offset+s.Dimension]
    correction := s.quantizer.标量量化(vec, quantDest, 索引量化位数, s.centroid)
    s.bbqCorrections[id] = correction
    
    // 打包为二进制
    packed := 打包为二进制(quantDest)
    packedOffset := id * s.packedSize
    copy(s.bbqPacked[packedOffset:], packed)
}

// Get retrieves a vector by DocID (returns a copy for safety)
func (s *VectorStore) Get(docID DocID) ([]float32, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    id := int(docID)
    offset := id * s.Dimension
    if offset >= len(s.vectors) {
        return nil, false
    }
    
    vec := make([]float32, s.Dimension)
    copy(vec, s.vectors[offset:offset+s.Dimension])
    return vec, true
}

// GetUnsafe 零拷贝获取向量 (调用方不得修改返回值!)
// 性能优化: 避免每次 4KB 的内存分配
func (s *VectorStore) GetUnsafe(docID DocID) ([]float32, bool) {
    id := int(docID)
    offset := id * s.Dimension
    endOffset := offset + s.Dimension
    
    // 直接读取无锁 (向量数组只追加不修改)
    if endOffset > len(s.vectors) {
        return nil, false
    }
    
    return s.vectors[offset:endOffset:endOffset], true
}

// ComputeDistance computes distance between two docIDs using raw vectors
// 零锁优化: 向量数组只追加不删除,读取无需加锁
func (s *VectorStore) ComputeDistance(a, b DocID, metric string) float32 {
    idA := int(a)
    idB := int(b)
    
    offsetA := idA * s.Dimension
    offsetB := idB * s.Dimension
    endA := offsetA + s.Dimension
    endB := offsetB + s.Dimension
    
    if endA > len(s.vectors) || endB > len(s.vectors) {
        return 1e9
    }
    
    vecA := s.vectors[offsetA:endA]
    vecB := s.vectors[offsetB:endB]
    
    if metric == "l2" {
        return L2Distance(vecA, vecB)
    }
    return CosineDistance(vecA, vecB)
}

// ComputeBBQDistance 计算两个已索引向量间的BBQ量化距离
// 零锁优化: 数组只追加不删除
func (s *VectorStore) ComputeBBQDistance(a, b DocID) float32 {
    idA := int(a)
    idB := int(b)
    
    packedOffsetA := idA * s.packedSize
    packedOffsetB := idB * s.packedSize
    endA := packedOffsetA + s.packedSize
    endB := packedOffsetB + s.packedSize
    
    if endA > len(s.bbqPacked) || endB > len(s.bbqPacked) {
        return 1e9
    }
    if idA >= len(s.bbqCorrections) || idB >= len(s.bbqCorrections) {
        return 1e9
    }
    
    packedA := s.bbqPacked[packedOffsetA:endA]
    packedB := s.bbqPacked[packedOffsetB:endB]
    
    bitDotProduct := 计算打包位点积(packedA, packedB)
    
    corrA := s.bbqCorrections[idA]
    corrB := s.bbqCorrections[idB]
    
    return s.scorer.计算量化距离(bitDotProduct, corrA, corrB, s.Dimension, 0, false)
}

// ComputeBBQDistanceFromQuery 计算查询向量与已索引向量的BBQ距离
// 1-bit 量化模式：使用打包位点积 + POPCNT 硬件加速
func (s *VectorStore) ComputeBBQDistanceFromQuery(queryPacked []byte, queryCorrection 量化结果, docID DocID) float32 {
    id := int(docID)
    
    if id >= len(s.bbqCorrections) {
        return 1e9
    }
    
    // 获取打包的索引向量
    packedOffset := id * s.packedSize
    endOffset := packedOffset + s.packedSize
    if endOffset > len(s.bbqPacked) {
        return 1e9
    }
    
    indexPacked := s.bbqPacked[packedOffset:endOffset]
    
    // 使用 POPCNT 优化的打包位点积
    bitDotProduct := 计算打包位点积(queryPacked, indexPacked)
    indexCorrection := s.bbqCorrections[id]
    
    return s.scorer.计算量化距离(bitDotProduct, queryCorrection, indexCorrection, s.Dimension, 0, false)
}

// QuantizeQuery 对查询向量进行1-bit量化并打包
func (s *VectorStore) QuantizeQuery(query []float32) ([]byte, 量化结果) {
    quantized := make([]byte, len(query))
    correction := s.quantizer.标量量化(query, quantized, 查询量化位数, s.centroid)
    // 打包为二进制 (8个bit压缩为1个byte)
    packed := 打包为二进制(quantized)
    return packed, correction
}

// GetCorrection 获取指定文档的校正因子
func (s *VectorStore) GetCorrection(docID DocID) (量化结果, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    id := int(docID)
    if id >= len(s.bbqCorrections) {
        return 量化结果{}, false
    }
    return s.bbqCorrections[id], true
}

// ComputeDistanceFromVector computes distance between a query vector and a stored docID
// 零拷贝优化: 直接访问存储的向量切片
func (s *VectorStore) ComputeDistanceFromVector(query []float32, docID DocID, metric string) float32 {
    id := int(docID)
    offset := id * s.Dimension
    endOffset := offset + s.Dimension
    
    // 直接读取无锁 (向量数组只追加不修改)
    if endOffset > len(s.vectors) {
        return 1e9
    }
    
    vec := s.vectors[offset:endOffset]
    
    if metric == "l2" {
        return L2Distance(query, vec)
    }
    return CosineDistance(query, vec)
}

// =========================================
// Epoch-based Visited Set (P0优化)
// 使用epoch计数器替代map分配,O(1)重置
// =========================================

// NewSearchEpoch 开始新的搜索,递增epoch计数器
// 返回当前epoch值,用于后续的IsVisited和MarkVisited
func (s *VectorStore) NewSearchEpoch() uint32 {
    return atomic.AddUint32(&s.currentEpoch, 1)
}

// IsVisited 检查节点是否在当前搜索中已被访问
// 无需加锁,使用原子读取
func (s *VectorStore) IsVisited(docID DocID, epoch uint32) bool {
    id := int(docID)
    if id >= len(s.visitedEpoch) {
        return false
    }
    return atomic.LoadUint32(&s.visitedEpoch[id]) == epoch
}

// MarkVisited 标记节点为已访问
// 无需加锁,使用原子写入
func (s *VectorStore) MarkVisited(docID DocID, epoch uint32) {
    id := int(docID)
    if id >= len(s.visitedEpoch) {
        // 需要扩展数组 (通常不应发生,因为Grow应该已经调用)
        s.mu.Lock()
        if id >= len(s.visitedEpoch) {
            newLen := id + 1
            if cap(s.visitedEpoch) < newLen {
                newVisited := make([]uint32, newLen, newLen*2)
                copy(newVisited, s.visitedEpoch)
                s.visitedEpoch = newVisited
            } else {
                s.visitedEpoch = s.visitedEpoch[:newLen]
            }
        }
        s.mu.Unlock()
    }
    atomic.StoreUint32(&s.visitedEpoch[id], epoch)
}

// EnsureVisitedCapacity 确保visitedEpoch数组有足够容量
// 在搜索开始前调用一次
func (s *VectorStore) EnsureVisitedCapacity(n int) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    if len(s.visitedEpoch) < n {
        if cap(s.visitedEpoch) < n {
            newVisited := make([]uint32, n, n*2)
            copy(newVisited, s.visitedEpoch)
            s.visitedEpoch = newVisited
        } else {
            s.visitedEpoch = s.visitedEpoch[:n]
        }
    }
}
