// vectordb-sidecar：把 s-forge 的 packages/vectordb 暴露成 stdio 可执行入口，供 Node 侧封装调用。
//
// 设计要点：
//   - 标准输入读请求帧、标准输出写响应帧，标准错误只放日志（stdout 是协议专用，不许混入其它输出）。
//   - 帧格式：[u32 总长][u32 头长][JSON 头][二进制载荷]；向量走载荷（float32 小端、行主序），
//     避免把 768 维向量塞进 JSON 造成的膨胀与解析开销。
//   - 一次只处理一个请求（DB 内部本来就按提交序号串行化）；进度事件在写库期间穿插发出。
package main

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"sync"
	"time"

	vectordb "s-forge.local/vectordb"
	"s-forge.local/vectordb/vamana"
)

const protocolVersion = 1

// ---------- 数据集的协议视图 ----------
//
// 与集合那套同理，而且这里更必要：DatasetStats / DatasetWriteResult / DatasetIndexInfo
// 在内核里没有 JSON tag，直接回给客户端会得到 Go 字段名（Name / EntityCount / CommitSequence）——
// 与本协议其余部分的 camelCase 不一致，客户端只好两套名字都认。视图在这里把名字定死。

func datasetStatsView(stats vectordb.DatasetStats) map[string]any {
	embeddings := make(map[string]any, len(stats.Embeddings))
	for name, schema := range stats.Embeddings {
		embeddings[name] = map[string]any{"dimension": schema.Dimension, "distanceMetric": schema.DistanceMetric}
	}
	indexes := make(map[string]any, len(stats.Indexes))
	for name, view := range stats.Indexes {
		indexes[name] = map[string]any{"embedding": view.Embedding, "engine": string(view.Engine)}
	}
	return map[string]any{
		"name":                  stats.Name,
		"entityCount":           stats.EntityCount,
		"commitSequence":        stats.CommitSequence,
		"metadataWalBytes":      stats.MetadataWALBytes,
		"checkpointRecommended": stats.CheckpointRecommended,
		"indexBuilding":         stats.IndexBuilding,
		"recoveryRequired":      stats.RecoveryRequired,
		"embeddings":            embeddings,
		"indexes":               indexes,
	}
}

func datasetStatsViews(list []vectordb.DatasetStats) []map[string]any {
	views := make([]map[string]any, 0, len(list))
	for _, stats := range list {
		views = append(views, datasetStatsView(stats))
	}
	return views
}

func datasetWriteView(result vectordb.DatasetWriteResult) map[string]any {
	return map[string]any{
		"commitSequence": result.CommitSequence,
		"applied":        result.Applied,
		"committed":      result.Committed,
		"indexHealthy":   result.IndexHealthy,
	}
}

func datasetIndexViews(list []vectordb.DatasetIndexInfo) []map[string]any {
	views := make([]map[string]any, 0, len(list))
	for _, info := range list {
		views = append(views, map[string]any{
			"name":      info.Name,
			"embedding": info.Embedding,
			"engine":    string(info.Engine),
		})
	}
	return views
}

// 载荷里的一个向量块：从载荷第 Offset 字节起，共 Count 行、每行 Dimension 个 float32。
//
// Name 用于**多命名嵌入**（dataset）：一个实体可以有多个嵌入字段，块靠名字对齐而不是靠下标。
// collection 那套不带名字（omitempty），所以加了字段之后旧客户端照常能用。
type vectorBlock struct {
	Offset    int    `json:"offset"`
	Count     int    `json:"count"`
	Dimension int    `json:"dimension"`
	Name      string `json:"name,omitempty"`
}

