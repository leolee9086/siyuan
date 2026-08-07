package main

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
)

const (
	fnvOffset64 = uint64(14695981039346656037)
	fnvPrime64  = uint64(1099511628211)
)

type accumulator struct {
	root       string
	withDigest bool
	entries    atomic.Uint64
	files      atomic.Uint64
	dirs       atomic.Uint64
	errors     atomic.Uint64
	digestXOR  atomic.Uint64
	digestSum  atomic.Uint64
}

func newAccumulator(root string, withDigest bool) *accumulator {
	return &accumulator{root: filepath.Clean(root), withDigest: withDigest}
}

func (a *accumulator) addAbsolute(path string, isDir bool) {
	clean := filepath.Clean(path)
	if sameBenchmarkPath(clean, a.root) {
		return
	}
	relative := ""
	if a.withDigest {
		value, err := filepath.Rel(a.root, clean)
		if err == nil {
			relative = filepath.ToSlash(value)
		}
	}
	a.add(relative, isDir)
}

func (a *accumulator) addRelative(relative string, isDir bool) {
	if relative == "" || relative == "." {
		return
	}
	a.add(filepath.ToSlash(relative), isDir)
}

func (a *accumulator) add(relative string, isDir bool) {
	a.entries.Add(1)
	if isDir {
		a.dirs.Add(1)
	} else {
		a.files.Add(1)
	}
	if !a.withDigest || relative == "" {
		return
	}
	hash := hashBenchmarkPath(relative)
	for {
		current := a.digestXOR.Load()
		if a.digestXOR.CompareAndSwap(current, current^hash) {
			break
		}
	}
	a.digestSum.Add(hash)
}

func (a *accumulator) addError() {
	a.errors.Add(1)
}

func (a *accumulator) snapshot(errorsKnown bool) snapshot {
	result := snapshot{
		Entries: a.entries.Load(), Files: a.files.Load(), Directories: a.dirs.Load(),
		Errors: a.errors.Load(), ErrorsKnown: errorsKnown,
	}
	if a.withDigest {
		result.Digest = fmt.Sprintf("%016x:%016x", a.digestXOR.Load(), a.digestSum.Load())
	}
	return result
}

func hashBenchmarkPath(path string) uint64 {
	hash := fnvOffset64
	for index := 0; index < len(path); index++ {
		hash ^= uint64(path[index])
		hash *= fnvPrime64
	}
	return hash
}

func sameBenchmarkPath(left, right string) bool {
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		return strings.EqualFold(left, right)
	}
	return left == right
}
