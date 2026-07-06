//go:build windows

// Package storage provides a unified I/O abstraction layer for disk-based indexes.
//
// This file implements Windows platform mmap reader using native Windows API
// (CreateFileMapping + MapViewOfFile) via golang.org/x/sys/windows.
// Supports both read-only and read-write modes.
package storage

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

// windowsReader implements mmap-based disk index reader for Windows.
//
// Uses Windows native API (CreateFileMapping + MapViewOfFile) for memory mapping.
// Supports both read-only and read-write modes.
type windowsReader struct {
	file      *os.File       // underlying file handle
	mapping   windows.Handle // file mapping handle
	data      []byte         // mapped memory region
	meta      GraphMetadata  // parsed graph metadata
	blockSize uint64         // data block size
	readOnly  bool           // read-only mode flag
}

// platformOpenReader creates Windows platform mmap reader.
//
// Parameters:
//   - path: index file path
//   - readOnly: true for read-only mode, false for read-write mode
//
// Returns DiskIndexReader interface implementation.
// Returns ErrFileNotFound if file does not exist.
func platformOpenReader(path string, readOnly bool) (DiskIndexReader, error) {
	// Determine open mode
	flags := os.O_RDONLY
	if !readOnly {
		flags = os.O_RDWR
	}

	// Open file
	f, err := os.OpenFile(path, flags, 0)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}
		return nil, fmt.Errorf("open index file failed: %w", err)
	}

	// Get file size
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("get file info failed: %w", err)
	}

	fileSize := stat.Size()
	if fileSize < GraphHeaderSize {
		f.Close()
		return nil, ErrCorruptedFile
	}

	// Create file mapping
	protect := uint32(windows.PAGE_READONLY)
	if !readOnly {
		protect = windows.PAGE_READWRITE
	}

	mapping, err := windows.CreateFileMapping(
		windows.Handle(f.Fd()),
		nil,
		protect,
		uint32(fileSize>>32),
		uint32(fileSize),
		nil,
	)
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("create file mapping failed: %w", err)
	}

	// Map view of file
	access := uint32(windows.FILE_MAP_READ)
	if !readOnly {
		access = windows.FILE_MAP_READ | windows.FILE_MAP_WRITE
	}

	addr, err := windows.MapViewOfFile(
		mapping,
		access,
		0,
		0,
		uintptr(fileSize),
	)
	if err != nil {
		windows.CloseHandle(mapping)
		f.Close()
		return nil, fmt.Errorf("map view of file failed: %w", err)
	}

	// Create byte slice from mapped memory
	data := unsafe.Slice((*byte)(unsafe.Pointer(addr)), fileSize)

	// Create reader instance
	r := &windowsReader{
		file:     f,
		mapping:  mapping,
		data:     data,
		readOnly: readOnly,
	}

	// Parse header
	if err := r.parseHeader(); err != nil {
		r.Close()
		return nil, err
	}

	return r, nil
}

// parseHeader parses graph header from mmap data.
//
// Validates magic number and version, extracts metadata.
// Returns ErrInvalidMagic if magic number mismatch.
// Returns ErrVersionMismatch if version not supported.
func (r *windowsReader) parseHeader() error {
	if len(r.data) < GraphHeaderSize {
		return ErrCorruptedFile
	}

	// Read and validate magic number (first 4 bytes)
	magic := binary.LittleEndian.Uint32(r.data[0:4])
	if magic != MagicNumber {
		return ErrInvalidMagic
	}

	// Parse metadata (starting from offset 4, 80 bytes)
	offset := 4
	r.meta.NumPoints = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.Dims = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.Medoid = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.NodeLen = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.NodesPerBlock = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.FrozenNum = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.FrozenLoc = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.Reserved = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.IndexFileSize = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8
	r.meta.AssocDataLength = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8

	// 校验关键布局参数，避免后续 calcOffset/ReadNode 除零与越界
	if r.meta.NodesPerBlock == 0 || r.meta.NodeLen == 0 {
		return ErrCorruptedFile
	}

	// Parse block size (8 bytes)
	r.blockSize = binary.LittleEndian.Uint64(r.data[offset:])
	offset += 8

	// Parse layout version (8 bytes)
	majorVersion := binary.LittleEndian.Uint32(r.data[offset:])
	// minorVersion := binary.LittleEndian.Uint32(r.data[offset+4:])

	// Validate version compatibility
	if majorVersion > CurrentMajorVersion {
		return ErrVersionMismatch
	}

	return nil
}

