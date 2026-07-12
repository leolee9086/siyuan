// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package vectordb

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"io"
	"os"
	"path/filepath"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/hnsw"
)

// =========================================
// Persistence layer
// =========================================

const (
	SnapshotFileName = "snapshot.msgpack"
	WALFileName      = "wal.msgpack"
)

var walFileMagic = [8]byte{'S', 'V', 'D', 'B', 'W', 'A', 'L', '1'}

const (
	walRecordMagic   uint32 = 0x31524c57
	walRecordHeader         = 16
	maxWALRecordSize        = 256 << 20
)

var walChecksumTable = crc32.MakeTable(crc32.Castagnoli)

type SnapshotData struct {
	FormatMajor      uint32           `msgpack:"formatMajor"`
	FormatMinor      uint32           `msgpack:"formatMinor"`
	RequiredFeatures uint64           `msgpack:"requiredFeatures"`
	CommitSequence   uint64           `msgpack:"commitSequence"`
	Name             string           `msgpack:"name"`
	Dimension        int              `msgpack:"dimension"`
	Config           CollectionConfig `msgpack:"config"`
	Meta             CollectionMeta   `msgpack:"meta"`

	DocMap []string         `msgpack:"docMap"`
	IDMap  map[string]DocID `msgpack:"idMap"`

	Metas [][]byte `msgpack:"metas"`

	Neighbors [][][]DocID    `msgpack:"neighbors"`
	Deleted   map[DocID]bool `msgpack:"deleted"`

	Vectors []float32 `msgpack:"vectors"`
	// BBQQuantized 是旧快照的兼容字段。未打包码不再持久化，运行时只保留写入 scratch。
	BBQQuantized   []byte                   `msgpack:"bbqQuantized,omitempty"`
	BBQPacked      []byte                   `msgpack:"bbqPacked"`
	BBQCorrections []bbq.QuantizationResult `msgpack:"bbqCorrections"`
	BBQCentroid    []float32                `msgpack:"bbqCentroid"`
	BBQCentroidSum []float64                `msgpack:"bbqCentroidSum"`
	BBQSquareSum   float64                  `msgpack:"bbqSquareSum"`
	BBQCount       uint64                   `msgpack:"bbqCount"`
	BBQEpoch       uint64                   `msgpack:"bbqEpoch"`
	BBQRebuildAt   uint64                   `msgpack:"bbqRebuildAt"`
	BBQMutations   uint64                   `msgpack:"bbqMutations"`
	BBQActive      []bool                   `msgpack:"bbqActive"`

	EntryPoint DocID `msgpack:"entryPoint"`
	MaxLayer   int   `msgpack:"maxLayer"`
}

type WALEntry struct {
	Op         int              `msgpack:"op"`
	Sequence   uint64           `msgpack:"sequence,omitempty"`
	Points     []Point          `msgpack:"points,omitempty"`
	Keys       []string         `msgpack:"keys,omitempty"`
	Operations []WriteOperation `msgpack:"operations,omitempty"`
}

const (
	OpAdd    = 1
	OpDelete = 2
	OpBatch  = 3
)

// SaveCollection saves a collection snapshot.
// For HNSW-backed collections: msgpack snapshot.
// For Vamana-backed collections: no-op (data is already on disk).
func SaveCollection(vc VectorCollection, basePath string) error {
	c, ok := vc.(*Collection)
	if !ok {
		return nil
	}

	c.Mu.RLock()
	defer c.Mu.RUnlock()

	collectionPath := filepath.Join(basePath, c.ColName)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

	c.Store.mu.RLock()
	vectors := make([]float32, len(c.Store.vectors))
	copy(vectors, c.Store.vectors)
	bbqPacked := make([]byte, len(c.Store.bbqPacked))
	copy(bbqPacked, c.Store.bbqPacked)
	bbqCorrections := make([]bbq.QuantizationResult, len(c.Store.bbqCorrections))
	copy(bbqCorrections, c.Store.bbqCorrections)
	bbqCentroid := append([]float32(nil), c.Store.centroid...)
	bbqCentroidSum := append([]float64(nil), c.Store.centroidSum...)
	bbqActive := append([]bool(nil), c.Store.active...)
	bbqSquareSum := c.Store.centroidSquareSum
	bbqCount := c.Store.centroidCount
	bbqEpoch := c.Store.centroidEpoch
	bbqRebuildAt := c.Store.centroidRebuildAt
	bbqMutations := c.Store.centroidMutations
	c.Store.mu.RUnlock()

	hnswNeighbors, deleted, entryPoint, maxLayer := c.HNSWIdx.Snapshot()
	neighbors := make([][][]DocID, len(hnswNeighbors))
	for i, levels := range hnswNeighbors {
		neighbors[i] = make([][]DocID, len(levels))
		for j, records := range levels {
			ids := make([]DocID, len(records))
			for k, record := range records {
				ids[k] = record.ID
			}
			neighbors[i][j] = ids
		}
	}

	snapshot := SnapshotData{
		FormatMajor:    CurrentFormatMajor,
		FormatMinor:    CurrentFormatMinor,
		CommitSequence: c.LastCommitSequence,
		Name:           c.ColName,
		Dimension:      c.ColDim,
		Config:         c.Config,
		Meta:           c.Meta,
		DocMap:         c.DocMap,
		IDMap:          c.IDMap,
		Metas:          c.Metas,
		Neighbors:      neighbors,
		Deleted:        deleted,
		Vectors:        vectors,
		BBQPacked:      bbqPacked,
		BBQCorrections: bbqCorrections,
		BBQCentroid:    bbqCentroid,
		BBQCentroidSum: bbqCentroidSum,
		BBQSquareSum:   bbqSquareSum,
		BBQCount:       bbqCount,
		BBQEpoch:       bbqEpoch,
		BBQRebuildAt:   bbqRebuildAt,
		BBQMutations:   bbqMutations,
		BBQActive:      bbqActive,
		EntryPoint:     entryPoint,
		MaxLayer:       maxLayer,
	}

	data, err := msgpack.Marshal(&snapshot)
	if err != nil {
		return err
	}

	if err := atomicWriteFile(filepath.Join(collectionPath, SnapshotFileName), data); err != nil {
		return err
	}

	walPath := filepath.Join(collectionPath, WALFileName)
	if err := os.Remove(walPath); err != nil {
		if !os.IsNotExist(err) {
			return err
		}
	} else if err := syncParentDirectory(walPath); err != nil {
		return err
	}

	return nil
}

