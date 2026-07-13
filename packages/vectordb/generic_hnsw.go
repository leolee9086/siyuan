package vectordb

import (
	"encoding/json"
	"fmt"
	"sync"

	"s-forge.local/vectordb/hnsw"
)

// GenericHNSWCollection 是使用任意 QueryDistancer 的内存 HNSW 集合。
// 距离对象由调用方持有并在 Insert 前更新；该集合不尝试序列化不透明数据。
type GenericHNSWCollection struct {
	Name  string
	Index *hnsw.HNSWIndex

	mu     sync.RWMutex
	idMap  map[string]hnsw.DocID
	docMap []string
	metas  [][]byte
}

// NewGenericHNSWCollection 创建不依赖向量维度的泛型 HNSW 集合。
func NewGenericHNSWCollection(name string, config hnsw.Config, distancer hnsw.NodeDistancer) (*GenericHNSWCollection, error) {
	if distancer == nil {
		return nil, fmt.Errorf("%w: generic HNSW requires a node distancer", ErrMetricUnsupported)
	}
	if config.M < 1 {
		config = hnsw.DefaultConfig()
	}
	if config.EfConstruction < 1 {
		config.EfConstruction = hnsw.DefaultConfig().EfConstruction
	}
	if config.EfSearch < 1 {
		config.EfSearch = hnsw.DefaultConfig().EfSearch
	}
	if config.MaxLevel < 1 {
		config.MaxLevel = hnsw.DefaultConfig().MaxLevel
	}
	return &GenericHNSWCollection{
		Name: name, Index: hnsw.NewHNSWIndex(0, config, distancer),
		idMap: make(map[string]hnsw.DocID), docMap: make([]string, 0), metas: make([][]byte, 0),
	}, nil
}

// Upsert 注册外部 ID 并把对应节点插入图；调用方应先让 distancer 可计算该节点。
func (g *GenericHNSWCollection) Upsert(id string, meta json.RawMessage) error {
	if id == "" {
		return ErrPointIDInvalid
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if existing, ok := g.idMap[id]; ok {
		g.Index.Delete(existing)
		g.metas[existing] = append(g.metas[existing][:0], meta...)
		if !g.Index.Insert(existing) {
			return fmt.Errorf("generic HNSW reinsert %q failed", id)
		}
		return nil
	}
	if uint64(len(g.docMap)) >= uint64(hnsw.InvalidEntryPoint) {
		return ErrCollectionCapacity
	}
	docID := hnsw.DocID(len(g.docMap))
	g.idMap[id] = docID
	g.docMap = append(g.docMap, id)
	g.metas = append(g.metas, append([]byte(nil), meta...))
	if !g.Index.Insert(docID) {
		delete(g.idMap, id)
		g.docMap = g.docMap[:len(g.docMap)-1]
		g.metas = g.metas[:len(g.metas)-1]
		return fmt.Errorf("generic HNSW insert %q failed", id)
	}
	return nil
}

// Delete 将外部 ID 标记为删除，并保留内部 ID 的稳定性。
func (g *GenericHNSWCollection) Delete(id string) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	docID, ok := g.idMap[id]
	if !ok {
		return nil
	}
	g.Index.Delete(docID)
	delete(g.idMap, id)
	g.docMap[docID] = ""
	g.metas[docID] = nil
	return nil
}

// Search 使用任意查询距离返回稳定外部 ID、距离和 meta。
func (g *GenericHNSWCollection) Search(query hnsw.QueryDistancer, topK, efSearch int) []SearchResult {
	if query == nil || topK <= 0 {
		return []SearchResult{}
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	neighbors := g.Index.SearchBy(query, topK, efSearch)
	results := make([]SearchResult, 0, len(neighbors))
	for _, neighbor := range neighbors {
		if int(neighbor.ID) >= len(g.docMap) || g.docMap[neighbor.ID] == "" {
			continue
		}
		results = append(results, SearchResult{
			ID: g.docMap[neighbor.ID], Distance: neighbor.Distance, Score: -neighbor.Distance,
			Meta: append(json.RawMessage(nil), g.metas[neighbor.ID]...),
		})
	}
	return results
}

// ListIDs 返回当前存活的外部 ID。
func (g *GenericHNSWCollection) ListIDs() []string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	ids := make([]string, 0, len(g.idMap))
	for _, id := range g.docMap {
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}
