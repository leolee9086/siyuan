package vectordb

import (
	"errors"
	"fmt"
	"math"
	"math/bits"
	"sync"
	"sync/atomic"

	"s-forge.local/vectordb/bbq"
)

var errBBQCentroidDimension = errors.New("BBQ centroid dimension mismatch")

// VectorStore manages storage for high-dimensional vectors.
// It uses contiguous memory layout for cache efficiency.
// 支持BBQ (Better Binary Quantization) 量化存储
type VectorStore struct {
	Dimension int

	// Primary storage: Flattened float32 array
	// vectors[docID * dim + i]
	vectors []float32

	// BBQ 量化存储。数据向量只常驻 1-bit 打包码；未打包码仅在写入时使用 bbqScratch 生成。
	// 1-bit 打包数据（每 8 维度 1 字节，packed[docID * packedSize + i]）
	bbqPacked  []byte
	bbqScratch []byte
	// 校正因子
	bbqCorrections []bbq.QuantizationResult

	// 打包大小 (字节数 = (dimension + 7) / 8)
	packedSize int

	// BBQ组件
	quantizer *bbq.ScalarQuantizer
	scorer    *bbq.QuantizedScorer
	centroid  []float32

	// 质心采用固定 epoch：当前 epoch 内所有 data code 共用同一质心，达到几何增长或漂移阈值后原子重编码。
	centroidSum            []float64
	centroidSquareSum      float64
	centroidCount          uint64
	centroidEpoch          uint64
	centroidRebuildAt      uint64
	centroidMutations      uint64
	centroidTrainingTarget uint64
	active                 []bool

	visitedEpoch []uint32
	currentEpoch uint32
	mu           sync.RWMutex
}

// NewVectorStore creates a new VectorStore
func NewVectorStore(dimension int, metricType string) *VectorStore {
	packedSize := (dimension + 7) / 8
	st, _ := resolveSimilarity(metricType) // 内部路径：默认余弦，忽略未知度量
	return &VectorStore{
		Dimension:         dimension,
		vectors:           make([]float32, 0),
		bbqPacked:         make([]byte, 0),
		bbqScratch:        make([]byte, dimension),
		bbqCorrections:    make([]bbq.QuantizationResult, 0),
		packedSize:        packedSize,
		quantizer:         bbq.NewScalarQuantizer(st),
		scorer:            bbq.NewQuantizedScorer(st),
		centroid:          make([]float32, dimension),
		centroidSum:       make([]float64, dimension),
		centroidEpoch:     0,
		centroidRebuildAt: 1,
		visitedEpoch:      make([]uint32, 0),
		currentEpoch:      1,
	}
}

// SetBBQCentroid 设置外部训练的质心。后续写入仍会维护运行统计量，并在数据发生显著漂移后原子重编码。
func (s *VectorStore) SetBBQCentroid(centroid []float32) error {
	if len(centroid) != s.Dimension {
		return errBBQCentroidDimension
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.vectors) != 0 {
		return errors.New("BBQ centroid must be trained before inserting vectors")
	}
	s.centroid = append(s.centroid[:0], centroid...)
	s.centroidEpoch = 1
	// 外部只提供质心而未提供训练集大小时，先积累一个小型校准窗口，避免首个写入覆盖训练结果。
	s.centroidRebuildAt = 256
	return nil
}

// TrainBBQCentroid 使用完整初始训练集设置质心，并在初始写入阶段同步建立增量统计量。
func (s *VectorStore) TrainBBQCentroid(vectors [][]float32) error {
	centroid, err := ComputeBBQCentroid(vectors, s.Dimension)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.vectors) != 0 {
		return errors.New("BBQ centroid must be trained before inserting vectors")
	}
	s.centroid = append(s.centroid[:0], centroid...)
	s.centroidEpoch = 1
	s.centroidTrainingTarget = uint64(len(vectors))
	s.centroidRebuildAt = nextCentroidRebuildCount(uint64(len(vectors)))
	return nil
}

func nextCentroidRebuildCount(count uint64) uint64 {
	if count == 0 {
		return 1
	}
	if count >= 1<<63 {
		return math.MaxUint64
	}
	return 1 << bits.Len64(count)
}

// ComputeBBQCentroid 计算训练向量的逐维均值。
func ComputeBBQCentroid(vectors [][]float32, dimension int) ([]float32, error) {
	if len(vectors) == 0 || dimension <= 0 {
		return nil, errBBQCentroidDimension
	}
	centroid := make([]float32, dimension)
	for _, vector := range vectors {
		if len(vector) != dimension {
			return nil, errBBQCentroidDimension
		}
		for index, value := range vector {
			centroid[index] += value
		}
	}
	inverseCount := 1 / float32(len(vectors))
	for index := range centroid {
		centroid[index] *= inverseCount
	}
	return centroid, nil
}

