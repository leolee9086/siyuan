// Package storage provides serialization and deserialization functions for disk-based indexes.
//
// This file implements:
//   - Graph header read/write functions
//   - Node parsing functions (neighbors, vectors)
//   - Node serialization functions
//   - Deleted bitmap persistence
//
// All binary data uses little-endian byte order for cross-platform compatibility.
package storage

import (
	"encoding/binary"
	"io"
	"math"
	"math/bits"
	"os"
	"sync"
)

// ============================================================================
// Graph Header Serialization
// ============================================================================

// WriteGraphHeader writes a GraphHeader to the given writer.
//
// The header is written in the following order:
//   - Magic number (4 bytes, uint32)
//   - GraphMetadata (80 bytes)
//   - BlockSize (8 bytes, uint64)
//   - LayoutVersion (8 bytes)
//
// Total: 4 + 80 + 8 + 8 = 100 bytes (but GraphHeaderSize is 96 bytes without magic)
//
// Parameters:
//   - w: destination writer
//   - header: the header to write
//
// Returns error if write fails.
func WriteGraphHeader(w io.Writer, header *GraphHeader) error {
	// Write magic number
	if err := binary.Write(w, binary.LittleEndian, MagicNumber); err != nil {
		return err
	}

	// Write metadata
	if err := binary.Write(w, binary.LittleEndian, &header.Meta); err != nil {
		return err
	}

	// Write block size
	if err := binary.Write(w, binary.LittleEndian, header.BlockSize); err != nil {
		return err
	}

	// Write version
	return binary.Write(w, binary.LittleEndian, &header.Version)
}

// ReadGraphHeader reads a GraphHeader from the given reader.
//
// Validates magic number and version compatibility.
//
// Parameters:
//   - r: source reader
//
// Returns the parsed header, or error if:
//   - Read fails
//   - Magic number is invalid (ErrInvalidMagic)
//   - Version is incompatible (ErrVersionMismatch)
func ReadGraphHeader(r io.Reader) (*GraphHeader, error) {
	// Read and validate magic number
	var magic uint32
	if err := binary.Read(r, binary.LittleEndian, &magic); err != nil {
		return nil, err
	}
	if magic != MagicNumber {
		return nil, ErrInvalidMagic
	}

	header := &GraphHeader{}

	// Read metadata
	if err := binary.Read(r, binary.LittleEndian, &header.Meta); err != nil {
		return nil, err
	}

	// Read block size
	if err := binary.Read(r, binary.LittleEndian, &header.BlockSize); err != nil {
		return nil, err
	}

	// Read version
	if err := binary.Read(r, binary.LittleEndian, &header.Version); err != nil {
		return nil, err
	}

	// Validate version compatibility
	if header.Version.Major > CurrentMajorVersion {
		return nil, ErrVersionMismatch
	}

	return header, nil
}

// ============================================================================
// Node Parsing Functions
// ============================================================================

// ParseNeighborsFromBuffer extracts the neighbor list from a node data buffer.
//
// Node layout: [Vector (dims*4 bytes)][NumNeighbors (4 bytes)][NeighborIDs (N*4 bytes)]
//
// Parameters:
//   - data: raw node data buffer
//   - dims: vector dimension (used to calculate neighbor list offset)
//
// Returns neighbor ID slice, or ErrCorruptedFile if buffer is too small.
func ParseNeighborsFromBuffer(data []byte, dims int) ([]uint32, error) {
	vectorBytes := dims * 4
	minRequired := vectorBytes + 4 // vector + neighbor count

	if len(data) < minRequired {
		return nil, ErrCorruptedFile
	}

	// Read neighbor count
	numNeighbors := binary.LittleEndian.Uint32(data[vectorBytes:])
	neighborStart := vectorBytes + 4

	// Validate buffer has enough space for all neighbors
	if len(data) < neighborStart+int(numNeighbors)*4 {
		return nil, ErrCorruptedFile
	}

	// Parse neighbor IDs
	neighbors := make([]uint32, numNeighbors)
	for i := uint32(0); i < numNeighbors; i++ {
		offset := neighborStart + int(i)*4
		neighbors[i] = binary.LittleEndian.Uint32(data[offset:])
	}

	return neighbors, nil
}