func LoadCollection(basePath string, name string) (*Collection, error) {
	collectionPath := filepath.Join(basePath, name)

	snapshotPath := filepath.Join(collectionPath, SnapshotFileName)
	data, err := os.ReadFile(snapshotPath)

	var c *Collection

	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		return NewCollection(name, 0), nil
	}

	var snapshot SnapshotData
	if err := msgpack.Unmarshal(data, &snapshot); err != nil {
		return nil, err
	}
	if snapshot.FormatMajor != 0 {
		compatibility, compatibilityErr := CheckFormatCompatibility(snapshot.FormatMajor, snapshot.FormatMinor, snapshot.RequiredFeatures, 0)
		if compatibilityErr != nil {
			return nil, compatibilityErr
		}
		if !compatibility.Writable {
			return nil, fmt.Errorf("%w: snapshot requires migration before write", ErrFormatIncompatible)
		}
	}

	store := NewVectorStore(snapshot.Dimension, snapshot.Config.MetricType)
	store.vectors = snapshot.Vectors
	store.bbqPacked = snapshot.BBQPacked
	store.bbqCorrections = snapshot.BBQCorrections
	if len(snapshot.BBQCentroid) == snapshot.Dimension {
		store.centroid = append(store.centroid[:0], snapshot.BBQCentroid...)
	}
	if len(snapshot.BBQCentroidSum) == snapshot.Dimension && len(snapshot.BBQActive) > 0 {
		store.centroidSum = append(store.centroidSum[:0], snapshot.BBQCentroidSum...)
		store.centroidSquareSum = snapshot.BBQSquareSum
		store.centroidCount = snapshot.BBQCount
		store.centroidEpoch = snapshot.BBQEpoch
		store.centroidRebuildAt = snapshot.BBQRebuildAt
		store.centroidMutations = snapshot.BBQMutations
		store.active = append(store.active[:0], snapshot.BBQActive...)
	} else {
		store.restoreCentroidStatistics(snapshot.DocMap, snapshot.Deleted)
	}

	hnswNeighbors := make([][][]hnsw.NeighborRecord, len(snapshot.Neighbors))
	for i, levels := range snapshot.Neighbors {
		hnswNeighbors[i] = make([][]hnsw.NeighborRecord, len(levels))
		for j, ids := range levels {
			records := make([]hnsw.NeighborRecord, len(ids))
			for k, id := range ids {
				records[k] = hnsw.NeighborRecord{ID: id, Distance: 0}
			}
			hnswNeighbors[i][j] = records
		}
	}

	deleted := snapshot.Deleted
	if deleted == nil {
		deleted = make(map[DocID]bool)
	}

	hnswConfig := hnsw.Config{
		M:              snapshot.Config.M,
		EfConstruction: snapshot.Config.EfConstruction,
		EfSearch:       snapshot.Config.EfSearch,
		MaxLevel:       snapshot.Config.MaxLevel,
		MetricType:     snapshot.Config.MetricType,
	}

	hnswIdx := hnsw.NewHNSWIndex(snapshot.Dimension, hnswConfig, store)
	hnswIdx.Restore(hnswNeighbors, deleted, snapshot.EntryPoint, snapshot.MaxLayer)

	idMap := snapshot.IDMap
	if idMap == nil {
		idMap = make(map[string]DocID)
	}
	if _, exists := idMap[""]; exists {
		return nil, fmt.Errorf("%w: snapshot contains an empty point ID", ErrStorageCorrupted)
	}
	freeDocIDs := make([]DocID, 0)
	for docID, id := range snapshot.DocMap {
		if id == "" {
			freeDocIDs = append(freeDocIDs, DocID(docID))
		}
	}

	c = &Collection{
		ColName:            snapshot.Name,
		ColDim:             snapshot.Dimension,
		Config:             snapshot.Config,
		Meta:               snapshot.Meta,
		LastCommitSequence: snapshot.CommitSequence,
		IDMap:              idMap,
		DocMap:             snapshot.DocMap,
		freeDocIDs:         freeDocIDs,
		Store:              store,
		Metas:              snapshot.Metas,
		HNSWIdx:            hnswIdx,
	}

	walPath := filepath.Join(collectionPath, WALFileName)
	f, err := os.OpenFile(walPath, os.O_RDWR, 0644)
	if err == nil {
		defer f.Close()
		if err := loadWAL(c, f); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrStorageCorrupted, err)
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	return c, nil
}