// 请求与响应共用一个信封；用 omitempty 区分方向。
type envelope struct {
	// 请求
	ID      uint64          `json:"id"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Vectors []vectorBlock   `json:"vectors,omitempty"`

	// 响应
	OK     *bool         `json:"ok,omitempty"`
	Result any           `json:"result,omitempty"`
	Error  *rpcError     `json:"error,omitempty"`
	Out    []vectorBlock `json:"outVectors,omitempty"`

	// 事件（无 id 归属时不带 ID）
	Event *progressEvent `json:"event,omitempty"`
}

type rpcError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type progressEvent struct {
	Kind      string `json:"kind"`
	ID        uint64 `json:"id"`
	Stage     string `json:"stage"`
	Completed int    `json:"completed"`
	Total     int    `json:"total"`
}

type server struct {
	mu       sync.Mutex // 串行化请求处理
	out      *bufio.Writer
	wmu      sync.Mutex // 串行化帧写出（进度事件可能在别的 goroutine 里产生）
	db       *vectordb.Database
	cols     map[string]vectordb.CollectionAPI
	datasets map[string]vectordb.DatasetAPI
}

func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	srv := &server{out: bufio.NewWriterSize(os.Stdout, 1<<20), cols: map[string]vectordb.CollectionAPI{}}
	logf("sidecar 启动，协议版本 %d", protocolVersion)

	for {
		header, payload, err := readFrame(in)
		if err != nil {
			if errors.Is(err, io.EOF) {
				logf("标准输入关闭，退出")
				srv.shutdown()
				return
			}
			logf("读帧失败：%v", err)
			srv.shutdown()
			return
		}
		var req envelope
		if err := json.Unmarshal(header, &req); err != nil {
			logf("头解析失败：%v", err)
			continue
		}
		if req.Method == "shutdown" {
			srv.reply(req.ID, nil, nil)
			srv.shutdown()
			return
		}
		result, outBlocks, outPayload, rerr := srv.dispatch(&req, payload)
		// 统一在出口换成协议视图：协议字段名不能依赖库里结构体的 json tag（它们大多没打 tag）。
		srv.replyVectors(req.ID, normalizeResult(result), outBlocks, outPayload, rerr)
	}
}

// dispatch 处理一个请求；返回结果、输出向量块、输出载荷或错误。
func (s *server) dispatch(req *envelope, payload []byte) (any, []vectorBlock, []byte, *rpcError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch req.Method {
	case "ping":
		return map[string]any{"pong": true, "protocolVersion": protocolVersion}, nil, nil, nil

	case "db.open":
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Path == "" {
			return nil, nil, nil, badRequest("db.open 需要 path")
		}
		if s.db != nil {
			return nil, nil, nil, badRequest("数据库已打开，先 db.close")
		}
		db, err := vectordb.Open(p.Path)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		s.db = db
		s.cols = map[string]vectordb.CollectionAPI{}
		s.datasets = map[string]vectordb.DatasetAPI{}
		s.datasets = map[string]vectordb.DatasetAPI{}
		logf("已打开数据库 %s", p.Path)
		return map[string]any{"path": p.Path, "collections": db.ListCollectionStats()}, nil, nil, nil

	case "db.close":
		if s.db == nil {
			return map[string]any{"closed": false}, nil, nil, nil
		}
		err := s.closeAll()
		s.db = nil
		s.cols = map[string]vectordb.CollectionAPI{}
		s.datasets = map[string]vectordb.DatasetAPI{}
		s.datasets = map[string]vectordb.DatasetAPI{}
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"closed": true}, nil, nil, nil

	case "db.listCollections":
		if s.db == nil {
			return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
		}
		return s.db.ListCollectionStats(), nil, nil, nil

	case "db.createCollection":
		return s.createCollection(req, payload)

	case "db.openCollection":
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("db.openCollection 需要 name")
		}
		col, err := s.collection(p.Name)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return col.Stats(), nil, nil, nil

	case "db.deleteCollection":
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("db.deleteCollection 需要 name")
		}
		if col, ok := s.cols[p.Name]; ok {
			_ = col.Close()
			delete(s.cols, p.Name)
		}
		if s.db == nil {
			return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
		}
		if err := s.db.DeleteCollection(p.Name); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"deleted": p.Name}, nil, nil, nil

	case "collection.write":
		return s.write(req, payload)

	case "collection.upsert":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Collection  string            `json:"collection"`
			VectorIndex int               `json:"vectorIndex"`
			IDs         []string          `json:"ids"`
			Metas       []json.RawMessage `json:"metas"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("collection.upsert 参数解析失败")
		}
		points, rerr := buildPoints(p.VectorIndex, p.IDs, p.Metas, req.Vectors, payload)
		if rerr != nil {
			return nil, nil, nil, rerr
		}
		if err := col.Upsert(points); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"upserted": len(points)}, nil, nil, nil

	case "collection.search":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Collection          string    `json:"collection"`
			VectorIndex         int       `json:"vectorIndex"`
			Query               []float32 `json:"query"`
			TopK                int       `json:"topK"`
			EfSearch            int       `json:"efSearch"`
			ScoreThreshold      float32   `json:"scoreThreshold"`
			ExcludeIDs          []string  `json:"excludeIds"`
			GroupBy             string    `json:"groupBy"`
			MaxPerGroup         int       `json:"maxPerGroup"`
			CandidateMultiplier int       `json:"candidateMultiplier"`
			TimeoutMs           int       `json:"timeoutMs"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("collection.search 参数解析失败")
		}
		query := p.Query
		if len(query) == 0 {
			blocks, err := decodeVectors(req.Vectors, payload)
			if err != nil || len(blocks) == 0 {
				return nil, nil, nil, badRequest("collection.search 需要 query 或一个向量块")
			}
			query = blocks[0]
		}
		ctx, cancel := withTimeout(p.TimeoutMs)
		defer cancel()
		results, err := col.SearchContext(ctx, query, vectordb.SearchOptions{
			TopK:                p.TopK,
			EfSearch:            p.EfSearch,
			ScoreThreshold:      p.ScoreThreshold,
			ExcludeIDs:          p.ExcludeIDs,
			GroupBy:             p.GroupBy,
			MaxPerGroup:         p.MaxPerGroup,
			CandidateMultiplier: p.CandidateMultiplier,
		})
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return results, nil, nil, nil

	case "collection.fetchPoints":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Collection string   `json:"collection"`
			IDs        []string `json:"ids"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("collection.fetchPoints 参数解析失败")
		}
		points, err := col.FetchPoints(p.IDs)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return packPointsAsVectors(points)

	case "collection.delete":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Collection string   `json:"collection"`
			IDs        []string `json:"ids"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("collection.delete 参数解析失败")
		}
		if err := col.Delete(p.IDs); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"deleted": len(p.IDs)}, nil, nil, nil

	case "collection.flush":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		if err := col.Flush(); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"flushed": true}, nil, nil, nil

	case "collection.checkpoint":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			TimeoutMs int `json:"timeoutMs"`
		}
		_ = json.Unmarshal(req.Params, &p)
		ctx, cancel := withTimeout(p.TimeoutMs)
		defer cancel()
		result, err := col.Checkpoint(ctx)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return result, nil, nil, nil

	case "collection.stats":
		col, err := s.collectionFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return col.Stats(), nil, nil, nil

	case "db.createDataset":
		var p struct {
			Name       string `json:"name"`
			Embeddings map[string]struct {
				Dimension      int    `json:"dimension"`
				DistanceMetric string `json:"distanceMetric"`
			} `json:"embeddings"`
			Indexes map[string]struct {
				Embedding string                     `json:"embedding"`
				Engine    vectordb.Engine            `json:"engine"`
				HNSW      *vectordb.CollectionConfig `json:"hnswConfig,omitempty"`
			} `json:"indexes"`
			IDs   []string          `json:"ids"`
			Metas []json.RawMessage `json:"metas"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("db.createDataset 需要 name")
		}
		if s.db == nil {
			return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
		}
		opts := vectordb.DatasetOptions{
			Embeddings: make(map[string]vectordb.EmbeddingSchema, len(p.Embeddings)),
			Indexes:    make(map[string]vectordb.IndexViewOptions, len(p.Indexes)),
		}
		for name, schema := range p.Embeddings {
			opts.Embeddings[name] = vectordb.EmbeddingSchema{Dimension: schema.Dimension, DistanceMetric: schema.DistanceMetric}
		}
		for name, view := range p.Indexes {
			opts.Indexes[name] = vectordb.IndexViewOptions{Embedding: view.Embedding, Engine: view.Engine, HNSWConfig: view.HNSW}
		}
		if len(p.IDs) > 0 {
			entities, rerr := buildEntities(p.IDs, p.Metas, req.Vectors, payload)
			if rerr != nil {
				return nil, nil, nil, rerr
			}
			opts.Entities = entities
		}
		dataset, err := s.db.CreateDataset(p.Name, opts)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		s.datasets[p.Name] = dataset
		return map[string]any{"name": dataset.Name(), "stats": datasetStatsView(dataset.Stats())}, nil, nil, nil

	case "db.openDataset":
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("db.openDataset 需要 name")
		}
		dataset, err := s.dataset(p.Name)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return datasetStatsView(dataset.Stats()), nil, nil, nil

	case "db.listDatasets":
		if s.db == nil {
			return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
		}
		return datasetStatsViews(s.db.ListDatasetStats()), nil, nil, nil

	case "db.deleteDataset":
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("db.deleteDataset 需要 name")
		}
		if dataset, ok := s.datasets[p.Name]; ok {
			_ = dataset.Close()
			delete(s.datasets, p.Name)
		}
		if s.db == nil {
			return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
		}
		if err := s.db.DeleteDataset(p.Name); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"deleted": p.Name}, nil, nil, nil

	case "dataset.stats":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return datasetStatsView(dataset.Stats()), nil, nil, nil

	case "dataset.listIndexes":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return datasetIndexViews(dataset.ListIndexes()), nil, nil, nil

	case "dataset.upsertEntities":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset    string            `json:"dataset"`
			IDs        []string          `json:"ids"`
			Metas      []json.RawMessage `json:"metas"`
			Durability string            `json:"durability"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("dataset.upsertEntities 参数解析失败")
		}
		entities, rerr := buildEntities(p.IDs, p.Metas, req.Vectors, payload)
		if rerr != nil {
			return nil, nil, nil, rerr
		}
		result, err := dataset.UpsertEntities(context.Background(), entities, writeOptions(p.Durability))
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return datasetWriteView(result), nil, nil, nil

	case "dataset.deleteEntities":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset    string   `json:"dataset"`
			IDs        []string `json:"ids"`
			Durability string   `json:"durability"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("dataset.deleteEntities 参数解析失败")
		}
		result, err := dataset.DeleteEntities(context.Background(), p.IDs, writeOptions(p.Durability))
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return datasetWriteView(result), nil, nil, nil

	case "dataset.search":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset        string   `json:"dataset"`
			Index          string   `json:"index"`
			VectorIndex    int      `json:"vectorIndex"`
			TopK           int      `json:"topK"`
			EfSearch       int      `json:"efSearch"`
			ScoreThreshold float32  `json:"scoreThreshold"`
			ExcludeIDs     []string `json:"excludeIds"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("dataset.search 参数解析失败")
		}
		vectors, derr := decodeVectors(req.Vectors, payload)
		if derr != nil {
			return nil, nil, nil, badRequest(derr.Error())
		}
		if p.VectorIndex < 0 || p.VectorIndex >= len(vectors) {
			return nil, nil, nil, badRequest(fmt.Sprintf("向量下标 %d 越界（共 %d 个向量块）", p.VectorIndex, len(vectors)))
		}
		hits, err := dataset.SearchIndex(p.Index, vectors[p.VectorIndex], searchOptions(p.TopK, p.EfSearch, p.ScoreThreshold, p.ExcludeIDs))
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return hits, nil, nil, nil

	case "dataset.fuseSearch":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset      string `json:"dataset"`
			TopK         int    `json:"topK"`
			RRFConstant  int    `json:"rrfConstant"`
			AllowPartial bool   `json:"allowPartial"`
			Queries      []struct {
				Index       string  `json:"index"`
				VectorIndex int     `json:"vectorIndex"`
				Weight      float64 `json:"weight"`
				TopK        int     `json:"topK"`
				EfSearch    int     `json:"efSearch"`
			} `json:"queries"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("dataset.fuseSearch 参数解析失败")
		}
		vectors, derr := decodeVectors(req.Vectors, payload)
		if derr != nil {
			return nil, nil, nil, badRequest(derr.Error())
		}
		queries := make([]vectordb.FusionQuery, 0, len(p.Queries))
		for i, q := range p.Queries {
			if q.VectorIndex < 0 || q.VectorIndex >= len(vectors) {
				return nil, nil, nil, badRequest(fmt.Sprintf("第 %d 路的向量下标 %d 越界（共 %d 个向量块）", i, q.VectorIndex, len(vectors)))
			}
			queries = append(queries, vectordb.FusionQuery{
				Index:   q.Index,
				Vector:  vectors[q.VectorIndex],
				Weight:  q.Weight,
				Options: searchOptions(q.TopK, q.EfSearch, 0, nil),
			})
		}
		response, err := dataset.SearchFusion(context.Background(), vectordb.FusionSearchRequest{
			Queries: queries, TopK: p.TopK, RRFConstant: p.RRFConstant, AllowPartial: p.AllowPartial,
		})
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return response, nil, nil, nil

	case "dataset.fetchEntities":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset string   `json:"dataset"`
			IDs     []string `json:"ids"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, nil, nil, badRequest("dataset.fetchEntities 参数解析失败")
		}
		entities, err := dataset.FetchEntities(p.IDs)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		return packEntitiesAsVectors(entities)

	case "dataset.addIndex":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset string `json:"dataset"`
			Name    string `json:"name"`
			Options struct {
				Embedding string                     `json:"embedding"`
				Engine    vectordb.Engine            `json:"engine"`
				HNSW      *vectordb.CollectionConfig `json:"hnswConfig,omitempty"`
			} `json:"options"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("dataset.addIndex 需要 name")
		}
		if err := dataset.AddIndexContext(context.Background(), p.Name, vectordb.IndexViewOptions{
			Embedding: p.Options.Embedding, Engine: p.Options.Engine, HNSWConfig: p.Options.HNSW,
		}); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"added": p.Name}, nil, nil, nil

	case "dataset.dropIndex":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		var p struct {
			Dataset string `json:"dataset"`
			Name    string `json:"name"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			return nil, nil, nil, badRequest("dataset.dropIndex 需要 name")
		}
		if err := dataset.DropIndex(p.Name); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"dropped": p.Name}, nil, nil, nil

	case "dataset.checkpoint":
		dataset, err := s.datasetFrom(req.Params)
		if err != nil {
			return nil, nil, nil, mapError(err)
		}
		if err := dataset.Checkpoint(context.Background()); err != nil {
			return nil, nil, nil, mapError(err)
		}
		return map[string]any{"checkpointed": true}, nil, nil, nil

	default:
		return nil, nil, nil, &rpcError{Code: "unknown_method", Message: fmt.Sprintf("未知方法 %q", req.Method)}
	}
}

// createCollection 建集合。DiskVamana 必须带初始点集（引擎会用它构建磁盘图），
// 所以这里要求 initialPoints（向量块）与 initialIds 同时给出。
func (s *server) createCollection(req *envelope, payload []byte) (any, []vectorBlock, []byte, *rpcError) {
	if s.db == nil {
		return nil, nil, nil, mapError(vectordb.ErrDatabaseClosed)
	}
	var p struct {
		Name               string                   `json:"name"`
		Engine             string                   `json:"engine"`
		Dimension          int                      `json:"dimension"`
		DistanceMetric     string                   `json:"distanceMetric"`
		WALCheckpointBytes int64                    `json:"walCheckpointBytes"`
		Meta               *vectordb.CollectionMeta `json:"meta"`
		DiskBuildConfig    *diskBuildParams         `json:"diskBuildConfig"`
		InitialIDs         []string                 `json:"initialIds"`
		InitialMetas       []json.RawMessage        `json:"initialMetas"`
		VectorIndex        int                      `json:"vectorIndex"`
	}
	if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
		return nil, nil, nil, badRequest("db.createCollection 需要 name")
	}
	if p.Engine == "" {
		p.Engine = string(vectordb.EngineDiskVamana)
	}
	opts := vectordb.CollectionOptions{
		Engine:             vectordb.Engine(p.Engine),
		Dimension:          p.Dimension,
		DistanceMetric:     p.DistanceMetric,
		WALCheckpointBytes: p.WALCheckpointBytes,
	}
	if p.Meta != nil {
		opts.Meta = *p.Meta
	}
	if p.DiskBuildConfig != nil {
		opts.DiskBuildConfig = p.DiskBuildConfig.toGo()
	}
	if len(p.InitialIDs) > 0 {
		points, rerr := buildPoints(p.VectorIndex, p.InitialIDs, p.InitialMetas, req.Vectors, payload)
		if rerr != nil {
			return nil, nil, nil, rerr
		}
		opts.Points = points
	}
	col, err := s.db.CreateCollectionWithOptions(p.Name, opts)
	if err != nil {
		return nil, nil, nil, mapError(err)
	}
	s.cols[p.Name] = col
	logf("已建集合 %s（引擎 %s，维度 %d，初始点 %d）", p.Name, p.Engine, p.Dimension, len(opts.Points))
	return col.Stats(), nil, nil, nil
}

// write 走带持久性级别与进度事件的批次写入契约。
func (s *server) write(req *envelope, payload []byte) (any, []vectorBlock, []byte, *rpcError) {
	col, err := s.collectionFrom(req.Params)
	if err != nil {
		return nil, nil, nil, mapError(err)
	}
	var p struct {
		Collection string `json:"collection"`
		Durability string `json:"durability"`
		TimeoutMs  int    `json:"timeoutMs"`
		Operations []struct {
			ID          string          `json:"id"`
			DeleteID    string          `json:"deleteId"`
			VectorIndex int             `json:"vectorIndex"`
			Meta        json.RawMessage `json:"meta"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(req.Params, &p); err != nil {
		return nil, nil, nil, badRequest("collection.write 参数解析失败")
	}
	vectors, err := decodeVectors(req.Vectors, payload)
	if err != nil {
		return nil, nil, nil, badRequest(err.Error())
	}
	operations := make([]vectordb.WriteOperation, 0, len(p.Operations))
	for _, op := range p.Operations {
		if op.DeleteID != "" {
			operations = append(operations, vectordb.WriteOperation{DeleteID: op.DeleteID})
			continue
		}
		if op.ID == "" {
			return nil, nil, nil, badRequest("写操作缺少 id")
		}
		if op.VectorIndex < 0 || op.VectorIndex >= len(vectors) {
			return nil, nil, nil, badRequest(fmt.Sprintf("向量下标 %d 越界（共 %d 个向量块）", op.VectorIndex, len(vectors)))
		}
		point := &vectordb.Point{ID: op.ID, Vector: vectors[op.VectorIndex]}
		if len(op.Meta) > 0 && string(op.Meta) != "null" {
			point.Meta = op.Meta
		}
		operations = append(operations, vectordb.WriteOperation{Point: point})
	}
	durability := vectordb.DurabilitySync
	switch p.Durability {
	case "", "sync":
		durability = vectordb.DurabilitySync
	case "memory":
		durability = vectordb.DurabilityMemory
	case "async":
		durability = vectordb.DurabilityAsync
	default:
		return nil, nil, nil, badRequest(fmt.Sprintf("未知持久性级别 %q", p.Durability))
	}
	ctx, cancel := withTimeout(p.TimeoutMs)
	defer cancel()
	requestID := req.ID
	result, err := col.Write(ctx, vectordb.WriteBatch{Operations: operations}, vectordb.WriteOptions{
		Durability: durability,
		OnProgress: func(progress vectordb.WriteProgress) {
			evt := &envelope{Event: &progressEvent{
				Kind: "writeProgress", ID: requestID,
				Stage: progress.Stage, Completed: progress.Completed, Total: progress.Total,
			}}
			if err := s.writeEnvelope(evt, nil); err != nil {
				logf("发进度事件失败：%v", err)
			}
		},
	})
	if err != nil {
		return nil, nil, nil, mapError(err)
	}
	return result, nil, nil, nil
}