// resolveSimilarity 将字符串距离度量映射为 BBQ 枚举类型。
// 支持的度量： "l2" (EuclideanDistance)、"cosine" (CosineSimilarity)、"ip" (MaxInnerProduct)。
// 空字符串或未知值返回 errResult 以允许调用方决定默认行为。
func resolveSimilarity(metricType string) (bbq.SimilarityType, error) {
	switch metricType {
	case "l2", "euclidean":
		return bbq.EuclideanDistance, nil
	case "cosine":
		return bbq.CosineSimilarity, nil
	case "ip", "dot", "innerproduct":
		return bbq.MaxInnerProduct, nil
	case "":
		return bbq.CosineSimilarity, nil // 空字符串使用默认
	default:
		return 0, fmt.Errorf("unsupported distance metric %q: expected one of l2, cosine, ip", metricType)
	}
}

// growSlice 确保 slice 长度至少为 targetLen，容量不足时以 2x 策略扩容。
func growSlice[T any](s []T, targetLen int) []T {
	if cap(s) < targetLen {
		newS := make([]T, targetLen, targetLen*2)
		copy(newS, s)
		return newS
	}
	if len(s) < targetLen {
		return s[:targetLen]
	}
	return s
}

// Grow ensures space for n vectors (DocID from 0 to n-1)
func (s *VectorStore) Grow(n int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.vectors = growSlice(s.vectors, n*s.Dimension)
	s.bbqPacked = growSlice(s.bbqPacked, n*s.packedSize)
	s.bbqCorrections = growSlice(s.bbqCorrections, n)
	s.active = growSlice(s.active, n)
	s.visitedEpoch = growSlice(s.visitedEpoch, n)
}

// Set stores a vector at the given DocID
func (s *VectorStore) Set(docID DocID, vec []float32) {
	if len(vec) != s.Dimension {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := int(docID)
	wasActive := id < len(s.active) && s.active[id]
	if wasActive {
		offset := id * s.Dimension
		oldVector := s.vectors[offset : offset+s.Dimension]
		s.removeCentroidSampleLocked(oldVector)
	}

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
	if len(s.active) <= id {
		s.active = growSlice(s.active, id+1)
	}
	s.active[id] = true
	s.addCentroidSampleLocked(vec)

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
			newCorr := make([]bbq.QuantizationResult, id+1, (id+1)*2)
			copy(newCorr, s.bbqCorrections)
			s.bbqCorrections = newCorr
		} else {
			s.bbqCorrections = s.bbqCorrections[:id+1]
		}
	}

	if s.maybeRebuildCentroidLocked() {
		return
	}
	s.quantizeVectorLocked(id)
}

// Delete 从质心运行统计量中移除向量。原始向量保留，便于文档 ID 复用和持久化恢复。
func (s *VectorStore) Delete(docID DocID) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := int(docID)
	if id >= len(s.active) || !s.active[id] {
		return
	}
	offset := id * s.Dimension
	s.removeCentroidSampleLocked(s.vectors[offset : offset+s.Dimension])
	s.active[id] = false
	s.maybeRebuildCentroidLocked()
}

func (s *VectorStore) addCentroidSampleLocked(vector []float32) {
	for index, value := range vector {
		value64 := float64(value)
		s.centroidSum[index] += value64
		s.centroidSquareSum += value64 * value64
	}
	s.centroidCount++
	s.centroidMutations++
}

func (s *VectorStore) removeCentroidSampleLocked(vector []float32) {
	for index, value := range vector {
		value64 := float64(value)
		s.centroidSum[index] -= value64
		s.centroidSquareSum -= value64 * value64
	}
	if s.centroidCount > 0 {
		s.centroidCount--
	}
	s.centroidMutations++
}

func (s *VectorStore) maybeRebuildCentroidLocked() bool {
	if s.centroidCount == 0 {
		clear(s.centroid)
		s.centroidEpoch++
		s.centroidMutations = 0
		s.centroidRebuildAt = 1
		clear(s.bbqPacked)
		clear(s.bbqCorrections)
		return true
	}
	if s.centroidTrainingTarget > 0 {
		if s.centroidCount < s.centroidTrainingTarget {
			return false
		}
		s.centroidTrainingTarget = 0
		s.centroidMutations = 0
		s.centroidRebuildAt = nextCentroidRebuildCount(s.centroidCount)
		return false
	}

	rebuild := s.centroidEpoch == 0 || s.centroidCount >= s.centroidRebuildAt
	if !rebuild {
		minMutations := s.centroidCount / 8
		if minMutations < 64 {
			minMutations = 64
		}
		if s.centroidMutations >= minMutations {
			rebuild = s.centroidDriftedLocked() || s.centroidMutations >= s.centroidCount
		}
	}
	if !rebuild {
		return false
	}

	inverseCount := 1 / float64(s.centroidCount)
	for index := range s.centroid {
		s.centroid[index] = float32(s.centroidSum[index] * inverseCount)
	}
	s.reencodeAllLocked()
	s.centroidEpoch++
	s.centroidMutations = 0
	s.centroidRebuildAt = nextCentroidRebuildCount(s.centroidCount)
	return true
}

