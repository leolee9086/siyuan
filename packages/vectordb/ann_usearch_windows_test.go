//go:build usearch_bench && windows && cgo

package vectordb

import (
	"context"
	"fmt"
	"math/rand"
	"runtime"
	"testing"
	"time"

	"s-forge.local/vectordb/bbq"
)

func TestANNBenchmarksSIFTUSearchComparison(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTFixture(t)
	disk := loadANNDiskVamanaFixture(t, fixture)
	defer disk.close()
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := competitor.index.close(); err != nil {
			t.Error(err)
		}
	}()

	t.Logf("协议：ANN-Benchmarks SIFT L2，base=%d，queries=%d，dim=%d，k=%d，单线程顺序构建/查询", len(fixture.base), len(fixture.queries), len(fixture.base[0]), annSIFTTopK)
	t.Logf("参数：F32，M=16，efConstruction/expansionAdd=200，USearch=%s，SIMD=%s", annUSearchVersion, competitor.hardware)
	t.Logf("构建 vectordb：%v，%.0f vectors/s，Go heap=%.1f bytes/vector", fixture.buildDuration, fixture.buildVectorsSec, float64(fixture.heapBytes)/float64(len(fixture.base)))
	t.Logf("构建 DiskVamana（公开 API）：%v，%.0f vectors/s，disk=%.1f bytes/vector", disk.buildDuration, disk.buildVectorsSec, float64(disk.indexBytes)/float64(len(fixture.base)))
	t.Logf("构建 USearch：%v，%.0f vectors/s，native memory=%.1f bytes/vector，serialized=%.1f bytes/vector", competitor.duration, competitor.vectorsPerSecond, float64(competitor.memoryBytes)/float64(len(fixture.base)), float64(competitor.serializedBytes)/float64(len(fixture.base)))

	exact := annMeasureExact(fixture)
	t.Logf("exact：QPS=%.2f，p50=%v，p95=%v，p99=%v", exact.qps, exact.p50, exact.p95, exact.p99)
	for _, expansion := range []int{32, 64, 100, 200} {
		ours := annMeasureHNSW(fixture, expansion)
		diskMeasurement := annMeasureDiskVamana(fixture, disk.collection, expansion)
		theirs, err := annMeasureUSearch(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=%d vectordb：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", expansion, ours.recall*100, ours.qps, ours.p50, ours.p95, ours.p99)
		t.Logf("ef=%d DiskVamana（自适应 BBQ over-search）：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", expansion, diskMeasurement.recall*100, diskMeasurement.qps, diskMeasurement.p50, diskMeasurement.p95, diskMeasurement.p99)
		t.Logf("ef=%d USearch：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", expansion, theirs.recall*100, theirs.qps, theirs.p50, theirs.p95, theirs.p99)
		paired, err := annMeasurePairedHNSWUSearch(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=%d 逐查询交错比值：vectordb/USearch QPS=%.4f（vectordb %.2f，USearch %.2f）", expansion, paired.ratio, paired.oursQPS, paired.theirsQPS)
	}
}

func TestANNBenchmarksSIFTPairedUSearchRatio(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTFixture(t)
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := competitor.index.close(); err != nil {
			t.Error(err)
		}
	}()

	t.Logf("构建吞吐比值：vectordb/USearch=%.4f（vectordb %.0f，USearch %.0f vectors/s）", fixture.buildVectorsSec/competitor.vectorsPerSecond, fixture.buildVectorsSec, competitor.vectorsPerSecond)
	for _, expansion := range []int{32, 64, 100, 200} {
		oursRecall := annRecall(fixture, expansion)
		theirsRecall, err := annUSearchRecall(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		paired, err := annMeasurePairedHNSWUSearch(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=%d Recall@10：vectordb %.2f%%，USearch %.2f%%；逐查询交错 QPS 比值 %.4f（%.2f/%.2f）", expansion, oursRecall*100, theirsRecall*100, paired.ratio, paired.oursQPS, paired.theirsQPS)
	}
}

func TestANNBenchmarksBBQLambdaUSearchRatio(t *testing.T) {
	data := loadANNSIFTDataFixture(t)
	competitor, err := buildANNUSearch(data.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = competitor.index.close() }()

	for step := 1; step <= 20; step++ {
		lambda := float32(step) * 0.05
		rand.Seed(1)
		quantizer := bbq.NewScalarQuantizerWithTuning(bbq.EuclideanDistance, lambda, 5)
		fixture := buildANNHNSWFixture(t, data, quantizer)
		t.Logf("lambda=%.2f 构建吞吐比值：vectordb/USearch=%.4f（%.0f/%.0f vectors/s），heap=%.1f bytes/vector", lambda, fixture.buildVectorsSec/competitor.vectorsPerSecond, fixture.buildVectorsSec, competitor.vectorsPerSecond, float64(fixture.heapBytes)/float64(len(fixture.base)))
		for _, expansion := range []int{32, 64, 100, 200} {
			oursRecall := annRecall(fixture, expansion)
			theirsRecall, err := annUSearchRecall(fixture, competitor.index, expansion)
			if err != nil {
				t.Fatal(err)
			}
			paired, err := annMeasurePairedHNSWUSearch(fixture, competitor.index, expansion)
			if err != nil {
				t.Fatal(err)
			}
			t.Logf("lambda=%.2f ef=%d：Recall@10 vectordb %.2f%%，USearch %.2f%%；逐查询交错 QPS 比值 %.4f（%.2f/%.2f）", lambda, expansion, oursRecall*100, theirsRecall*100, paired.ratio, paired.oursQPS, paired.theirsQPS)
		}
		fixture.collection = nil
		runtime.GC()
	}
}

func TestANNBenchmarksDiskVamanaUSearchComparison(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTDataFixture(t)
	disk := loadANNDiskVamanaFixture(t, fixture)
	defer disk.close()
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = competitor.index.close() }()

	t.Logf("协议：ANN-Benchmarks SIFT L2，base=%d，queries=%d，dim=%d，k=%d", len(fixture.base), len(fixture.queries), len(fixture.base[0]), annSIFTTopK)
	t.Logf("构建 DiskVamana：%v，%.0f vectors/s，disk=%.1f bytes/vector", disk.buildDuration, disk.buildVectorsSec, float64(disk.indexBytes)/float64(len(fixture.base)))
	t.Logf("构建 USearch %s：%v，%.0f vectors/s，SIMD=%s", annUSearchVersion, competitor.duration, competitor.vectorsPerSecond, competitor.hardware)
	expansions := []int{32, 64, 100, 200}
	oursRecalls := make(map[int]float64, len(expansions))
	theirsRecalls := make(map[int]float64, len(expansions))
	for _, expansion := range expansions {
		oursRecall := annDiskVamanaRecall(fixture, disk.collection, expansion)
		theirsRecall, err := annUSearchRecall(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		paired, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		oursRecalls[expansion] = oursRecall
		theirsRecalls[expansion] = theirsRecall
		t.Logf("ef=%d Recall@10：DiskVamana %.2f%%，USearch %.2f%%；逐查询交错 QPS：DiskVamana %.2f，USearch %.2f，比值 %.4f", expansion, oursRecall*100, theirsRecall*100, paired.oursQPS, paired.theirsQPS, paired.ratio)
	}
	for _, theirsExpansion := range expansions {
		oursExpansion := 0
		for _, candidate := range expansions {
			if oursRecalls[candidate]+0.001 >= theirsRecalls[theirsExpansion] {
				oursExpansion = candidate
				break
			}
		}
		if oursExpansion == 0 || oursExpansion == theirsExpansion {
			continue
		}
		paired, err := annMeasurePairedDiskUSearchExpansions(fixture, disk.collection, competitor.index, oursExpansion, theirsExpansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("Recall 对齐：DiskVamana ef=%d %.2f%%，USearch ef=%d %.2f%%；逐查询交错 QPS 比值 %.4f（%.2f/%.2f）", oursExpansion, oursRecalls[oursExpansion]*100, theirsExpansion, theirsRecalls[theirsExpansion]*100, paired.ratio, paired.oursQPS, paired.theirsQPS)
	}
}

// TestANNBenchmarksUSearchScaleReport 只构建 USearch，用于在大规模数据上建立可复用的直接目标。
func TestANNBenchmarksUSearchScaleReport(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTDataFixture(t)
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = competitor.index.close() }()

	t.Logf("USearch %s：base=%d，queries=%d，dim=%d，构建=%v，%.0f vectors/s，SIMD=%s，native=%.1f bytes/vector，serialized=%.1f bytes/vector", annUSearchVersion, len(fixture.base), len(fixture.queries), len(fixture.base[0]), competitor.duration, competitor.vectorsPerSecond, competitor.hardware, float64(competitor.memoryBytes)/float64(len(fixture.base)), float64(competitor.serializedBytes)/float64(len(fixture.base)))
	for _, expansion := range []int{32, 64, 100, 200} {
		measurement, err := annMeasureUSearch(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("USearch ef=%d：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", expansion, measurement.recall*100, measurement.qps, measurement.p50, measurement.p95, measurement.p99)
	}
}

func TestANNBenchmarksDiskVamanaCheckpointUSearchRatio(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTDataFixture(t)
	disk := loadANNDiskVamanaFixture(t, fixture)
	defer disk.close()
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = competitor.index.close() }()

	updates := make([]WriteOperation, 100)
	for id := range updates {
		point := Point{ID: fmt.Sprintf("%d", id), Vector: fixture.base[id]}
		updates[id] = WriteOperation{Point: &point}
	}
	if _, err := disk.collection.Write(context.Background(), WriteBatch{Operations: updates}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	expansions := []int{32, 200}
	before := make(map[int]annPairedMeasurement, len(expansions))
	beforeRecall := make(map[int]float64, len(expansions))
	for _, expansion := range expansions {
		measurement, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		before[expansion] = measurement
		beforeRecall[expansion] = annDiskVamanaRecall(fixture, disk.collection, expansion)
	}
	checkpoint, err := disk.collection.Checkpoint(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, expansion := range expansions {
		after, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		afterRecall := annDiskVamanaRecall(fixture, disk.collection, expansion)
		if afterRecall+0.001 < beforeRecall[expansion] {
			t.Fatalf("ef=%d checkpoint 后 Recall@10 从 %.2f%% 降至 %.2f%%", expansion, beforeRecall[expansion]*100, afterRecall*100)
		}
		t.Logf("ef=%d checkpoint=%+v，Recall@10：前 %.2f%%，后 %.2f%%；DiskVamana/USearch QPS：前 %.4f，后 %.4f", expansion, checkpoint, beforeRecall[expansion]*100, afterRecall*100, before[expansion].ratio, after.ratio)
	}
}

func TestANNBenchmarksDiskVamanaStrategyCurveUSearchRatio(t *testing.T) {
	rand.Seed(1)
	fixture := loadANNSIFTDataFixture(t)
	disk := loadANNDiskVamanaFixture(t, fixture)
	defer disk.close()
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = competitor.index.close() }()

	index := disk.collection.(*CollectionHandle).col.(*VamanaCollection).Index
	for _, factor := range []float64{1, 1.5, 2, 3, 5} {
		index.SetBBQOverSearchFactor(factor)
		recall := annDiskVamanaRecall(fixture, disk.collection, 32)
		paired, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, 32)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=32，BBQ 4-bit×1-bit，over-search=%.1f：Recall@10=%.2f%%，DiskVamana/USearch QPS=%.4f", factor, recall*100, paired.ratio)
	}
	index.SetBBQOverSearchFactor(5)
	for _, rerankFactor := range []int{4, 6, 8, 12} {
		index.SetBBQRerankFactor(rerankFactor)
		recall := annDiskVamanaRecall(fixture, disk.collection, 32)
		paired, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, 32)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=32，BBQ over-search=5.0，rerank=%d×topK：Recall@10=%.2f%%，DiskVamana/USearch QPS=%.4f", rerankFactor, recall*100, paired.ratio)
	}
	index.SetBBQRerankFactor(0)
	index.SetBBQRefineNavigation(true)
	for _, factor := range []float64{1.5, 2, 3} {
		index.SetBBQOverSearchFactor(factor)
		recall := annDiskVamanaRecall(fixture, disk.collection, 32)
		paired, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, 32)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=32，BBQ lazy refinement，over-search=%.1f：Recall@10=%.2f%%，DiskVamana/USearch QPS=%.4f", factor, recall*100, paired.ratio)
	}
	index.SetBBQRefineNavigation(false)
	index.SetBBQSearchEnabled(false)
	for _, expansion := range []int{32, 64, 100} {
		recall := annDiskVamanaRecall(fixture, disk.collection, expansion)
		paired, err := annMeasurePairedDiskUSearch(fixture, disk.collection, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=%d，全精度图导航：Recall@10=%.2f%%，DiskVamana/USearch QPS=%.4f", expansion, recall*100, paired.ratio)
	}
}

type annPairedMeasurement struct {
	oursQPS   float64
	theirsQPS float64
	ratio     float64
}

// annMeasurePairedHNSWUSearch 在每次查询内交错测量两个实现，并轮换执行顺序以抵消背景负载与先后顺序偏差。
func annMeasurePairedHNSWUSearch(fixture *annSIFTFixture, index *annUSearchIndex, expansion int) (annPairedMeasurement, error) {
	if err := index.setExpansionSearch(expansion); err != nil {
		return annPairedMeasurement{}, err
	}
	var oursDuration time.Duration
	var theirsDuration time.Duration
	operations := 0
	for queryIndex, query := range fixture.queries {
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			measureOurs := func() {
				started := time.Now()
				fixture.collection.Search(query, annSIFTTopK, expansion)
				oursDuration += time.Since(started)
			}
			measureTheirs := func() error {
				started := time.Now()
				_, err := index.search(query, annSIFTTopK)
				theirsDuration += time.Since(started)
				return err
			}
			if (queryIndex+repetition)&1 == 0 {
				measureOurs()
				if err := measureTheirs(); err != nil {
					return annPairedMeasurement{}, err
				}
			} else {
				if err := measureTheirs(); err != nil {
					return annPairedMeasurement{}, err
				}
				measureOurs()
			}
			operations++
		}
	}
	oursQPS := float64(operations) / oursDuration.Seconds()
	theirsQPS := float64(operations) / theirsDuration.Seconds()
	return annPairedMeasurement{oursQPS: oursQPS, theirsQPS: theirsQPS, ratio: oursQPS / theirsQPS}, nil
}