// writeOptions 把协议里的 durability 字符串翻成库里的写选项。
func writeOptions(durability string) vectordb.WriteOptions {
	switch durability {
	case "memory":
		return vectordb.WriteOptions{Durability: vectordb.DurabilityMemory}
	case "async":
		return vectordb.WriteOptions{Durability: vectordb.DurabilityAsync}
	default:
		return vectordb.WriteOptions{Durability: vectordb.DurabilitySync}
	}
}

// searchOptions 把协议参数翻成库里的检索选项。零值一律不传（库按自己的默认走）。
func searchOptions(topK, efSearch int, scoreThreshold float32, excludeIDs []string) vectordb.SearchOptions {
	options := vectordb.SearchOptions{}
	if topK > 0 {
		options.TopK = topK
	}
	if efSearch > 0 {
		options.EfSearch = efSearch
	}
	if scoreThreshold != 0 {
		options.ScoreThreshold = scoreThreshold
	}
	if len(excludeIDs) > 0 {
		options.ExcludeIDs = excludeIDs
	}
	return options
}

// datasetFrom 从参数里取数据集名并取出句柄（必要时打开）。
func (s *server) datasetFrom(params json.RawMessage) (vectordb.DatasetAPI, error) {
	var p struct {
		Dataset string `json:"dataset"`
	}
	if err := json.Unmarshal(params, &p); err != nil || p.Dataset == "" {
		return nil, errors.New("缺少 dataset 名")
	}
	return s.dataset(p.Dataset)
}

