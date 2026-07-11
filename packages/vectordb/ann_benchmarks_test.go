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
)

const (
	annSIFTDefaultBaseCount  = 10000
	annSIFTDefaultQueryCount = 100
	annSIFTTopK              = 10
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
			b.ReportMetric(recall*100, "recall@10_percent")
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				fixture.collection.Search(fixture.queries[i%len(fixture.queries)], annSIFTTopK, efSearch)
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
	for _, efSearch := range []int{32, 64, 100, 200} {
		measurement := annMeasureHNSW(fixture, efSearch)
		speedup := measurement.qps / exact.qps
		t.Logf("HNSW ef=%d：Recall@10=%.2f%%，QPS=%.2f，exact speedup=%.2fx，p50=%v，p95=%v，p99=%v", efSearch, measurement.recall*100, measurement.qps, speedup, measurement.p50, measurement.p95, measurement.p99)
		if efSearch == 200 && measurement.recall < 0.70 {
			t.Errorf("ANN-Benchmarks SIFT Recall@10 %.2f%% 低于 70%% 门槛", measurement.recall*100)
		}
	}
}

func loadANNSIFTFixture(tb testing.TB) *annSIFTFixture {
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
	for i, query := range queries {
		groundTruth[i] = annExactKNN(base, query, annSIFTTopK)
	}

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)
	collection := NewCollectionWithMetric("ann-sift", dim, "l2")
	buildStarted := time.Now()
	for i, vector := range base {
		if err := collection.InsertPoint(Point{ID: strconv.Itoa(i), Vector: vector}); err != nil {
			tb.Fatalf("构建 ANN-Benchmarks SIFT 索引失败，位置 %d：%v", i, err)
		}
	}
	buildDuration := time.Since(buildStarted)
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
	return &annSIFTFixture{
		base:            base,
		queries:         queries,
		groundTruth:     groundTruth,
		collection:      collection,
		buildDuration:   buildDuration,
		heapBytes:       heapBytes,
		buildVectorsSec: float64(len(base)) / buildDuration.Seconds(),
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
		_ = annExactKNN(fixture.base, query, annSIFTTopK)
		latencies[i] = time.Since(queryStarted)
	}
	elapsed := time.Since(started)
	return annMeasurementFromLatencies(latencies, float64(len(fixture.queries))/elapsed.Seconds())
}

func annMeasureHNSW(fixture *annSIFTFixture, efSearch int) annSearchMeasurement {
	latencies := make([]time.Duration, len(fixture.queries))
	started := time.Now()
	for i, query := range fixture.queries {
		queryStarted := time.Now()
		fixture.collection.Search(query, annSIFTTopK, efSearch)
		latencies[i] = time.Since(queryStarted)
	}
	elapsed := time.Since(started)
	measurement := annMeasurementFromLatencies(latencies, float64(len(fixture.queries))/elapsed.Seconds())
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