// calcOffset calculates byte offset in file for given nodeID.
//
// File layout:
//   - Block #0: header (blockSize bytes, typically 4096)
//   - Block #1..N: data blocks, each containing NodesPerBlock nodes
//
// Parameters:
//   - nodeID: node ID
//
// Returns node data start offset in file.
func (r *windowsReader) calcOffset(nodeID uint64) uint64 {
	// Calculate block number and offset within block
	blockNum := nodeID / r.meta.NodesPerBlock
	indexInBlock := nodeID % r.meta.NodesPerBlock

	// Block #0 is header, data starts from Block #1
	// Each data block size = NodesPerBlock * NodeLen
	dataBlockSize := r.meta.NodesPerBlock * r.meta.NodeLen
	blockStartOffset := r.blockSize + blockNum*dataBlockSize
	nodeOffset := indexInBlock * r.meta.NodeLen

	return blockStartOffset + nodeOffset
}

// ReadNode reads complete node data into buffer.
//
// Copies node data from mmap region to user-provided buffer.
//
// Parameters:
//   - nodeID: node ID
//   - buf: target buffer, length must be >= node byte length
//
// Returns ErrNodeNotFound if nodeID out of range.
func (r *windowsReader) ReadNode(nodeID uint64, buf []byte) error {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return ErrNodeNotFound
	}

	// Validate buffer size
	nodeLen := r.meta.NodeLen
	if uint64(len(buf)) < nodeLen {
		return fmt.Errorf("buffer too small: need %d bytes, got %d bytes", nodeLen, len(buf))
	}

	// Calculate offset and copy data
	offset := r.calcOffset(nodeID)
	if offset+nodeLen > uint64(len(r.data)) {
		return ErrCorruptedFile
	}

	copy(buf, r.data[offset:offset+nodeLen])
	return nil
}

// ReadNeighbors returns neighbor ID list for specified node.
//
// Uses unsafe.Slice for zero-copy, directly returns mmap region slice view.
// Caller should not modify returned slice.
//
// Parameters:
//   - nodeID: node ID
//
// Returns neighbor ID list. Returns ErrNodeNotFound if node does not exist.
func (r *windowsReader) ReadNeighbors(nodeID uint64) ([]uint32, error) {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return nil, ErrNodeNotFound
	}

	// Calculate node data offset
	offset := r.calcOffset(nodeID)
	nodeLen := r.meta.NodeLen
	if offset+nodeLen > uint64(len(r.data)) {
		return nil, ErrCorruptedFile
	}

	// Node layout: [Vector][NeighborCount][NeighborIDs][AssocData]
	// Vector bytes = Dims * 4 (float32)
	vectorBytes := r.meta.Dims * 4
	neighborCountOffset := offset + vectorBytes

	// Read neighbor count (uint32)
	neighborCount := binary.LittleEndian.Uint32(r.data[neighborCountOffset:])
	if neighborCount == 0 {
		return []uint32{}, nil
	}

	// Neighbor IDs start position
	neighborIDsStart := neighborCountOffset + 4

	// 校验 neighborCount 不超出节点布局范围，防止损坏文件导致 unsafe.Slice 越界
	neighborBytes := uint64(neighborCount) * 4
	if neighborIDsStart+neighborBytes > offset+nodeLen {
		return nil, ErrCorruptedFile
	}

	// Use unsafe.Slice for zero-copy
	// Directly convert mmap region to []uint32 slice view
	neighborSlice := unsafe.Slice(
		(*uint32)(unsafe.Pointer(&r.data[neighborIDsStart])),
		neighborCount,
	)

	return neighborSlice, nil
}