func (s *server) dataset(name string) (vectordb.DatasetAPI, error) {
	if s.db == nil {
		return nil, vectordb.ErrDatabaseClosed
	}
	if dataset, ok := s.datasets[name]; ok {
		return dataset, nil
	}
	dataset, err := s.db.OpenDataset(name)
	if err != nil {
		return nil, err
	}
	s.datasets[name] = dataset
	return dataset, nil
}

// collectionFrom 从参数里取集合名并取出句柄（必要时打开）。
func (s *server) collectionFrom(params json.RawMessage) (vectordb.CollectionAPI, error) {
	var p struct {
		Collection string `json:"collection"`
	}
	if err := json.Unmarshal(params, &p); err != nil || p.Collection == "" {
		return nil, errors.New("缺少 collection 名")
	}
	return s.collection(p.Collection)
}

func (s *server) collection(name string) (vectordb.CollectionAPI, error) {
	if s.db == nil {
		return nil, vectordb.ErrDatabaseClosed
	}
	if col, ok := s.cols[name]; ok {
		return col, nil
	}
	col, err := s.db.OpenCollection(name)
	if err != nil {
		return nil, err
	}
	s.cols[name] = col
	return col, nil
}

func (s *server) closeAll() error {
	var firstErr error
	for name, col := range s.cols {
		if err := col.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("关闭集合 %s 失败：%w", name, err)
		}
	}
	for name, dataset := range s.datasets {
		if err := dataset.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("关闭数据集 %s 失败：%w", name, err)
		}
	}
	if s.db != nil {
		if err := s.db.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (s *server) shutdown() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.closeAll(); err != nil {
		logf("关闭失败：%v", err)
	}
	s.db = nil
	s.cols = map[string]vectordb.CollectionAPI{}
	s.datasets = map[string]vectordb.DatasetAPI{}
}

