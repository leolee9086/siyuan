package vectordb

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"io"
	"os"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/storage"
)

const VamanaWALFileExt = ".wal"

var syncVamanaWALFile = func(file *os.File) error {
	return file.Sync()
}

func AppendVamanaWAL(vc *VamanaCollection, operations []WriteOperation, sequence uint64, syncWrite bool) error {
	entry := WALEntry{
		Op:         OpBatch,
		Sequence:   sequence,
		Operations: operations,
	}
	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()
	return vc.appendWALLocked(entry, syncWrite)
}

func SyncVamanaWAL(vc *VamanaCollection) error {
	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()
	return vc.syncWALLocked()
}

func (vc *VamanaCollection) appendWALLocked(entry WALEntry, syncWrite bool) error {
	file, err := vc.openWALLocked(true)
	if err != nil {
		return err
	}
	stat, err := file.Stat()
	if err != nil {
		return err
	}
	originalSize := stat.Size()
	written, err := appendFramedWALWithSize(file, originalSize, entry)
	if err == nil && syncWrite {
		err = syncVamanaWALFile(file)
	}
	if err == nil {
		vc.walBytes = originalSize + written
		vc.checkpointNeeded.Store(vc.walBytes >= vc.WALCheckpointBytes)
		return nil
	}
	if rollbackErr := vc.rollbackWALAppendLocked(originalSize, syncWrite); rollbackErr != nil {
		return fmt.Errorf("append DiskVamana WAL: %v; rollback WAL: %w", err, rollbackErr)
	}
	vc.walBytes = originalSize
	vc.checkpointNeeded.Store(vc.walBytes >= vc.WALCheckpointBytes)
	return err
}

// rollbackWALAppendLocked 关闭 O_APPEND 句柄后再按路径截断。
// Windows 可能在开放的追加句柄上延迟完成写入，使 Truncate 返回后文件再次增长。
func (vc *VamanaCollection) rollbackWALAppendLocked(originalSize int64, syncWrite bool) error {
	if err := vc.closeWALLocked(); err != nil {
		return err
	}
	path := vc.BasePath + VamanaWALFileExt
	if err := os.Truncate(path, originalSize); err != nil {
		return err
	}
	if !syncWrite {
		return nil
	}
	file, err := os.OpenFile(path, os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	syncErr := file.Sync()
	closeErr := file.Close()
	if syncErr != nil {
		return syncErr
	}
	return closeErr
}

func (vc *VamanaCollection) openWALLocked(create bool) (*os.File, error) {
	if vc.walFile != nil {
		return vc.walFile, nil
	}
	flags := os.O_APPEND | os.O_RDWR
	if create {
		flags |= os.O_CREATE
	}
	file, err := os.OpenFile(vc.BasePath+VamanaWALFileExt, flags, 0644)
	if err != nil {
		return nil, err
	}
	vc.walFile = file
	return file, nil
}

func (vc *VamanaCollection) syncWALLocked() error {
	if vc.walFile != nil {
		return syncVamanaWALFile(vc.walFile)
	}
	file, err := vc.openWALLocked(false)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return syncVamanaWALFile(file)
}

func (vc *VamanaCollection) closeWALLocked() error {
	if vc.walFile == nil {
		return nil
	}
	err := vc.walFile.Close()
	vc.walFile = nil
	return err
}

func LoadVamanaWAL(vc *VamanaCollection) error {
	f, err := os.OpenFile(vc.BasePath+VamanaWALFileExt, os.O_RDWR, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()

	var magic [8]byte
	if _, err := io.ReadFull(f, magic[:]); err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return truncateTornVamanaWAL(f, 0)
		}
		return err
	}
	if magic != walFileMagic {
		return fmt.Errorf("%w: invalid DiskVamana WAL magic", storage.ErrCorruptedFile)
	}

	header := make([]byte, walRecordHeader)
	validSize := int64(len(walFileMagic))
	for {
		if _, err := io.ReadFull(f, header); err != nil {
			if err == io.EOF {
				return nil
			}
			if err == io.ErrUnexpectedEOF {
				return truncateTornVamanaWAL(f, validSize)
			}
			return err
		}
		if binary.LittleEndian.Uint32(header[0:4]) != walRecordMagic {
			return fmt.Errorf("%w: invalid DiskVamana WAL record magic", storage.ErrCorruptedFile)
		}
		length := binary.LittleEndian.Uint32(header[4:8])
		if binary.LittleEndian.Uint32(header[8:12]) != ^length || length > maxWALRecordSize {
			return fmt.Errorf("%w: invalid DiskVamana WAL record length %d", storage.ErrCorruptedFile, length)
		}
		payload := make([]byte, length)
		if _, err := io.ReadFull(f, payload); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return truncateTornVamanaWAL(f, validSize)
			}
			return err
		}
		if crc32.Checksum(payload, walChecksumTable) != binary.LittleEndian.Uint32(header[12:16]) {
			return fmt.Errorf("%w: DiskVamana WAL record checksum mismatch", storage.ErrCorruptedFile)
		}
		var entry WALEntry
		if err := msgpack.NewDecoder(bytes.NewReader(payload)).Decode(&entry); err != nil {
			return fmt.Errorf("%w: decode DiskVamana WAL: %v", storage.ErrCorruptedFile, err)
		}
		validSize += walRecordHeader + int64(length)
		if entry.Sequence <= collectionCommitSequence(vc) {
			continue
		}
		if err := replayVamanaWALEntry(vc, entry); err != nil {
			return err
		}
	}
}

func truncateTornVamanaWAL(file *os.File, size int64) error {
	if err := file.Truncate(size); err != nil {
		return err
	}
	return file.Sync()
}

func replayVamanaWALEntry(vc *VamanaCollection, entry WALEntry) error {
	if entry.Op != OpBatch {
		return fmt.Errorf("%w: unknown DiskVamana WAL operation %d", storage.ErrCorruptedFile, entry.Op)
	}
	if entry.Sequence == 0 {
		return fmt.Errorf("%w: DiskVamana WAL sequence is zero", storage.ErrCorruptedFile)
	}
	operations, err := validateWriteBatch(context.Background(), vc.ColDim, WriteBatch{Operations: entry.Operations})
	if err != nil || len(operations) != len(entry.Operations) {
		return fmt.Errorf("%w: invalid DiskVamana WAL batch: %v", storage.ErrCorruptedFile, err)
	}
	for _, operation := range operations {
		if operation.Point != nil {
			if err := vc.InsertPoint(*operation.Point); err != nil {
				return err
			}
			continue
		}
		if err := vc.DeletePointWithError(operation.DeleteID); err != nil {
			return err
		}
	}
	setCollectionCommitSequence(vc, entry.Sequence)
	return nil
}
