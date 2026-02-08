// Package storage provides a unified I/O abstraction layer for disk-based indexes.
//
// This package defines cross-platform disk index read/write interfaces, supporting:
//   - Linux/macOS: mmap memory mapping
//   - Windows: golang.org/x/exp/mmap
//   - iOS/Android: buffered read + LRU cache
//
// Basic usage:
//
//	reader, err := storage.OpenDiskIndex("vamana.index", true)
//	if err != nil {
//	    return err
//	}
//	defer reader.Close()
//
//	neighbors, err := reader.ReadNeighbors(nodeID)
package storage

import (
	"errors"
	"io"
)

// ============================================================================
// Constants
// ============================================================================

const (
	// DefaultBlockSize 4KB, SSD sector aligned
	DefaultBlockSize = 4096

	// DefaultMaxDegree default maximum out-degree
	DefaultMaxDegree = 64

	// GraphSlackFactor graph slack factor
	GraphSlackFactor = 1.3

	// GraphHeaderSize (96 bytes)
	GraphHeaderSize = 96

	// Current layout version
	CurrentMajorVersion = 1
	CurrentMinorVersion = 0

	// MagicNumber "VAMA"
	MagicNumber uint32 = 0x56414D41

	// DeletedBitmapMagic "DELB"
	DeletedBitmapMagic uint32 = 0x44454C42
)

// ============================================================================
// Errors
// ============================================================================

var (
	// ErrFileNotFound index file not found
	ErrFileNotFound = errors.New("index file not found")

	// ErrInvalidMagic invalid magic number
	ErrInvalidMagic = errors.New("invalid magic number")

	// ErrVersionMismatch version mismatch
	ErrVersionMismatch = errors.New("unsupported version")

	// ErrCorruptedFile file corrupted
	ErrCorruptedFile = errors.New("file corrupted")

	// ErrNeighborsFull neighbor list is full
	ErrNeighborsFull = errors.New("neighbor list is full")

	// ErrIndexFull index capacity reached
	ErrIndexFull = errors.New("index capacity reached")

	// ErrDimensionMismatch vector dimension mismatch
	ErrDimensionMismatch = errors.New("vector dimension mismatch")

	// ErrNodeDeleted node has been deleted
	ErrNodeDeleted = errors.New("node has been deleted")

	// ErrIndexClosed index is closed
	ErrIndexClosed = errors.New("index is closed")

	// ErrReadOnly read-only mode, write not allowed
	ErrReadOnly = errors.New("index is read-only")

	// ErrNodeNotFound node not found
	ErrNodeNotFound = errors.New("node not found")
)

// ============================================================================
// Data Structures
// ============================================================================

// GraphMetadata defines graph index metadata (80 bytes, little-endian)
type GraphMetadata struct {
	NumPoints       uint64 // num_pts: number of points in the index
	Dims            uint64 // dims: vector dimension
	Medoid          uint64 // medoid: search entry point
	NodeLen         uint64 // node_len: single node byte length
	NodesPerBlock   uint64 // num_nodes_per_block: nodes per data block
	FrozenNum       uint64 // vamana_frozen_num: number of frozen nodes
	FrozenLoc       uint64 // vamana_frozen_loc: frozen node start location
	Reserved        uint64 // append_reorder_data: reserved for compatibility
	IndexFileSize   uint64 // disk_index_file_size: total index file size
	AssocDataLength uint64 // associated_data_length: associated data length per node
}

// LayoutVersion defines file format version (8 bytes)
type LayoutVersion struct {
	Major uint32 // major version
	Minor uint32 // minor version
}

// GraphHeader defines graph index file header (96 bytes)
type GraphHeader struct {
	Meta      GraphMetadata // 80 bytes
	BlockSize uint64        // 8 bytes: data block size
	Version   LayoutVersion // 8 bytes
}

// ============================================================================
// Interfaces
// ============================================================================