// ---------- 帧读写 ----------

func readFrame(r *bufio.Reader) ([]byte, []byte, error) {
	var length [4]byte
	if _, err := io.ReadFull(r, length[:]); err != nil {
		return nil, nil, err
	}
	total := binary.LittleEndian.Uint32(length[:])
	if total < 4 {
		return nil, nil, fmt.Errorf("帧长度非法：%d", total)
	}
	body := make([]byte, total)
	if _, err := io.ReadFull(r, body); err != nil {
		return nil, nil, err
	}
	headerLen := binary.LittleEndian.Uint32(body[:4])
	if int(headerLen) > len(body)-4 {
		return nil, nil, fmt.Errorf("头长度非法：%d", headerLen)
	}
	return body[4 : 4+headerLen], body[4+headerLen:], nil
}

func (s *server) writeEnvelope(env *envelope, payload []byte) error {
	header, err := json.Marshal(env)
	if err != nil {
		return err
	}
	var head [8]byte
	binary.LittleEndian.PutUint32(head[0:4], uint32(4+len(header)+len(payload)))
	binary.LittleEndian.PutUint32(head[4:8], uint32(len(header)))
	s.wmu.Lock()
	defer s.wmu.Unlock()
	if _, err := s.out.Write(head[:]); err != nil {
		return err
	}
	if _, err := s.out.Write(header); err != nil {
		return err
	}
	if len(payload) > 0 {
		if _, err := s.out.Write(payload); err != nil {
			return err
		}
	}
	return s.out.Flush()
}