// ParseVectorFromBuffer extracts the vector from a node data buffer.
//
// Node layout: [Vector (dims*4 bytes)][...]
//
// Parameters:
//   - data: raw node data buffer
//   - dims: expected vector dimension
//
// Returns float32 slice, or ErrCorruptedFile if buffer is too small.
func ParseVectorFromBuffer(data []byte, dims int) ([]float32, error) {
	vectorBytes := dims * 4

	if len(data) < vectorBytes {
		return nil, ErrCorruptedFile
	}

	// Parse vector components
	vector := make([]float32, dims)
	for i := 0; i < dims; i++ {
		offset := i * 4
		vector[i] = math.Float32frombits(binary.LittleEndian.Uint32(data[offset:]))
	}

	return vector, nil
}

// ============================================================================
// Node Serialization Functions
// ============================================================================

// SerializeNode serializes a node (vector + neighbors) into a byte slice.
//
// Output layout:
//   - Vector: float32[dims] (dims * 4 bytes)
//   - NumNeighbors: uint32 (4 bytes)
//   - NeighborIDs: uint32[maxDegree] (maxDegree * 4 bytes)
//
// Unused neighbor slots are filled with 0xFFFFFFFF.
//
// Parameters:
//   - vector: the node's vector
//   - neighbors: the node's neighbor IDs
//   - maxDegree: maximum number of neighbors (determines fixed size)
//
// Returns serialized byte slice with fixed length: dims*4 + 4 + maxDegree*4
func SerializeNode(vector []float32, neighbors []uint32, maxDegree int) []byte {
	dims := len(vector)
	nodeLen := dims*4 + 4 + maxDegree*4
	data := make([]byte, nodeLen)
	offset := 0

	// Write vector
	for _, v := range vector {
		binary.LittleEndian.PutUint32(data[offset:], math.Float32bits(v))
		offset += 4
	}

	// Write neighbor count
	binary.LittleEndian.PutUint32(data[offset:], uint32(len(neighbors)))
	offset += 4

	// Write neighbor IDs
	for _, id := range neighbors {
		binary.LittleEndian.PutUint32(data[offset:], id)
		offset += 4
	}

	// Fill unused slots with sentinel value
	for i := len(neighbors); i < maxDegree; i++ {
		binary.LittleEndian.PutUint32(data[offset:], 0xFFFFFFFF)
		offset += 4
	}

	return data
}

// ============================================================================
// Deleted Bitmap
// ============================================================================

// DeletedBitmap tracks deleted nodes using a bit vector.
//
// Each bit represents a node: 1 = deleted, 0 = active.
// Thread-safe for concurrent access.
type DeletedBitmap struct {
	bits  []uint64 // bit vector, each uint64 holds 64 node states
	dirty bool     // true if there are unpersisted modifications
	mu    sync.RWMutex
}

// NewDeletedBitmap creates a new empty DeletedBitmap.
func NewDeletedBitmap() *DeletedBitmap {
	return &DeletedBitmap{
		bits:  make([]uint64, 0),
		dirty: false,
	}
}

// NewDeletedBitmapWithCapacity creates a DeletedBitmap with pre-allocated capacity.
//
// Parameters:
//   - capacity: number of nodes to support (will allocate ceil(capacity/64) uint64s)
func NewDeletedBitmapWithCapacity(capacity uint64) *DeletedBitmap {
	wordCount := (capacity + 63) / 64
	return &DeletedBitmap{
		bits:  make([]uint64, wordCount),
		dirty: false,
	}
}

// MarkDeleted marks a node as deleted.
//
// Automatically expands the bitmap if nodeID exceeds current capacity.
// Thread-safe.
//
// Parameters:
//   - nodeID: the node ID to mark as deleted
func (b *DeletedBitmap) MarkDeleted(nodeID uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	wordIndex := nodeID / 64
	bitIndex := nodeID % 64

	// Expand if necessary
	if wordIndex >= uint64(len(b.bits)) {
		newBits := make([]uint64, wordIndex+1)
		copy(newBits, b.bits)
		b.bits = newBits
	}

	b.bits[wordIndex] |= (1 << bitIndex)
	b.dirty = true
}

// IsDeleted checks if a node is marked as deleted.
//
// Thread-safe.
//
// Parameters:
//   - nodeID: the node ID to check
//
// Returns true if the node is deleted, false otherwise.
func (b *DeletedBitmap) IsDeleted(nodeID uint64) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()

	wordIndex := nodeID / 64
	bitIndex := nodeID % 64

	if wordIndex >= uint64(len(b.bits)) {
		return false
	}

	return (b.bits[wordIndex] & (1 << bitIndex)) != 0
}

