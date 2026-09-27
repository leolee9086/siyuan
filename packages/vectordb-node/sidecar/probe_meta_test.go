// probe_meta_test.go — 最小复现：直接用库（不经 sidecar/封装）验证 per-point Meta 的可见性。
//
// 运行：go test -run TestProbeMetaVisibility -v .
// 用途：把"meta 取不到"这件事定位到库或封装。若这里也取不到，说明 DiskVamana 的写入路径不落 Meta。
package main

import (
	"context"
	"encoding/json"
	"testing"

	vectordb "s-forge.local/vectordb"
)

func TestProbeMetaVisibility(t *testing.T) {
	for _, engine := range []vectordb.Engine{vectordb.EngineDiskVamana, vectordb.EngineHNSW} {
		t.Run(string(engine), func(t *testing.T) {
			dir := t.TempDir()
			db, err := vectordb.Open(dir)
			if err != nil {
				t.Fatalf("打开失败：%v", err)
			}
			seeds := []vectordb.Point{
				{ID: "seed-meta", Vector: []float32{1, 0, 0, 0}, Meta: json.RawMessage(`{"from":"seed"}`)},
				{ID: "seed-plain", Vector: []float32{0, 1, 0, 0}},
			}
			col, err := db.CreateCollectionWithOptions("probe", vectordb.CollectionOptions{
				Engine:         engine,
				Dimension:      4,
				DistanceMetric: "cosine",
				Points:         seeds,
			})
			if err != nil {
				t.Fatalf("建集合失败：%v", err)
			}

			show := func(stage string, ids []string) {
				points, err := col.FetchPoints(ids)
				if err != nil {
					t.Fatalf("%s 取点失败：%v", stage, err)
				}
				for _, point := range points {
					t.Logf("[%s] %s meta=%s", stage, point.ID, string(point.Meta))
				}
			}

			show("建库后", []string{"seed-meta", "seed-plain"})

			written := vectordb.Point{ID: "written-meta", Vector: []float32{0.5, 0.5, 0, 0}, Meta: json.RawMessage(`{"from":"write"}`)}
			if _, err := col.Write(context.Background(), vectordb.WriteBatch{Operations: []vectordb.WriteOperation{{Point: &written}}}, vectordb.WriteOptions{Durability: vectordb.DurabilitySync}); err != nil {
				t.Fatalf("写入失败：%v", err)
			}
			show("写入后", []string{"written-meta"})

			if _, err := col.Checkpoint(context.Background()); err != nil {
				t.Fatalf("checkpoint 失败：%v", err)
			}
			show("checkpoint 后", []string{"seed-meta", "written-meta"})

			if err := col.Close(); err != nil {
				t.Fatalf("关集合失败：%v", err)
			}
			if err := db.Close(); err != nil {
				t.Fatalf("关库失败：%v", err)
			}

			reopenedDB, err := vectordb.Open(dir)
			if err != nil {
				t.Fatalf("重开失败：%v", err)
			}
			defer func() { _ = reopenedDB.Close() }()
			reopened, err := reopenedDB.OpenCollection("probe")
			if err != nil {
				t.Fatalf("重开集合失败：%v", err)
			}
			points, err := reopened.FetchPoints([]string{"seed-meta", "written-meta"})
			if err != nil {
				t.Fatalf("重开后取点失败：%v", err)
			}
			for _, point := range points {
				t.Logf("[重启后] %s meta=%s", point.ID, string(point.Meta))
			}
		})
	}
}
