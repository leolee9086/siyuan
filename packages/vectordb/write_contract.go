package vectordb

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// DurabilityMode 定义批次提交成功前要求达到的持久性级别。
type DurabilityMode string

const (
	// DurabilityMemory 仅保证当前进程内可见，不承诺重启恢复。
	DurabilityMemory DurabilityMode = "memory"
	// DurabilityAsync 发布内存提交后异步落盘，不等待持久化完成。
	DurabilityAsync DurabilityMode = "async"
	// DurabilitySync 在返回前完成当前引擎支持的同步持久化。
	DurabilitySync DurabilityMode = "sync"
)

const (
	// CurrentFormatMajor 是当前公开磁盘格式契约的主版本。
	CurrentFormatMajor uint32 = 1
	// CurrentFormatMinor 是当前公开磁盘格式契约的次版本。
	CurrentFormatMinor uint32 = 0
)

var (
	// ErrInvalidWriteBatch 表示批次结构或操作不满足公开契约。
	ErrInvalidWriteBatch = errors.New("invalid vector write batch")
	// ErrUnsupportedDurability 表示请求了当前实现不支持的持久性级别。
	ErrUnsupportedDurability = errors.New("unsupported durability mode")
	// ErrBatchApplyFailed 表示批次无法完整应用且未发布为成功提交。
	ErrBatchApplyFailed = errors.New("vector write batch apply failed")
	// ErrIndexRecoveryRequired 表示数据提交结果已确定，但索引需要恢复后才能继续提供完整服务。
	ErrIndexRecoveryRequired = errors.New("vector index recovery required")
	// ErrFormatIncompatible 表示磁盘格式主版本或特性位不兼容。
	ErrFormatIncompatible = errors.New("vector storage format incompatible")
)

// WriteOperation 定义批次中的单个外部 ID 变更。
type WriteOperation struct {
	Point    *Point
	DeleteID string
}

// WriteBatch 定义同一集合内按顺序原子发布的变更集合。
type WriteBatch struct {
	Operations []WriteOperation
}

// WriteOptions 定义批次提交的持久性和进度回调。
type WriteOptions struct {
	Durability DurabilityMode
	OnProgress func(WriteProgress)
}

// WriteProgress 描述长操作的可观察阶段。
type WriteProgress struct {
	Stage     string
	Completed int
	Total     int
}

// WriteResult 描述批次提交的线性化序号和持久性结果。
type WriteResult struct {
	CommitSequence uint64
	Applied        int
	Durability     DurabilityMode
	Committed      bool
	IndexHealthy   bool
}

// FormatCompatibility 描述公开磁盘格式的兼容判定结果。
type FormatCompatibility struct {
	Readable          bool
	Writable          bool
	RequiresMigration bool
}

// collectionWriteState 串行化同一集合的公开批次提交并分配提交序号。
type collectionWriteState struct {
	mu       sync.RWMutex
	sequence uint64
}

// CheckFormatCompatibility 按主版本、次版本和特性位判断格式兼容性。
func CheckFormatCompatibility(major, minor uint32, requiredFeatures, supportedFeatures uint64) (FormatCompatibility, error) {
	if major != CurrentFormatMajor {
		return FormatCompatibility{}, fmt.Errorf("%w: major version %d", ErrFormatIncompatible, major)
	}
	if requiredFeatures&^supportedFeatures != 0 {
		return FormatCompatibility{}, fmt.Errorf("%w: unsupported feature bits 0x%x", ErrFormatIncompatible, requiredFeatures&^supportedFeatures)
	}
	if minor > CurrentFormatMinor {
		return FormatCompatibility{Readable: true, Writable: false, RequiresMigration: true}, nil
	}
	return FormatCompatibility{Readable: true, Writable: true}, nil
}

func (db *Database) ensureWriteStateLocked(name string) *collectionWriteState {
	state := db.writeStates[name]
	if state == nil {
		state = &collectionWriteState{}
		db.writeStates[name] = state
	}
	return state
}

func (db *Database) writeState(name string) *collectionWriteState {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.ensureWriteStateLocked(name)
}

func normalizeWriteOptions(opts WriteOptions) (WriteOptions, error) {
	if opts.Durability == "" {
		opts.Durability = DurabilitySync
	}
	switch opts.Durability {
	case DurabilityMemory, DurabilityAsync, DurabilitySync:
		return opts, nil
	default:
		return WriteOptions{}, fmt.Errorf("%w: %q", ErrUnsupportedDurability, opts.Durability)
	}
}

func validateWriteBatch(ctx context.Context, dimension int, batch WriteBatch) ([]WriteOperation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(batch.Operations) == 0 {
		return nil, ErrInvalidWriteBatch
	}

	lastOperation := make(map[string]int, len(batch.Operations))
	for index, operation := range batch.Operations {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		hasPoint := operation.Point != nil
		hasDelete := operation.DeleteID != ""
		if hasPoint == hasDelete {
			return nil, fmt.Errorf("%w at operation %d", ErrInvalidWriteBatch, index)
		}
		id := operation.DeleteID
		if hasPoint {
			id = operation.Point.ID
			if id == "" {
				return nil, fmt.Errorf("%w at operation %d: point ID is empty", ErrInvalidWriteBatch, index)
			}
			if len(operation.Point.Vector) != dimension {
				return nil, fmt.Errorf("%w at operation %d: expected %d, got %d", ErrVectorDimensionInvalid, index, dimension, len(operation.Point.Vector))
			}
		}
		lastOperation[id] = index
	}

	normalized := make([]WriteOperation, 0, len(lastOperation))
	for index, operation := range batch.Operations {
		id := operation.DeleteID
		if operation.Point != nil {
			id = operation.Point.ID
		}
		if lastOperation[id] == index {
			normalized = append(normalized, operation)
		}
	}
	return normalized, nil
}