// IsDeletedUnsafe checks if a node is marked as deleted without acquiring locks.
//
// NOT thread-safe. Caller must ensure exclusive access (e.g., by holding a global write lock).
// This is the equivalent of C++ DiskANN's _delete_set->find() which is a simple hash lookup
// without synchronization, used in inplace_delete where the caller holds _update_lock.
func (b *DeletedBitmap) IsDeletedUnsafe(nodeID uint64) bool {
	wordIndex := nodeID / 64
	bitIndex := nodeID % 64

	if wordIndex >= uint64(len(b.bits)) {
		return false
	}

	return (b.bits[wordIndex] & (1 << bitIndex)) != 0
}

// CountDeleted returns the total number of deleted nodes.
//
// Thread-safe.
func (b *DeletedBitmap) CountDeleted() uint64 {
	b.mu.RLock()
	defer b.mu.RUnlock()

	var count uint64
	for _, word := range b.bits {
		count += uint64(bits.OnesCount64(word))
	}
	return count
}

// IsDirty returns true if there are unpersisted modifications.
//
// Thread-safe.
func (b *DeletedBitmap) IsDirty() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.dirty
}

// ClearDirty clears the dirty flag (typically after successful persistence).
//
// Thread-safe.
func (b *DeletedBitmap) ClearDirty() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.dirty = false
}

// ============================================================================
// Deleted Bitmap Persistence
// ============================================================================

// deletedBitmapHeader defines the file header for deleted bitmap files.
//
// Layout:
//   - Magic: uint32 (4 bytes) - DeletedBitmapMagic
//   - Version: uint32 (4 bytes) - currently 1
//   - BitCount: uint64 (8 bytes) - total number of bits (not words)
//   - Data: []uint64 - the actual bitmap data
const deletedBitmapHeaderSize = 16 // 4 + 4 + 8

// SaveDeletedBitmap persists a DeletedBitmap to a file.
//
// File format:
//   - Magic number (4 bytes): 0x44454C42 ("DELB")
//   - Version (4 bytes): 1
//   - Bit count (8 bytes): total bits = len(bits) * 64
//   - Bitmap data: []uint64
//
// Parameters:
//   - path: destination file path
//   - bitmap: the bitmap to save
//
// Returns error if file creation or write fails.
func SaveDeletedBitmap(path string, bitmap *DeletedBitmap) error {
	bitmap.mu.RLock()
	defer bitmap.mu.RUnlock()

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// Write magic number
	if err := binary.Write(f, binary.LittleEndian, DeletedBitmapMagic); err != nil {
		return err
	}

	// Write version
	if err := binary.Write(f, binary.LittleEndian, uint32(1)); err != nil {
		return err
	}

	// Write bit count (total bits, not words)
	bitCount := uint64(len(bitmap.bits)) * 64
	if err := binary.Write(f, binary.LittleEndian, bitCount); err != nil {
		return err
	}

	// Write bitmap data
	for _, word := range bitmap.bits {
		if err := binary.Write(f, binary.LittleEndian, word); err != nil {
			return err
		}
	}

	// Ensure data is flushed to disk
	return f.Sync()
}

// LoadDeletedBitmap loads a DeletedBitmap from a file.
//
// If the file does not exist, returns an empty bitmap (not an error).
//
// Parameters:
//   - path: source file path
//
// Returns the loaded bitmap, or error if:
//   - File read fails (except not found)
//   - File is corrupted (too small)
//   - Magic number is invalid
func LoadDeletedBitmap(path string) (*DeletedBitmap, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, return empty bitmap
			return NewDeletedBitmap(), nil
		}
		return nil, err
	}

	// Validate minimum size
	if len(data) < deletedBitmapHeaderSize {
		return nil, ErrCorruptedFile
	}

	// Validate magic number
	magic := binary.LittleEndian.Uint32(data[0:4])
	if magic != DeletedBitmapMagic {
		return nil, ErrInvalidMagic
	}

	// Read version (currently unused, but validate it exists)
	// version := binary.LittleEndian.Uint32(data[4:8])

	// Read bit count
	bitCount := binary.LittleEndian.Uint64(data[8:16])
	wordCount := (bitCount + 63) / 64

	// Validate data size
	expectedSize := deletedBitmapHeaderSize + int(wordCount)*8
	if len(data) < expectedSize {
		return nil, ErrCorruptedFile
	}

	// Parse bitmap data
	bitmap := &DeletedBitmap{
		bits:  make([]uint64, wordCount),
		dirty: false,
	}

	for i := uint64(0); i < wordCount; i++ {
		offset := deletedBitmapHeaderSize + int(i)*8
		bitmap.bits[i] = binary.LittleEndian.Uint64(data[offset:])
	}

	return bitmap, nil
}