func (s *VectorStore) centroidDriftedLocked() bool {
	inverseCount := 1 / float64(s.centroidCount)
	var centroidEnergy float64
	var driftEnergy float64
	for index, current := range s.centroid {
		mean := s.centroidSum[index] * inverseCount
		centroidEnergy += mean * mean
		delta := mean - float64(current)
		driftEnergy += delta * delta
	}
	variance := s.centroidSquareSum*inverseCount - centroidEnergy
	if variance <= 0 {
		return driftEnergy > 0
	}
	// 当均方质心位移达到每维标准差的 10% 时开启新 epoch。
	return driftEnergy >= variance*0.01
}

func (s *VectorStore) quantizeVectorLocked(id int) {
	offset := id * s.Dimension
	correction := s.quantizer.Quantize(s.vectors[offset:offset+s.Dimension], s.bbqScratch, bbq.IndexQuantizationBits, s.centroid)
	s.bbqCorrections[id] = correction
	packedOffset := id * s.packedSize
	bbq.PackBinaryInto(s.bbqScratch, s.bbqPacked[packedOffset:packedOffset+s.packedSize])
}

func (s *VectorStore) reencodeAllLocked() {
	for id, active := range s.active {
		if active {
			s.quantizeVectorLocked(id)
			continue
		}
		packedOffset := id * s.packedSize
		if packedOffset+s.packedSize <= len(s.bbqPacked) {
			clear(s.bbqPacked[packedOffset : packedOffset+s.packedSize])
		}
		if id < len(s.bbqCorrections) {
			s.bbqCorrections[id] = bbq.QuantizationResult{}
		}
	}
}

// restoreCentroidStatistics 为旧快照重建增量统计量，但保留快照中已经持久化的质心和 data code。
func (s *VectorStore) restoreCentroidStatistics(docMap []string, deleted map[DocID]bool) {
	vectorCount := len(s.vectors) / s.Dimension
	s.active = make([]bool, vectorCount)
	clear(s.centroidSum)
	s.centroidSquareSum = 0
	s.centroidCount = 0
	for id := 0; id < vectorCount; id++ {
		if id >= len(docMap) || docMap[id] == "" || deleted[DocID(id)] {
			continue
		}
		s.active[id] = true
		offset := id * s.Dimension
		vector := s.vectors[offset : offset+s.Dimension]
		for index, value := range vector {
			value64 := float64(value)
			s.centroidSum[index] += value64
			s.centroidSquareSum += value64 * value64
		}
		s.centroidCount++
	}
	if s.centroidEpoch == 0 && s.centroidCount > 0 {
		s.centroidEpoch = 1
	}
	s.centroidMutations = 0
	s.centroidRebuildAt = nextCentroidRebuildCount(s.centroidCount)
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

// GetUnsafe 获取向量副本，调用方不得修改索引存储。
func (s *VectorStore) GetUnsafe(docID DocID) ([]float32, bool) {
	return s.Get(docID)
}

// ComputeDistance computes distance between two docIDs using raw vectors.
func (s *VectorStore) ComputeDistance(a, b DocID, metric string) float32 {
	s.mu.RLock()
	defer s.mu.RUnlock()

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

// ComputeBBQDistance 计算两个已索引向量间的 BBQ 量化距离。
func (s *VectorStore) ComputeBBQDistance(a, b DocID) float32 {
	s.mu.RLock()
	defer s.mu.RUnlock()

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

	bitDotProduct := bbq.ComputePackedDotProduct(packedA, packedB)

	corrA := s.bbqCorrections[idA]
	corrB := s.bbqCorrections[idB]

	return s.scorer.ComputeQuantizedDistance(bitDotProduct, corrA, corrB, s.Dimension, 0, false)
}

// ComputeBBQDistanceFromQuery 使用 4-bit BitTranspose 查询与 1-bit 索引计算非对称 BBQ 距离。
func (s *VectorStore) ComputeBBQDistanceFromQuery(queryTransposed []byte, queryCorrection bbq.QuantizationResult, docID DocID) float32 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.computeBBQDistanceFromQueryLocked(queryTransposed, queryCorrection, docID)
}

// ComputeBBQDistancesFromQuery 在一次读锁内批量计算 4-bit query × 1-bit data 距离。
func (s *VectorStore) ComputeBBQDistancesFromQuery(queryTransposed []byte, queryCorrection bbq.QuantizationResult, docIDs []DocID, dst []float32) []float32 {
	if cap(dst) < len(docIDs) {
		dst = make([]float32, len(docIDs))
	} else {
		dst = dst[:len(docIDs)]
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for index, docID := range docIDs {
		dst[index] = s.computeBBQDistanceFromQueryLocked(queryTransposed, queryCorrection, docID)
	}
	return dst
}

func (s *VectorStore) computeBBQDistanceFromQueryLocked(queryTransposed []byte, queryCorrection bbq.QuantizationResult, docID DocID) float32 {

	id := int(docID)

	if id >= len(s.bbqCorrections) {
		return 1e9
	}

	packedOffset := id * s.packedSize
	endOffset := packedOffset + s.packedSize
	if endOffset > len(s.bbqPacked) {
		return 1e9
	}

	indexPacked := s.bbqPacked[packedOffset:endOffset]

	// 使用 POPCNT 优化的打包位点积
	indexCorrection := s.bbqCorrections[id]
	return bbq.ComputeAsymmetricDistance(s.scorer, queryTransposed, queryCorrection, indexPacked, indexCorrection, s.Dimension)
}

// QuantizeQuery 将查询向量量化为 4-bit BitTranspose 布局，索引向量保持 1-bit packed 布局。
func (s *VectorStore) QuantizeQuery(query []float32) ([]byte, bbq.QuantizationResult) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	quantized := make([]byte, len(query))
	return bbq.QuantizeAsymmetricQuery(s.quantizer, query, s.centroid, quantized)
}

// QuantizeVector 将已存储向量临时编码为 4-bit query，索引中仍只保留 1-bit data code。
func (s *VectorStore) QuantizeVector(docID DocID) ([]byte, bbq.QuantizationResult) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	offset := int(docID) * s.Dimension
	endOffset := offset + s.Dimension
	if endOffset > len(s.vectors) {
		return nil, bbq.QuantizationResult{}
	}
	quantized := make([]byte, s.Dimension)
	return bbq.QuantizeAsymmetricQuery(s.quantizer, s.vectors[offset:endOffset], s.centroid, quantized)
}