func (s *server) reply(id uint64, result any, rerr *rpcError) {
	ok := rerr == nil
	if err := s.writeEnvelope(&envelope{ID: id, OK: &ok, Result: result, Error: rerr}, nil); err != nil {
		logf("回复失败：%v", err)
	}
}

func (s *server) replyVectors(id uint64, result any, blocks []vectorBlock, payload []byte, rerr *rpcError) {
	ok := rerr == nil
	env := &envelope{ID: id, OK: &ok, Error: rerr, Out: blocks}
	if rerr == nil {
		env.Result = result
	}
	if err := s.writeEnvelope(env, payload); err != nil {
		logf("回复失败：%v", err)
	}
}

// ---------- 载荷与参数工具 ----------

// decodeVectors 把载荷按块切成一维 float32 切片（小端）。
func decodeVectors(blocks []vectorBlock, payload []byte) ([][]float32, error) {
	out := make([][]float32, 0, len(blocks))
	for index, block := range blocks {
		if block.Count <= 0 || block.Dimension <= 0 {
			return nil, fmt.Errorf("第 %d 个向量块参数非法：count=%d dim=%d", index, block.Count, block.Dimension)
		}
		need := block.Count * block.Dimension * 4
		if block.Offset < 0 || block.Offset+need > len(payload) {
			return nil, fmt.Errorf("第 %d 个向量块越界：需要 %d 字节，载荷只有 %d 字节", index, need, len(payload))
		}
		raw := payload[block.Offset : block.Offset+need]
		values := make([]float32, block.Count*block.Dimension)
		for i := range values {
			values[i] = math.Float32frombits(binary.LittleEndian.Uint32(raw[i*4:]))
		}
		out = append(out, values)
	}
	return out, nil
}

// buildPoints 按 id/meta 列表与一个向量块拼出 Point 列表（一个块内含 count 行）。
// metas 是原样的 JSON 值（不是 JSON 文本）：两侧都按"JSON 值透传"处理，避免转义与解析分歧。
func buildPoints(vectorIndex int, ids []string, metas []json.RawMessage, blocks []vectorBlock, payload []byte) ([]vectordb.Point, *rpcError) {
	vectors, err := decodeVectors(blocks, payload)
	if err != nil {
		return nil, badRequest(err.Error())
	}
	if len(ids) == 0 {
		return nil, badRequest("缺少 ids")
	}
	if vectorIndex < 0 || vectorIndex >= len(vectors) {
		return nil, badRequest(fmt.Sprintf("向量下标 %d 越界（共 %d 个向量块）", vectorIndex, len(vectors)))
	}
	flat := vectors[vectorIndex]
	if len(ids) > 1 && len(blocks) > vectorIndex {
		block := blocks[vectorIndex]
		if block.Count != len(ids) {
			return nil, badRequest(fmt.Sprintf("向量块有 %d 行，ids 有 %d 个，数量必须一致", block.Count, len(ids)))
		}
	}
	dimension := 0
	if len(ids) > 0 {
		dimension = len(flat) / len(ids)
	}
	if dimension <= 0 {
		return nil, badRequest("向量块为空")
	}
	points := make([]vectordb.Point, 0, len(ids))
	for i, id := range ids {
		point := vectordb.Point{ID: id, Vector: flat[i*dimension : (i+1)*dimension]}
		if i < len(metas) && len(metas[i]) > 0 && string(metas[i]) != "null" {
			point.Meta = metas[i]
		}
		points = append(points, point)
	}
	return points, nil
}

// packPointsAsVectors 把点集拆成"向量走载荷、元数据走 JSON"的响应。
func packPointsAsVectors(points []vectordb.Point) (any, []vectorBlock, []byte, *rpcError) {
	type pointView struct {
		ID   string          `json:"id"`
		Meta json.RawMessage `json:"meta,omitempty"`
	}
	views := make([]pointView, 0, len(points))
	var payload []byte
	for _, point := range points {
		views = append(views, pointView{ID: point.ID, Meta: point.Meta})
		for _, value := range point.Vector {
			var raw [4]byte
			binary.LittleEndian.PutUint32(raw[:], math.Float32bits(value))
			payload = append(payload, raw[:]...)
		}
	}
	dimension := 0
	if len(points) > 0 {
		dimension = len(points[0].Vector)
	}
	blocks := []vectorBlock{{Offset: 0, Count: len(points), Dimension: dimension}}
	return map[string]any{"points": views}, blocks, payload, nil
}