func annMeasurePairedDiskUSearch(fixture *annSIFTFixture, collection CollectionAPI, index *annUSearchIndex, expansion int) (annPairedMeasurement, error) {
	return annMeasurePairedDiskUSearchExpansions(fixture, collection, index, expansion, expansion)
}

func annMeasurePairedDiskUSearchExpansions(fixture *annSIFTFixture, collection CollectionAPI, index *annUSearchIndex, oursExpansion, theirsExpansion int) (annPairedMeasurement, error) {
	if err := index.setExpansionSearch(theirsExpansion); err != nil {
		return annPairedMeasurement{}, err
	}
	var oursDuration time.Duration
	var theirsDuration time.Duration
	operations := 0
	for queryIndex, query := range fixture.queries {
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			measureOurs := func() error {
				started := time.Now()
				_, err := collection.Search(query, SearchOptions{TopK: annSIFTTopK, EfSearch: oursExpansion})
				oursDuration += time.Since(started)
				return err
			}
			measureTheirs := func() error {
				started := time.Now()
				_, err := index.search(query, annSIFTTopK)
				theirsDuration += time.Since(started)
				return err
			}
			if (queryIndex+repetition)&1 == 0 {
				if err := measureOurs(); err != nil {
					return annPairedMeasurement{}, err
				}
				if err := measureTheirs(); err != nil {
					return annPairedMeasurement{}, err
				}
			} else {
				if err := measureTheirs(); err != nil {
					return annPairedMeasurement{}, err
				}
				if err := measureOurs(); err != nil {
					return annPairedMeasurement{}, err
				}
			}
			operations++
		}
	}
	oursQPS := float64(operations) / oursDuration.Seconds()
	theirsQPS := float64(operations) / theirsDuration.Seconds()
	return annPairedMeasurement{oursQPS: oursQPS, theirsQPS: theirsQPS, ratio: oursQPS / theirsQPS}, nil
}

