//go:build usearch_bench && windows && cgo

package vectordb

import (
	"fmt"
	"math/rand"
	"testing"
	"time"
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
		t.Logf("ef=%d DiskVamana（内部 5× over-search）：Recall@10=%.2f%%，QPS=%.2f，p50=%v，p95=%v，p99=%v", expansion, diskMeasurement.recall*100, diskMeasurement.qps, diskMeasurement.p50, diskMeasurement.p95, diskMeasurement.p99)
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
		paired, err := annMeasurePairedHNSWUSearch(fixture, competitor.index, expansion)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("ef=%d 逐查询交错比值：vectordb/USearch QPS=%.4f（vectordb %.2f，USearch %.2f）", expansion, paired.ratio, paired.oursQPS, paired.theirsQPS)
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
			b.ReportMetric(oursRecall*100, "recall@10_percent")
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				fixture.collection.Search(fixture.queries[i%len(fixture.queries)], annSIFTTopK, expansion)
			}
		})
		b.Run(fmt.Sprintf("usearch_v2.22.0/ef_%d", expansion), func(b *testing.B) {
			if err := competitor.index.setExpansionSearch(expansion); err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			b.ReportMetric(competitorRecall*100, "recall@10_percent")
			b.ResetTimer()
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
