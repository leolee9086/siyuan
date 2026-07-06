//go:build ios || android

package storage

// OpenReader opens a disk index reader using platform-specific buffered implementation.
//
// This is the public entry point for opening disk indexes on mobile (iOS, Android).
// Uses buffered read + LRU cache for resource-constrained devices.
//
// Parameters:
//   - path: index file path
//   - readOnly: true for read-only mode, false for read-write mode
//
// Returns DiskIndexReader interface implementation.
// Returns ErrFileNotFound if file does not exist.
func OpenReader(path string, readOnly bool) (DiskIndexReader, error) {
	return platformOpenReader(path, readOnly)
}