// decodeNamedVectors 按**块名**切载荷，返回"名字 → 一维 float32"。
//
// 与 decodeVectors 的区别只在寻址方式：那边的下标是位置约定（collection 只有一个向量字段），
// 这边的名字是**嵌入字段名**（dataset 的实体可以有多个）。同一个载荷里两种块不会混用。
func decodeNamedVectors(blocks []vectorBlock, payload []byte) (map[string][]float32, error) {
	out := make(map[string][]float32, len(blocks))
	for index, block := range blocks {
		if block.Name == "" {
			return nil, fmt.Errorf("第 %d 个向量块没有名字（多命名嵌入必须逐块标注字段名）", index)
		}
		if _, exists := out[block.Name]; exists {
			return nil, fmt.Errorf("向量块名重复：%q", block.Name)
		}
		values, err := decodeVectors([]vectorBlock{block}, payload)
		if err != nil {
			return nil, err
		}
		out[block.Name] = values[0]
	}
	return out, nil
}

// buildEntities 按 id/meta 与若干命名向量块拼出 Entity 列表。
//
// embeddings 是这次要写的字段名（顺序无关，靠名字与块对齐）；每个字段的块里应当有 len(ids) 行 ——
// 行数与 id 数不一致时按行数少的那边报错，而不是静默错位：错位会写出语义张冠李戴的向量。
func buildEntities(ids []string, metas []json.RawMessage, blocks []vectorBlock, payload []byte) ([]vectordb.Entity, *rpcError) {
	if len(ids) == 0 {
		return nil, badRequest("缺少 ids")
	}
	named, err := decodeNamedVectors(blocks, payload)
	if err != nil {
		return nil, badRequest(err.Error())
	}
	if len(named) == 0 {
		return nil, badRequest("至少要给一个嵌入字段的向量块")
	}
	// 每个字段的维度要能被行数整除，且行数必须等于 id 数。
	for name, flat := range named {
		if len(flat)%len(ids) != 0 {
			return nil, badRequest(fmt.Sprintf("字段 %q 的向量长度 %d 不能被 id 数 %d 整除", name, len(flat), len(ids)))
		}
		if len(flat)/len(ids)*len(ids) != len(flat) || len(flat)/len(ids) == 0 {
			return nil, badRequest(fmt.Sprintf("字段 %q 的向量是空的", name))
		}
	}
	entities := make([]vectordb.Entity, 0, len(ids))
	for i, id := range ids {
		entity := vectordb.Entity{ID: id, Embeddings: make(map[string][]float32, len(named))}
		for name, flat := range named {
			dimension := len(flat) / len(ids)
			entity.Embeddings[name] = flat[i*dimension : (i+1)*dimension]
		}
		if i < len(metas) && len(metas[i]) > 0 && string(metas[i]) != "null" {
			entity.Meta = metas[i]
		}
		entities = append(entities, entity)
	}
	return entities, nil
}

// packEntitiesAsVectors 把一个实体集拆成"每个嵌入字段一块"的响应。
//
// 块的顺序按字段名排序定死：map 遍历顺序在 Go 里是随机的，不排的话同一个库两次取回
// 载荷布局会不一样 —— 客户端按名字找块本来不怕，但可复现的帧更好对账。
func packEntitiesAsVectors(entities []vectordb.Entity) (any, []vectorBlock, []byte, *rpcError) {
	type entityView struct {
		ID         string          `json:"id"`
		Embeddings []string        `json:"embeddings"`
		Meta       json.RawMessage `json:"meta,omitempty"`
	}
	names := make([]string, 0)
	seen := make(map[string]struct{})
	for _, entity := range entities {
		for name := range entity.Embeddings {
			if _, exists := seen[name]; exists {
				continue
			}
			seen[name] = struct{}{}
			names = append(names, name)
		}
	}
	sort.Strings(names)

	views := make([]entityView, 0, len(entities))
	var payload []byte
	blocks := make([]vectorBlock, 0, len(names))
	for _, name := range names {
		offset := len(payload)
		rows := 0
		dimension := 0
		for _, entity := range entities {
			values := entity.Embeddings[name]
			if values == nil {
				continue
			}
			if dimension == 0 {
				dimension = len(values)
			}
			for _, value := range values {
				var raw [4]byte
				binary.LittleEndian.PutUint32(raw[:], math.Float32bits(value))
				payload = append(payload, raw[:]...)
			}
			rows++
		}
		blocks = append(blocks, vectorBlock{Offset: offset, Count: rows, Dimension: dimension, Name: name})
	}
	for _, entity := range entities {
		names := make([]string, 0, len(entity.Embeddings))
		for name := range entity.Embeddings {
			names = append(names, name)
		}
		sort.Strings(names)
		views = append(views, entityView{ID: entity.ID, Embeddings: names, Meta: entity.Meta})
	}
	return map[string]any{"entities": views}, blocks, payload, nil
}

// ---------- 协议视图：响应字段名在这里定死，不随库里的结构体形状变化 ----------

func statsView(stats vectordb.CollectionStats) map[string]any {
	return map[string]any{
		"name":                  stats.Name,
		"engine":                string(stats.Engine),
		"dimension":             stats.Dimension,
		"count":                 stats.Count,
		"totalCount":            stats.TotalCount,
		"deletedCount":          stats.DeletedCount,
		"pendingCount":          stats.PendingCount,
		"walBytes":              stats.WALBytes,
		"checkpointRecommended": stats.CheckpointRecommended,
		"activeGeneration":      stats.ActiveGeneration,
		"maintenanceError":      stats.MaintenanceError,
	}
}

func statsListView(list []vectordb.CollectionStats) []map[string]any {
	out := make([]map[string]any, 0, len(list))
	for _, stats := range list {
		out = append(out, statsView(stats))
	}
	return out
}

func writeResultView(result vectordb.WriteResult) map[string]any {
	return map[string]any{
		"commitSequence": result.CommitSequence,
		"applied":        result.Applied,
		"durability":     string(result.Durability),
		"committed":      result.Committed,
		"indexHealthy":   result.IndexHealthy,
	}
}