// DiskIndexReader defines read-only access interface for disk index.
//
// This interface abstracts I/O implementation details across platforms,
// providing a unified read API.
// Implementations include:
//   - mmap reader (Linux/macOS): zero-copy memory mapping
//   - Windows reader: golang.org/x/exp/mmap
//   - Mobile reader (iOS/Android): buffered read + LRU cache
type DiskIndexReader interface {
	io.Closer

	// ReadNode reads complete node data into buffer.
	//
	// Parameters:
	//   - nodeID: node ID
	//   - buf: target buffer, length must be >= node byte length
	//
	// Returns ErrNodeNotFound if node does not exist.
	ReadNode(nodeID uint64, buf []byte) error

	// ReadNeighbors returns neighbor ID list for specified node.
	//
	// Returned slice may be zero-copy view (mmap) or copy (buffered read),
	// caller should not modify the returned slice.
	//
	// Parameters:
	//   - nodeID: node ID
	//
	// Returns neighbor ID list, ErrNodeNotFound if node does not exist.
	ReadNeighbors(nodeID uint64) ([]uint32, error)

	// ReadVector reads original vector of specified node into target slice.
	//
	// Used for rerank phase of search results.
	//
	// Parameters:
	//   - nodeID: node ID
	//   - vec: target slice, length must be >= vector dimension
	//
	// Returns ErrNodeNotFound if node does not exist.
	ReadVector(nodeID uint64, vec []float32) error

	// ReadVectorRef returns a zero-copy reference to the vector data in mmap region.
	//
	// Like ReadNeighbors, this uses unsafe.Slice to avoid allocation and copy.
	// Caller must not modify the returned slice. For buffered (mobile) readers,
	// this falls back to allocating and copying (same as ReadVector with internal buffer).
	//
	// This is the Go equivalent of C++ DiskANN's _data_store->get_vector() which
	// returns a pointer into the memory-mapped data store.
	//
	// Parameters:
	//   - nodeID: node ID
	//
	// Returns vector slice (zero-copy on mmap platforms), ErrNodeNotFound if node does not exist.
	ReadVectorRef(nodeID uint64) ([]float32, error)

	// Metadata returns graph index metadata.
	//
	// Returned pointer points to internal data, caller should not modify.
	Metadata() *GraphMetadata

	// Warmup preloads specified nodes into memory/cache.
	//
	// For mmap implementation, this triggers page prefetch;
	// For buffered implementation, this loads nodes into LRU cache.
	//
	// Parameters:
	//   - nodeIDs: list of node IDs to warmup
	Warmup(nodeIDs []uint64) error
}

// DiskIndexWriter defines read-write access interface for disk index.
//
// Embeds DiskIndexReader, adding write capability on top.
type DiskIndexWriter interface {
	DiskIndexReader

	// AppendNode appends a new node to the index.
	//
	// Parameters:
	//   - vector: node vector, length must equal index dimension
	//   - neighbors: initial neighbor list
	//   - assocData: associated data, length must equal AssocDataLength
	//
	// Returns new node ID. Returns ErrIndexFull if index is full.
	AppendNode(vector []float32, neighbors []uint32, assocData []byte) (nodeID uint64, err error)

	// UpdateNeighbors updates neighbor list for specified node.
	//
	// Neighbor list length cannot exceed max degree.
	//
	// Parameters:
	//   - nodeID: node ID
	//   - neighbors: new neighbor list
	//
	// Returns ErrNodeNotFound if node does not exist,
	// Returns ErrNeighborsFull if neighbor count exceeds max degree.
	UpdateNeighbors(nodeID uint64, neighbors []uint32) error

	// Sync flushes all pending writes to disk.
	//
	// Should be called before closing index to ensure data persistence.
	Sync() error
}

// ============================================================================
// Factory Function Types
// ============================================================================

// OpenFunc defines the function type for opening disk index.
//
// Automatically selects best I/O implementation based on platform:
//   - Linux/macOS: mmap memory mapping
//   - Windows: golang.org/x/exp/mmap
//   - iOS/Android: buffered read + LRU cache
//
// Parameters:
//   - path: index file path
//   - readOnly: true for read-only mode, false for read-write mode
//
// Returns DiskIndexReader interface. Type assert to DiskIndexWriter if write needed.
// Returns ErrFileNotFound if file does not exist.
type OpenFunc func(path string, readOnly bool) (DiskIndexReader, error)

// ============================================================================
// Helper Functions
// ============================================================================

// CalcNodeLength calculates single node byte length based on parameters.
//
// Node layout: [Vector][NeighborCount][NeighborIDs][AssocData]
//
// Parameters:
//   - dims: vector dimension
//   - maxDegree: maximum out-degree
//   - assocDataLen: associated data length
func CalcNodeLength(dims int, maxDegree int, assocDataLen int) int {
	vectorBytes := dims * 4              // float32
	neighborBytes := (1 + maxDegree) * 4 // NumNeighbors(u32) + NeighborIDs(u32 * maxDegree)
	return vectorBytes + neighborBytes + assocDataLen
}

// CalcNodesPerBlock calculates nodes per block based on block size and node length.
//
// Parameters:
//   - blockSize: data block size
//   - nodeLen: node byte length
func CalcNodesPerBlock(blockSize int, nodeLen int) int {
	if nodeLen == 0 {
		return 0
	}
	return blockSize / nodeLen
}

// CalcMaxDegree calculates max degree from node length.
//
// Formula: maxDegree = (nodeLen - dims*4 - assocDataLen) / 4 - 1
//
// Parameters:
//   - nodeLen: node byte length
//   - dims: vector dimension
//   - assocDataLen: associated data length
func CalcMaxDegree(nodeLen int, dims int, assocDataLen int) int {
	vectorBytes := dims * 4
	remainingBytes := nodeLen - vectorBytes - assocDataLen
	if remainingBytes <= 4 {
		return 0
	}
	return (remainingBytes / 4) - 1
}
