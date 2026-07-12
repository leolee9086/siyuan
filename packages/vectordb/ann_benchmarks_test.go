package vectordb

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"testing"
	"time"

	"s-forge.local/vectordb/vamana"
)

const (
	annSIFTDefaultBaseCount  = 10000
	annSIFTDefaultQueryCount = 100
	annSIFTTopK              = 10
	annSIFTReportRepetitions = 10
)

type annSIFTFixture struct {
	base            [][]float32
	queries         [][]float32
	groundTruth     [][]int
	collection      *Collection
	buildDuration   time.Duration
	heapBytes       uint64
	buildVectorsSec float64
}

type annDiskVamanaFixture struct {
	collection      CollectionAPI
	buildDuration   time.Duration
	buildVectorsSec float64
	indexBytes      uint64
	close           func()
}

type annSearchMeasurement struct {
	efSearch int
	recall   float64
	qps      float64
	p50      time.Duration
	p95      time.Duration
	p99      time.Duration
}

type annExactNeighbor struct {
	id       int
	distance float32
}

func BenchmarkANNBenchmarksSIFT(b *testing.B) {
	fixture := loadANNSIFTFixture(b)
	b.ReportMetric(fixture.buildDuration.Seconds(), "build_seconds")
	b.ReportMetric(fixture.buildVectorsSec, "build_vectors/s")
	b.ReportMetric(float64(fixture.heapBytes)/float64(len(fixture.base)), "heap_bytes/vector")

	b.Run("exact", func(b *testing.B) {
		b.ReportAllocs()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = annExactKNN(fixture.base, fixture.queries[i%len(fixture.queries)], annSIFTTopK)
		}
	})

	for _, efSearch := range []int{32, 64, 100, 200} {
		efSearch := efSearch
		recall := annRecall(fixture, efSearch)
		b.Run(fmt.Sprintf("hnsw/ef_%d", efSearch), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(recall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				fixture.collection.Search(fixture.queries[i%len(fixture.queries)], annSIFTTopK, efSearch)
			}
		})
	}

	disk := loadANNDiskVamanaFixture(b, fixture)
	defer disk.close()
	b.Run("disk-vamana/build", func(b *testing.B) {
		b.ReportMetric(disk.buildDuration.Seconds(), "build_seconds")
		b.ReportMetric(disk.buildVectorsSec, "build_vectors/s")
		b.ReportMetric(float64(disk.indexBytes)/float64(len(fixture.base)), "disk_bytes/vector")
	})
	for _, efSearch := range []int{32, 64, 100, 200} {
		recall := annDiskVamanaRecall(fixture, disk.collection, efSearch)
		b.Run(fmt.Sprintf("disk-vamana/ef_%d", efSearch), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(recall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				if _, err := disk.collection.Search(fixture.queries[i%len(fixture.queries)], SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
	diskIndex := disk.collection.(*CollectionHandle).col.(*VamanaCollection).Index
	diskIndex.SetBBQSearchEnabled(false)
	defer diskIndex.SetBBQSearchEnabled(true)
	for _, efSearch := range []int{32, 64} {
		recall := annDiskVamanaRecall(fixture, disk.collection, efSearch)
		b.Run(fmt.Sprintf("disk-vamana/full-precision/ef_%d", efSearch), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(recall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				if _, err := disk.collection.Search(fixture.queries[i%len(fixture.queries)], SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkANNBenchmarksSIFTDiskVamana(b *testing.B) {
	fixture := loadANNSIFTDataFixture(b)
	disk := loadANNDiskVamanaFixture(b, fixture)
	defer disk.close()
	b.ReportMetric(float64(len(fixture.base)), "base_vectors")
	b.ReportMetric(disk.buildDuration.Seconds(), "build_seconds")
	b.ReportMetric(disk.buildVectorsSec, "build_vectors/s")
	b.ReportMetric(float64(disk.indexBytes)/float64(len(fixture.base)), "disk_bytes/vector")

	for _, efSearch := range []int{32, 64, 100, 200} {
		recall := annDiskVamanaRecall(fixture, disk.collection, efSearch)
		b.Run(fmt.Sprintf("bbq/ef_%d", efSearch), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(recall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				if _, err := disk.collection.Search(fixture.queries[i%len(fixture.queries)], SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}

	diskIndex := disk.collection.(*CollectionHandle).col.(*VamanaCollection).Index
	diskIndex.SetResidentGraphEnabled(false)
	recall := annDiskVamanaRecall(fixture, disk.collection, 32)
	b.Run("bbq-mmap/ef_32", func(b *testing.B) {
		b.ReportAllocs()
		b.ResetTimer()
		b.ReportMetric(recall*100, "recall@10_percent")
		for i := 0; i < b.N; i++ {
			if _, err := disk.collection.Search(fixture.queries[i%len(fixture.queries)], SearchOptions{TopK: annSIFTTopK, EfSearch: 32}); err != nil {
				b.Fatal(err)
			}
		}
	})
	diskIndex.SetResidentGraphEnabled(true)
	diskIndex.SetBBQSearchEnabled(false)
	defer diskIndex.SetBBQSearchEnabled(true)
	for _, efSearch := range []int{32, 64} {
		recall := annDiskVamanaRecall(fixture, disk.collection, efSearch)
		b.Run(fmt.Sprintf("full-precision/ef_%d", efSearch), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(recall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				if _, err := disk.collection.Search(fixture.queries[i%len(fixture.queries)], SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func TestANNBenchmarksSIFTReport(t *testing.T) {
	fixture := loadANNSIFTFixture(t)
	t.Logf("ANN-Benchmarks SIFT L2：base=%d，queries=%d，dim=%d，k=%d", len(fixture.base), len(fixture.queries), len(fixture.base[0]), annSIFTTopK)
	t.Logf("构建：%v，%.0f vectors/s，%.1f heap bytes/vector", fixture.buildDuration, fixture.buildVectorsSec, float64(fixture.heapBytes)/float64(len(fixture.base)))

	exact := annMeasureExact(fixture)
	t.Logf("exact：QPS=%.2f，p50=%v，p95=%v，p99=%v", exact.qps, exact.p50, exact.p95, exact.p99)
	for candidateCount, recall := range annBBQBruteForceCandidateRecall(fixture, []int{32, 64, 100, 200}) {
		t.Logf("BBQ 4×1 暴力粗排 top-%d 对 exact top-10 的候选召回：%.2f%%", candidateCount, recall*100)
	}
	for _, efSearch := range []int{32, 64, 100, 200} {
		measurement := annMeasureHNSW(fixture, efSearch)
		speedup := measurement.qps / exact.qps
		t.Logf("HNSW ef=%d：Recall@10=%.2f%%，QPS=%.2f，exact speedup=%.2fx，p50=%v，p95=%v，p99=%v", efSearch, measurement.recall*100, measurement.qps, speedup, measurement.p50, measurement.p95, measurement.p99)
		if efSearch == 200 && measurement.recall < 0.70 {
			t.Errorf("ANN-Benchmarks SIFT Recall@10 %.2f%% 低于 70%% 门槛", measurement.recall*100)
		}
	}

	disk := loadANNDiskVamanaFixture(t, fixture)
	defer disk.close()
	t.Logf("DiskVamana 公开 API 构建：%v，%.0f vectors/s，%.1f disk bytes/vector", disk.buildDuration, disk.buildVectorsSec, float64(disk.indexBytes)/float64(len(fixture.base)))
	for _, efSearch := range []int{32, 64, 100, 200} {
		measurement := annMeasureDiskVamana(fixture, disk.collection, efSearch)
		t.Logf("DiskVamana ef=%d（自适应 BBQ over-search）：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", efSearch, measurement.recall*100, measurement.qps, measurement.p50, measurement.p95, measurement.p99)
	}
}

func loadANNDiskVamanaFixture(tb testing.TB, fixture *annSIFTFixture) *annDiskVamanaFixture {
	tb.Helper()
	path := tb.TempDir()
	db, err := Open(path)
	if err != nil {
		tb.Fatal(err)
	}
	points := make([]Point, len(fixture.base))
	for id, vector := range fixture.base {
		points[id] = Point{ID: strconv.Itoa(id), Vector: vector}
	}
	config := vamana.DefaultDiskBuildConfig()
	config.R = 16
	config.L = 200
	config.MaxBackedges = 16
	config.NumWorkers = 1
	config.BuildSeed = 1
	started := time.Now()
	collection, err := db.CreateCollectionWithOptions("ann-sift-disk", CollectionOptions{
		Engine:          EngineDiskVamana,
		Points:          points,
		DistanceMetric:  "l2",
		DiskBuildConfig: &config,
	})
	if err != nil {
		_ = db.Close()
		tb.Fatal(err)
	}
	duration := time.Since(started)
	indexBytes := annFileSetSize(filepath.Join(path, "ann-sift-disk", "vamana"))
	return &annDiskVamanaFixture{
		collection:      collection,
		buildDuration:   duration,
		buildVectorsSec: float64(len(fixture.base)) / duration.Seconds(),
		indexBytes:      indexBytes,
		close: func() {
			if err := db.Close(); err != nil {
				tb.Errorf("关闭 DiskVamana benchmark 数据库失败：%v", err)
			}
		},
	}
}

func annFileSetSize(basePath string) uint64 {
	var total uint64
	for _, suffix := range []string{".index", ".bbq", ".deleted", VamanaStateFileExt} {
		info, err := os.Stat(basePath + suffix)
		if err == nil {
			total += uint64(info.Size())
		}
	}
	return total
}

func annDiskVamanaRecall(fixture *annSIFTFixture, collection CollectionAPI, efSearch int) float64 {
	hits := 0
	for queryIndex, query := range fixture.queries {
		truth := make(map[string]struct{}, annSIFTTopK)
		for _, id := range fixture.groundTruth[queryIndex] {
			truth[strconv.Itoa(id)] = struct{}{}
		}
		results, err := collection.Search(query, SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch})
		if err != nil {
			return 0
		}
		for _, result := range results {
			if _, ok := truth[result.ID]; ok {
				hits++
			}
		}
	}
	return float64(hits) / float64(len(fixture.queries)*annSIFTTopK)
}

func annMeasureDiskVamana(fixture *annSIFTFixture, collection CollectionAPI, efSearch int) annSearchMeasurement {
	latencies := make([]time.Duration, len(fixture.queries))
	started := time.Now()
	for queryIndex, query := range fixture.queries {
		queryStarted := time.Now()
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			if _, err := collection.Search(query, SearchOptions{TopK: annSIFTTopK, EfSearch: efSearch}); err != nil {
				return annSearchMeasurement{}
			}
		}
		latencies[queryIndex] = time.Since(queryStarted) / annSIFTReportRepetitions
	}
	measurement := annMeasurementFromLatencies(latencies, float64(len(fixture.queries)*annSIFTReportRepetitions)/time.Since(started).Seconds())
	measurement.efSearch = efSearch
	measurement.recall = annDiskVamanaRecall(fixture, collection, efSearch)
	return measurement
}

func annBBQBruteForceCandidateRecall(fixture *annSIFTFixture, candidateCounts []int) map[int]float64 {
	maxCandidates := 0
	for _, candidateCount := range candidateCounts {
		if candidateCount > maxCandidates {
			maxCandidates = candidateCount
		}
	}
	hits := make(map[int]int, len(candidateCounts))
	type candidate struct {
		id       int
		distance float32
	}
	candidates := make([]candidate, len(fixture.base))
	for queryIndex, query := range fixture.queries {
		queryCode, queryCorrection := fixture.collection.Store.QuantizeQuery(query)
		for id := range fixture.base {
			candidates[id] = candidate{id: id, distance: fixture.collection.Store.ComputeBBQDistanceFromQuery(queryCode, queryCorrection, DocID(id))}
		}
		sort.Slice(candidates, func(i, j int) bool { return candidates[i].distance < candidates[j].distance })
		truth := make(map[int]struct{}, annSIFTTopK)
		for _, id := range fixture.groundTruth[queryIndex] {
			truth[id] = struct{}{}
		}
		limit := maxCandidates
		if limit > len(candidates) {
			limit = len(candidates)
		}
		for rank := 0; rank < limit; rank++ {
			if _, ok := truth[candidates[rank].id]; !ok {
				continue
			}
			for _, candidateCount := range candidateCounts {
				if rank < candidateCount {
					hits[candidateCount]++
				}
			}
		}
	}
	recalls := make(map[int]float64, len(candidateCounts))
	denominator := float64(len(fixture.queries) * annSIFTTopK)
	for _, candidateCount := range candidateCounts {
		recalls[candidateCount] = float64(hits[candidateCount]) / denominator
	}
	return recalls
}

func loadANNSIFTFixture(tb testing.TB) *annSIFTFixture {
	fixture := loadANNSIFTDataFixture(tb)
	base := fixture.base
	queries := fixture.queries
	dim := len(base[0])

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)
	collection := NewCollectionWithMetric("ann-sift", dim, "l2")
	if err := collection.Store.TrainBBQCentroid(base); err != nil {
		tb.Fatal(err)
	}
	exactAll := os.Getenv("VECTORDB_ANN_HNSW_EXACT") == "1"
	exactBuild := exactAll || os.Getenv("VECTORDB_ANN_HNSW_EXACT_BUILD") == "1"
	if exactBuild {
		// HNSW 的 Dimension 只参与是否启用 BBQ 的判断；诊断模式保留真实向量维度并强制使用精确距离构图和导航。
		collection.HNSWIdx.Dimension = 0
	}
	buildStarted := time.Now()
	for i, vector := range base {
		if err := collection.InsertPoint(Point{ID: strconv.Itoa(i), Vector: vector}); err != nil {
			tb.Fatalf("构建 ANN-Benchmarks SIFT 索引失败，位置 %d：%v", i, err)
		}
	}
	buildDuration := time.Since(buildStarted)
	if exactBuild && !exactAll {
		collection.HNSWIdx.Dimension = dim
	}
	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)
	heapBytes := uint64(0)
	if after.HeapAlloc > before.HeapAlloc {
		heapBytes = after.HeapAlloc - before.HeapAlloc
	}

	for i := 0; i < len(queries) && i < 10; i++ {
		collection.Search(queries[i], annSIFTTopK, 200)
	}
	fixture.collection = collection
	fixture.buildDuration = buildDuration
	fixture.heapBytes = heapBytes
	fixture.buildVectorsSec = float64(len(base)) / buildDuration.Seconds()
	return fixture
}

func loadANNSIFTDataFixture(tb testing.TB) *annSIFTFixture {
	tb.Helper()
	if os.Getenv("VECTORDB_ANN_BENCH") != "1" {
		tb.Skip("设置 VECTORDB_ANN_BENCH=1 后运行 ANN-Benchmarks SIFT 基准")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		tb.Skip("缺少 SIFT1M 数据集，请下载 sift_base.fvecs 和 sift_query.fvecs 到 test_data/sift")
	}

	baseCount := annBenchmarkEnvInt(tb, "VECTORDB_ANN_BASE_COUNT", annSIFTDefaultBaseCount)
	queryCount := annBenchmarkEnvInt(tb, "VECTORDB_ANN_QUERY_COUNT", annSIFTDefaultQueryCount)
	base, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), baseCount)
	if err != nil {
		tb.Fatal(err)
	}
	queries, queryDim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_query.fvecs"), queryCount)
	if err != nil {
		tb.Fatal(err)
	}
	if len(base) != baseCount || len(queries) != queryCount || queryDim != dim {
		tb.Fatalf("SIFT 数据规模不符合请求：base=%d/%d，queries=%d/%d，dim=%d/%d", len(base), baseCount, len(queries), queryCount, dim, queryDim)
	}

	groundTruth := make([][]int, len(queries))
	if baseCount == 1000000 {
		allGroundTruth, groundTruthK, err := loadIvecs(filepath.Join(dataPath, "sift_groundtruth.ivecs"))
		if err != nil {
			tb.Fatal(err)
		}
		if len(allGroundTruth) < len(queries) || groundTruthK < annSIFTTopK {
			tb.Fatalf("SIFT1M ground truth 不完整：queries=%d/%d，k=%d/%d", len(allGroundTruth), len(queries), groundTruthK, annSIFTTopK)
		}
		for queryIndex := range queries {
			groundTruth[queryIndex] = make([]int, annSIFTTopK)
			for rank := 0; rank < annSIFTTopK; rank++ {
				groundTruth[queryIndex][rank] = int(allGroundTruth[queryIndex][rank])
			}
		}
	} else {
		for i, query := range queries {
			groundTruth[i] = annExactKNN(base, query, annSIFTTopK)
		}
	}
	return &annSIFTFixture{
		base:        base,
		queries:     queries,
		groundTruth: groundTruth,
	}
}

func annBenchmarkEnvInt(tb testing.TB, name string, fallback int) int {
	tb.Helper()
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		tb.Fatalf("%s 必须是正整数，实际为 %q", name, raw)
	}
	return value
}

func annExactKNN(base [][]float32, query []float32, k int) []int {
	best := make([]annExactNeighbor, 0, k)
	for id, vector := range base {
		var distance float32
		for dimension, value := range vector {
			delta := value - query[dimension]
			distance += delta * delta
		}
		position := sort.Search(len(best), func(index int) bool {
			return best[index].distance >= distance
		})
		if position >= k {
			continue
		}
		best = append(best, annExactNeighbor{})
		copy(best[position+1:], best[position:])
		best[position] = annExactNeighbor{id: id, distance: distance}
		if len(best) > k {
			best = best[:k]
		}
	}
	ids := make([]int, len(best))
	for i, neighbor := range best {
		ids[i] = neighbor.id
	}
	return ids
}

func annRecall(fixture *annSIFTFixture, efSearch int) float64 {
	hits := 0
	for queryIndex, query := range fixture.queries {
		truth := make(map[string]struct{}, annSIFTTopK)
		for _, id := range fixture.groundTruth[queryIndex] {
			truth[strconv.Itoa(id)] = struct{}{}
		}
		for _, result := range fixture.collection.Search(query, annSIFTTopK, efSearch) {
			if _, ok := truth[result.ID]; ok {
				hits++
			}
		}
	}
	return float64(hits) / float64(len(fixture.queries)*annSIFTTopK)
}

func annMeasureExact(fixture *annSIFTFixture) annSearchMeasurement {
	latencies := make([]time.Duration, len(fixture.queries))
	started := time.Now()
	for i, query := range fixture.queries {
		queryStarted := time.Now()
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			_ = annExactKNN(fixture.base, query, annSIFTTopK)
		}
		latencies[i] = time.Since(queryStarted) / annSIFTReportRepetitions
	}
	elapsed := time.Since(started)
	operations := len(fixture.queries) * annSIFTReportRepetitions
	return annMeasurementFromLatencies(latencies, float64(operations)/elapsed.Seconds())
}

func annMeasureHNSW(fixture *annSIFTFixture, efSearch int) annSearchMeasurement {
	latencies := make([]time.Duration, len(fixture.queries))
	started := time.Now()
	for i, query := range fixture.queries {
		queryStarted := time.Now()
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			fixture.collection.Search(query, annSIFTTopK, efSearch)
		}
		latencies[i] = time.Since(queryStarted) / annSIFTReportRepetitions
	}
	elapsed := time.Since(started)
	operations := len(fixture.queries) * annSIFTReportRepetitions
	measurement := annMeasurementFromLatencies(latencies, float64(operations)/elapsed.Seconds())
	measurement.efSearch = efSearch
	measurement.recall = annRecall(fixture, efSearch)
	return measurement
}

func annMeasurementFromLatencies(latencies []time.Duration, qps float64) annSearchMeasurement {
	sorted := append([]time.Duration(nil), latencies...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	return annSearchMeasurement{
		qps: qps,
		p50: annDurationPercentile(sorted, 0.50),
		p95: annDurationPercentile(sorted, 0.95),
		p99: annDurationPercentile(sorted, 0.99),
	}
}

func annDurationPercentile(sorted []time.Duration, percentile float64) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	index := int(float64(len(sorted)-1) * percentile)
	return sorted[index]
}