// ReadVector reads original vector of specified node into target slice.
//
// Used for rerank phase of search results.
//
// Parameters:
//   - nodeID: node ID
//   - vec: target slice, length must be >= vector dimension
//
// Returns ErrNodeNotFound if node does not exist.
// Returns ErrDimensionMismatch if target slice length insufficient.
func (r *windowsReader) ReadVector(nodeID uint64, vec []float32) error {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return ErrNodeNotFound
	}

	// Validate target slice size
	dims := r.meta.Dims
	if uint64(len(vec)) < dims {
		return ErrDimensionMismatch
	}

	// Calculate node data offset
	offset := r.calcOffset(nodeID)
	vectorBytes := dims * 4
	if offset+vectorBytes > uint64(len(r.data)) {
		return ErrCorruptedFile
	}

	// Read vector data from mmap region
	// Vector is stored at the beginning of node data
	for i := uint64(0); i < dims; i++ {
		byteOffset := offset + i*4
		bits := binary.LittleEndian.Uint32(r.data[byteOffset:])
		vec[i] = math.Float32frombits(bits)
	}

	return nil
}

// ReadVectorRef returns a zero-copy reference to the vector data in mmap region.
//
// Uses unsafe.Slice to directly interpret mmap bytes as []float32, avoiding
// allocation and per-element copy. Caller must not modify the returned slice.
//
// Parameters:
//   - nodeID: node ID
//
// Returns vector slice (zero-copy), ErrNodeNotFound if node does not exist.
func (r *windowsReader) ReadVectorRef(nodeID uint64) ([]float32, error) {
	// Validate nodeID range
	if nodeID >= r.meta.NumPoints {
		return nil, ErrNodeNotFound
	}

	// Calculate node data offset
	offset := r.calcOffset(nodeID)
	vectorBytes := r.meta.Dims * 4
	if offset+vectorBytes > uint64(len(r.data)) {
		return nil, ErrCorruptedFile
	}

	// Zero-copy: interpret mmap bytes directly as float32 slice
	return unsafe.Slice(
		(*float32)(unsafe.Pointer(&r.data[offset])),
		r.meta.Dims,
	), nil
}

// Metadata returns graph index metadata.
//
// Returned pointer points to internal data, caller should not modify.
func (r *windowsReader) Metadata() *GraphMetadata {
	return &r.meta
}

// Warmup preloads specified nodes into memory.
//
// For Windows mmap implementation, this triggers OS page prefetch.
// Accesses first byte of node data to trigger page load.
//
// Parameters:
//   - nodeIDs: list of node IDs to warmup
func (r *windowsReader) Warmup(nodeIDs []uint64) error {
	for _, nodeID := range nodeIDs {
		if nodeID >= r.meta.NumPoints {
			continue // skip invalid nodeID
		}

		offset := r.calcOffset(nodeID)
		if offset < uint64(len(r.data)) {
			// Access first byte to trigger page load
			// Use volatile read to prevent compiler optimization
			_ = r.data[offset]
		}
	}
	return nil
}

// Close unmaps memory and closes file.
//
// Releases all resources. Reader should not be used after calling.
func (r *windowsReader) Close() error {
	var firstErr error

	// Unmap view of file
	if r.data != nil {
		addr := uintptr(unsafe.Pointer(&r.data[0]))
		if err := windows.UnmapViewOfFile(addr); err != nil {
			firstErr = fmt.Errorf("unmap view of file failed: %w", err)
		}
		r.data = nil
	}

	// Close file mapping handle
	if r.mapping != 0 {
		if err := windows.CloseHandle(r.mapping); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close file mapping failed: %w", err)
		}
		r.mapping = 0
	}

	// Close file
	if r.file != nil {
		if err := r.file.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close file failed: %w", err)
		}
		r.file = nil
	}

	return firstErr
}