func BenchmarkANNBenchmarksSIFTUSearchComparison(b *testing.B) {
	rand.Seed(1)
	fixture := loadANNSIFTFixture(b)
	competitor, err := buildANNUSearch(fixture.base)
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { _ = competitor.index.close() })

	for _, expansion := range []int{32, 64, 100, 200} {
		expansion := expansion
		oursRecall := annRecall(fixture, expansion)
		competitorRecall, err := annUSearchRecall(fixture, competitor.index, expansion)
		if err != nil {
			b.Fatal(err)
		}
		b.Run(fmt.Sprintf("vectordb/ef_%d", expansion), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(oursRecall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				fixture.collection.Search(fixture.queries[i%len(fixture.queries)], annSIFTTopK, expansion)
			}
		})
		b.Run(fmt.Sprintf("usearch_v2.22.0/ef_%d", expansion), func(b *testing.B) {
			if err := competitor.index.setExpansionSearch(expansion); err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			b.ResetTimer()
			b.ReportMetric(competitorRecall*100, "recall@10_percent")
			for i := 0; i < b.N; i++ {
				if _, err := competitor.index.search(fixture.queries[i%len(fixture.queries)], annSIFTTopK); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func annMeasureUSearch(fixture *annSIFTFixture, index *annUSearchIndex, expansion int) (annSearchMeasurement, error) {
	if err := index.setExpansionSearch(expansion); err != nil {
		return annSearchMeasurement{}, err
	}
	latencies := make([]time.Duration, len(fixture.queries))
	results := make([][]uint64, len(fixture.queries))
	started := time.Now()
	for queryIndex, query := range fixture.queries {
		queryStarted := time.Now()
		for repetition := 0; repetition < annSIFTReportRepetitions; repetition++ {
			keys, err := index.search(query, annSIFTTopK)
			if err != nil {
				return annSearchMeasurement{}, err
			}
			results[queryIndex] = keys
		}
		latencies[queryIndex] = time.Since(queryStarted) / annSIFTReportRepetitions
	}
	elapsed := time.Since(started)

	hits := 0
	for queryIndex, keys := range results {
		truth := make(map[uint64]struct{}, annSIFTTopK)
		for _, id := range fixture.groundTruth[queryIndex] {
			truth[uint64(id)] = struct{}{}
		}
		for _, key := range keys {
			if _, ok := truth[key]; ok {
				hits++
			}
		}
	}
	operations := len(fixture.queries) * annSIFTReportRepetitions
	measurement := annMeasurementFromLatencies(latencies, float64(operations)/elapsed.Seconds())
	measurement.efSearch = expansion
	measurement.recall = float64(hits) / float64(len(fixture.queries)*annSIFTTopK)
	return measurement, nil
}

func annUSearchRecall(fixture *annSIFTFixture, index *annUSearchIndex, expansion int) (float64, error) {
	measurement, err := annMeasureUSearch(fixture, index, expansion)
	return measurement.recall, err
}
