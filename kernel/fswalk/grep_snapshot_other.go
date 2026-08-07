//go:build !windows

package fswalk

import (
	"context"
	"os"
	"strings"
)

func readGrepDirectorySnapshot(ctx context.Context, directory string) ([]Metadata, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	items, err := os.ReadDir(directory)
	if err != nil {
		return nil, err
	}
	entries := make([]Metadata, 0, len(items))
	for _, item := range items {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		mode := item.Type()
		entries = append(entries, Metadata{
			Name: item.Name(), IsDir: item.IsDir(), IsSymlink: mode&os.ModeSymlink != 0,
			IsRegular: mode.IsRegular(), Hidden: strings.HasPrefix(item.Name(), "."),
		})
	}
	return entries, nil
}
