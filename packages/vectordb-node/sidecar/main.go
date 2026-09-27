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
	"sync"
	"time"

	vectordb "s-forge.local/vectordb"
	"s-forge.local/vectordb/vamana"
)

const protocolVersion = 1

// 载荷里的一个向量块：从载荷第 Offset 字节起，共 Count 行、每行 Dimension 个 float32。
type vectorBlock struct {
	Offset    int `json:"offset"`
	Count     int `json:"count"`
	Dimension int `json:"dimension"`
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
	mu   sync.Mutex // 串行化请求处理
	out  *bufio.Writer
	wmu  sync.Mutex // 串行化帧写出（进度事件可能在别的 goroutine 里产生）
	db   *vectordb.Database
	cols map[string]vectordb.CollectionAPI
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
		logf("已打开数据库 %s", p.Path)
		return map[string]any{"path": p.Path, "collections": db.ListCollectionStats()}, nil, nil, nil

	case "db.close":
		if s.db == nil {
			return map[string]any{"closed": false}, nil, nil, nil
		}
		err := s.closeAll()
		s.db = nil
		s.cols = map[string]vectordb.CollectionAPI{}
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
