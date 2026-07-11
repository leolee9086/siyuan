package vectordb

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"io"
	"os"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/storage"
)

const VamanaWALFileExt = ".wal"

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
	if err := appendFramedWAL(file, originalSize, entry); err == nil {
		if syncWrite {
			return file.Sync()
		}
		return nil
	} else if rollbackErr := rollbackWALAppend(file, originalSize, syncWrite); rollbackErr != nil {
		return fmt.Errorf("append DiskVamana WAL: %v; rollback WAL: %w", err, rollbackErr)
	} else {
		return err
	}
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
		return vc.walFile.Sync()
	}
	file, err := vc.openWALLocked(false)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return file.Sync()
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
		return fmt.Errorf("unknown DiskVamana WAL operation %d", entry.Op)
	}
	for _, operation := range entry.Operations {
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
