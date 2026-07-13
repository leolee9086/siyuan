package vectordb

import (
	"encoding/json"
	"fmt"
	"testing"
)

// BenchmarkDatasetMetadataPersistence100K 对比全量快照与增量 WAL 的同步持久化成本。
func BenchmarkDatasetMetadataPersistence100K(b *testing.B) {
	metas := make(map[string]json.RawMessage, 100000)
	metaV1 := MarshalMeta(map[string]any{"kind": "note", "version": 1})
	for index := 0; index < 100000; index++ {
		metas[fmt.Sprintf("entity-%06d", index)] = metaV1
	}
	b.Run("full-snapshot", func(b *testing.B) {
		path := b.TempDir()
		b.ReportAllocs()
		b.ResetTimer()
		for iteration := 0; iteration < b.N; iteration++ {
			if err := saveDatasetState(path, uint64(iteration+1), metas); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("single-record-wal", func(b *testing.B) {
		path := b.TempDir()
		entity := Entity{ID: "entity-050000", Meta: MarshalMeta(map[string]any{"kind": "note", "version": 2})}
		b.ReportAllocs()
		b.ResetTimer()
		for iteration := 0; iteration < b.N; iteration++ {
			if err := appendDatasetMetaWAL(path, uint64(iteration+1), []Entity{entity}, nil); err != nil {
				b.Fatal(err)
			}
		}
	})
}
