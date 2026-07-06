package vectordb

import (
	"sync"

	"s-forge.local/vectordb/storage"
	"s-forge.local/vectordb/vamana"
)

var setDiskReaderOnce sync.Once

func ensureDiskVamanaReader() {
	setDiskReaderOnce.Do(func() {
		vamana.SetOpenDiskIndexReader(storage.OpenReader)
	})
}