func AppendWALAdd(c *Collection, basePath string, points []Point) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpAdd, Points: points}, false)
}

func AppendWALDelete(c *Collection, basePath string, keys []string) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpDelete, Keys: keys}, false)
}

func AppendWALBatchSync(c *Collection, basePath string, operations []WriteOperation, sequence uint64) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpBatch, Sequence: sequence, Operations: operations}, true)
}

func AppendWALBatchAsync(c *Collection, basePath string, operations []WriteOperation, sequence uint64) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpBatch, Sequence: sequence, Operations: operations}, false)
}

func SyncCollectionWAL(c *Collection, basePath string) error {
	walPath := filepath.Join(basePath, c.ColName, WALFileName)
	f, err := os.OpenFile(walPath, os.O_RDWR, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()
	return f.Sync()
}

func appendWAL(name string, basePath string, entry WALEntry, syncWrite bool) error {
	collectionPath := filepath.Join(basePath, name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}
	return appendWALPath(filepath.Join(collectionPath, WALFileName), entry, syncWrite)
}

func appendWALPath(walPath string, entry WALEntry, syncWrite bool) error {
	if err := os.MkdirAll(filepath.Dir(walPath), 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(walPath, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return err
	}
	originalSize := stat.Size()
	framed := originalSize == 0
	if originalSize >= int64(len(walFileMagic)) {
		var magic [8]byte
		if _, err := f.ReadAt(magic[:], 0); err != nil {
			return err
		}
		framed = magic == walFileMagic
	}

	if framed {
		err = appendFramedWAL(f, originalSize, entry)
	} else {
		err = msgpack.NewEncoder(f).Encode(entry)
	}
	if err == nil && syncWrite {
		err = f.Sync()
		if err == nil && originalSize == 0 {
			err = syncParentDirectory(walPath)
		}
	}
	if err == nil {
		return nil
	}
	if rollbackErr := rollbackWALAppend(f, originalSize, syncWrite); rollbackErr != nil {
		return fmt.Errorf("append WAL: %v; rollback WAL: %w", err, rollbackErr)
	}
	return err
}

func syncWALPath(walPath string) error {
	f, err := os.OpenFile(walPath, os.O_RDWR, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()
	return f.Sync()
}

func appendFramedWAL(f *os.File, originalSize int64, entry WALEntry) error {
	_, err := appendFramedWALWithSize(f, originalSize, entry)
	return err
}

func appendFramedWALWithSize(f *os.File, originalSize int64, entry WALEntry) (int64, error) {
	payload, err := msgpack.Marshal(&entry)
	if err != nil {
		return 0, err
	}
	if len(payload) > maxWALRecordSize {
		return 0, fmt.Errorf("WAL record too large: %d", len(payload))
	}

	frameSize := len(payload) + walRecordHeader
	prefixSize := 0
	if originalSize == 0 {
		prefixSize = len(walFileMagic)
	}
	buffer := make([]byte, prefixSize+frameSize)
	if prefixSize != 0 {
		copy(buffer, walFileMagic[:])
	}
	header := buffer[prefixSize : prefixSize+walRecordHeader]
	binary.LittleEndian.PutUint32(header[0:4], walRecordMagic)
	binary.LittleEndian.PutUint32(header[4:8], uint32(len(payload)))
	binary.LittleEndian.PutUint32(header[8:12], ^uint32(len(payload)))
	binary.LittleEndian.PutUint32(header[12:16], crc32.Checksum(payload, walChecksumTable))
	copy(buffer[prefixSize+walRecordHeader:], payload)

	written, err := f.Write(buffer)
	if err != nil {
		return 0, err
	}
	if written != len(buffer) {
		return 0, io.ErrShortWrite
	}
	return int64(written), nil
}

func rollbackWALAppend(f *os.File, originalSize int64, syncWrite bool) error {
	if err := f.Truncate(originalSize); err != nil {
		return err
	}
	if syncWrite {
		return f.Sync()
	}
	return nil
}

func loadWAL(c *Collection, f *os.File) error {
	var magic [8]byte
	n, err := io.ReadFull(f, magic[:])
	if err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return truncateTornWAL(f, 0)
		}
		return err
	}
	if n == len(magic) && magic == walFileMagic {
		return loadFramedWAL(c, f)
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return err
	}
	return loadLegacyWAL(c, f)
}

func loadLegacyWAL(c *Collection, reader io.Reader) error {
	decoder := msgpack.NewDecoder(reader)
	for {
		var entry WALEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if err := replayWALEntry(c, entry); err != nil {
			return err
		}
	}
}

func loadFramedWAL(c *Collection, file *os.File) error {
	header := make([]byte, walRecordHeader)
	validSize := int64(len(walFileMagic))
	for {
		if _, err := io.ReadFull(file, header); err != nil {
			if err == io.EOF {
				return nil
			}
			if err == io.ErrUnexpectedEOF {
				return truncateTornWAL(file, validSize)
			}
			return err
		}
		if binary.LittleEndian.Uint32(header[0:4]) != walRecordMagic {
			return fmt.Errorf("invalid WAL record magic")
		}
		length := binary.LittleEndian.Uint32(header[4:8])
		if binary.LittleEndian.Uint32(header[8:12]) != ^length || length > maxWALRecordSize {
			return fmt.Errorf("invalid WAL record length %d", length)
		}
		payload := make([]byte, int(length))
		if _, err := io.ReadFull(file, payload); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return truncateTornWAL(file, validSize)
			}
			return err
		}
		if crc32.Checksum(payload, walChecksumTable) != binary.LittleEndian.Uint32(header[12:16]) {
			return fmt.Errorf("WAL record checksum mismatch")
		}
		var entry WALEntry
		if err := msgpack.NewDecoder(bytes.NewReader(payload)).Decode(&entry); err != nil {
			return err
		}
		validSize += walRecordHeader + int64(length)
		if err := replayWALEntry(c, entry); err != nil {
			return err
		}
	}
}