// GetCorrection 获取指定文档的校正因子
func (s *VectorStore) GetCorrection(docID DocID) (bbq.QuantizationResult, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id := int(docID)
	if id >= len(s.bbqCorrections) {
		return bbq.QuantizationResult{}, false
	}
	return s.bbqCorrections[id], true
}

// ComputeDistanceFromVector computes distance between a query vector and a stored docID.
func (s *VectorStore) ComputeDistanceFromVector(query []float32, docID DocID, metric string) float32 {
	s.mu.RLock()
	defer s.mu.RUnlock()

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

// ComputeDistancesFromVector 在一次读锁内批量计算距离，避免图遍历为每条边重复获取存储锁。
func (s *VectorStore) ComputeDistancesFromVector(query []float32, docIDs []DocID, metric string, dst []float32) []float32 {
	if cap(dst) < len(docIDs) {
		dst = make([]float32, len(docIDs))
	} else {
		dst = dst[:len(docIDs)]
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	for index, docID := range docIDs {
		offset := int(docID) * s.Dimension
		endOffset := offset + s.Dimension
		if endOffset > len(s.vectors) {
			dst[index] = 1e9
			continue
		}
		vector := s.vectors[offset:endOffset]
		if metric == "l2" {
			dst[index] = L2Distance(query, vector)
		} else {
			dst[index] = CosineDistance(query, vector)
		}
	}
	return dst
}

// NewSearchEpoch 开始新的搜索并返回该搜索使用的 epoch。
func (s *VectorStore) NewSearchEpoch() uint32 {
	return atomic.AddUint32(&s.currentEpoch, 1)
}

// IsVisited 检查节点是否在指定搜索 epoch 中已被访问。
func (s *VectorStore) IsVisited(docID DocID, epoch uint32) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id := int(docID)
	if id >= len(s.visitedEpoch) {
		return false
	}
	return atomic.LoadUint32(&s.visitedEpoch[id]) == epoch
}

// MarkVisited 标记节点已在指定搜索 epoch 中被访问。
func (s *VectorStore) MarkVisited(docID DocID, epoch uint32) {
	id := int(docID)

	s.mu.RLock()
	if id < len(s.visitedEpoch) {
		atomic.StoreUint32(&s.visitedEpoch[id], epoch)
		s.mu.RUnlock()
		return
	}
	s.mu.RUnlock()

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
	atomic.StoreUint32(&s.visitedEpoch[id], epoch)
	s.mu.Unlock()
}

// EnsureVisitedCapacity 确保访问标记数组能够容纳 n 个节点。
func (s *VectorStore) EnsureVisitedCapacity(n int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.visitedEpoch) < n {
		s.visitedEpoch = growSlice(s.visitedEpoch, n)
	}
}