func checkpointView(result vectordb.CheckpointResult) map[string]any {
	return map[string]any{
		"engine":          string(result.Engine),
		"commitSequence":  result.CommitSequence,
		"originalPoints":  result.OriginalPoints,
		"remainingPoints": result.RemainingPoints,
		"reclaimedPoints": result.ReclaimedPoints,
		"walBytesBefore":  result.WALBytesBefore,
		"cleanupPending":  result.CleanupPending,
	}
}

func searchResultsView(results []vectordb.SearchResult) []map[string]any {
	out := make([]map[string]any, 0, len(results))
	for _, item := range results {
		row := map[string]any{"id": item.ID, "score": item.Score, "distance": item.Distance}
		if len(item.Meta) > 0 {
			row["meta"] = json.RawMessage(item.Meta)
		}
		out = append(out, row)
	}
	return out
}

// normalizeResult 把库里返回的结构体换算成协议视图；未列出的类型原样透传。
func normalizeResult(result any) any {
	switch value := result.(type) {
	case vectordb.CollectionStats:
		return statsView(value)
	case []vectordb.CollectionStats:
		return statsListView(value)
	case vectordb.WriteResult:
		return writeResultView(value)
	case vectordb.CheckpointResult:
		return checkpointView(value)
	case []vectordb.SearchResult:
		return searchResultsView(value)
	default:
		return result
	}
}

type diskBuildParams struct {
	NumWorkers      int   `json:"numWorkers"`
	ChunkSize       int   `json:"chunkSize"`
	BlockSize       int   `json:"blockSize"`
	WriteBufferSize int   `json:"writeBufferSize"`
	EnableBBQ       *bool `json:"enableBBQ"`
}

func (p *diskBuildParams) toGo() *vamana.DiskBuildConfig {
	cfg := &vamana.DiskBuildConfig{}
	if p.NumWorkers > 0 {
		cfg.NumWorkers = p.NumWorkers
	}
	if p.ChunkSize > 0 {
		cfg.ChunkSize = p.ChunkSize
	}
	if p.BlockSize > 0 {
		cfg.BlockSize = p.BlockSize
	}
	if p.WriteBufferSize > 0 {
		cfg.WriteBufferSize = p.WriteBufferSize
	}
	if p.EnableBBQ != nil {
		cfg.EnableBBQ = *p.EnableBBQ
	}
	return cfg
}

func withTimeout(ms int) (context.Context, context.CancelFunc) {
	if ms <= 0 {
		return context.WithCancel(context.Background())
	}
	return context.WithTimeout(context.Background(), time.Duration(ms)*time.Millisecond)
}

func badRequest(message string) *rpcError {
	return &rpcError{Code: "invalid_argument", Message: message}
}

// mapError 把库里的哨兵错误映射成稳定的错误码，供 JS 侧判别与重试。
func mapError(err error) *rpcError {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, vectordb.ErrCollectionNotFound):
		return &rpcError{Code: "collection_not_found", Message: err.Error()}
	case errors.Is(err, vectordb.ErrDatabaseLocked):
		return &rpcError{Code: "database_locked", Message: err.Error()}
	case errors.Is(err, vectordb.ErrDatabaseClosed):
		return &rpcError{Code: "database_closed", Message: err.Error()}
	case errors.Is(err, vectordb.ErrCollectionClosed):
		return &rpcError{Code: "collection_closed", Message: err.Error()}
	case errors.Is(err, vectordb.ErrCollectionBusy):
		return &rpcError{Code: "collection_busy", Message: err.Error()}
	case errors.Is(err, vectordb.ErrCollectionReadOnly):
		return &rpcError{Code: "read_only", Message: err.Error()}
	case errors.Is(err, vectordb.ErrIndexRecoveryRequired):
		return &rpcError{Code: "recovery_required", Message: err.Error()}
	case errors.Is(err, vectordb.ErrFormatIncompatible):
		return &rpcError{Code: "format_incompatible", Message: err.Error()}
	case errors.Is(err, vectordb.ErrStorageCorrupted):
		return &rpcError{Code: "storage_corrupted", Message: err.Error()}
	case errors.Is(err, vectordb.ErrPersistenceFailed):
		return &rpcError{Code: "persistence_failed", Message: err.Error()}
	case errors.Is(err, vectordb.ErrUnsupportedEngine):
		return &rpcError{Code: "unsupported_engine", Message: err.Error()}
	case errors.Is(err, vectordb.ErrDiskVamanaNeedsPoints):
		return &rpcError{Code: "needs_initial_points", Message: err.Error()}
	case errors.Is(err, vectordb.ErrVectorDimensionInvalid):
		return &rpcError{Code: "dimension_invalid", Message: err.Error()}
	case errors.Is(err, vectordb.ErrPointIDInvalid):
		return &rpcError{Code: "point_id_invalid", Message: err.Error()}
	case errors.Is(err, vectordb.ErrCollectionCapacity):
		return &rpcError{Code: "capacity_exceeded", Message: err.Error()}
	case errors.Is(err, vectordb.ErrVectorValueInvalid):
		return &rpcError{Code: "vector_value_invalid", Message: err.Error()}
	case errors.Is(err, vectordb.ErrMetricUnsupported):
		return &rpcError{Code: "metric_unsupported", Message: err.Error()}
	case errors.Is(err, context.Canceled):
		return &rpcError{Code: "cancelled", Message: err.Error()}
	case errors.Is(err, context.DeadlineExceeded):
		return &rpcError{Code: "timeout", Message: err.Error()}
	default:
		return &rpcError{Code: "internal", Message: err.Error()}
	}
}

func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[vectordb-sidecar] %s "+format+"\n", append([]any{time.Now().Format("15:04:05.000")}, args...)...)
}