func truncateTornWAL(file *os.File, size int64) error {
	if err := file.Truncate(size); err != nil {
		return err
	}
	return file.Sync()
}

func replayWALEntry(c *Collection, entry WALEntry) error {
	switch entry.Op {
	case OpAdd:
		for _, point := range entry.Points {
			if err := c.InsertPoint(point); err != nil {
				return err
			}
		}
	case OpDelete:
		for _, key := range entry.Keys {
			if err := c.DeletePointWithError(key); err != nil {
				return err
			}
		}
	case OpBatch:
		for _, operation := range entry.Operations {
			if operation.Point != nil {
				if err := c.InsertPoint(*operation.Point); err != nil {
					return err
				}
				continue
			}
			if err := c.DeletePointWithError(operation.DeleteID); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("unknown WAL operation %d", entry.Op)
	}
	if entry.Sequence > c.LastCommitSequence {
		c.LastCommitSequence = entry.Sequence
	}
	return nil
}

func atomicWriteFile(path string, data []byte) (err error) {
	dir := filepath.Dir(path)
	tmpFile, err := os.CreateTemp(dir, ".snapshot-*.tmp")
	if err != nil {
		return err
	}

	success := false
	defer func() {
		tmpFile.Close()
		if !success {
			os.Remove(tmpFile.Name())
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}

	if err := durableRename(tmpFile.Name(), path); err != nil {
		return err
	}

	success = true
	return nil
}

func SaveDatabase(db *Database) error {
	if err := db.ensureDatabaseLock(); err != nil {
		return err
	}
	if err := os.MkdirAll(db.Path, 0755); err != nil {
		return err
	}

	db.mu.RLock()
	defer db.mu.RUnlock()

	for _, collection := range db.Collections {
		if err := SaveCollection(collection, db.Path); err != nil {
			return err
		}
	}

	return nil
}

func LoadDatabase(path string) (*Database, error) {
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, err
	}
	db := NewDatabase(path)
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
	success := false
	defer func() {
		if !success {
			db.closeAfterOpenFailure()
		}
	}()

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		collection, err := LoadCollection(path, entry.Name())
		if err != nil {
			continue
		}
		db.Collections[collection.ColName] = collection
		db.ensureWriteStateLocked(collection.ColName).sequence = collectionCommitSequence(collection)
	}

	success = true
	return db, nil
}
