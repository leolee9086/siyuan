//go:build windows

package fswalk

import "context"

func readGrepDirectorySnapshot(ctx context.Context, directory string) ([]Metadata, error) {
	return readDirectorySnapshotContext(ctx, directory)
}
