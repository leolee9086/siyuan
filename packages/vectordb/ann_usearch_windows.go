//go:build usearch_bench && windows && cgo

package vectordb

/*
#cgo CFLAGS: -I${SRCDIR}/../../test_data/usearch-src-v2.22.0/c
#cgo LDFLAGS: -L${SRCDIR}/../../test_data/usearch-v2.22.0 -lusearch_c
#include "usearch.h"
*/
import "C"

import (
	"fmt"
	"time"
	"unsafe"
)

const annUSearchVersion = "2.22.0"

type annUSearchIndex struct {
	handle C.usearch_index_t
}

type annUSearchBuild struct {
	index            *annUSearchIndex
	duration         time.Duration
	vectorsPerSecond float64
	memoryBytes      uint64
	serializedBytes  uint64
	hardware         string
}

func newANNUSearchIndex(dimension, capacity int) (*annUSearchIndex, error) {
	if version := C.GoString(C.usearch_version()); version != annUSearchVersion {
		return nil, fmt.Errorf("USearch ABI 版本不匹配：期望 %s，实际 %s", annUSearchVersion, version)
	}
	options := C.usearch_init_options_t{
		metric_kind:      C.usearch_metric_l2sq_k,
		quantization:     C.usearch_scalar_f32_k,
		dimensions:       C.size_t(dimension),
		connectivity:     16,
		expansion_add:    200,
		expansion_search: 200,
	}
	var message C.usearch_error_t
	handle := C.usearch_init(&options, &message)
	if err := annUSearchError(message); err != nil {
		return nil, err
	}
	index := &annUSearchIndex{handle: handle}
	C.usearch_reserve(handle, C.size_t(capacity), &message)
	if err := annUSearchError(message); err != nil {
		_ = index.close()
		return nil, err
	}
	return index, nil
}

func buildANNUSearch(base [][]float32) (annUSearchBuild, error) {
	index, err := newANNUSearchIndex(len(base[0]), len(base))
	if err != nil {
		return annUSearchBuild{}, err
	}
	started := time.Now()
	for id, vector := range base {
		if err := index.add(uint64(id), vector); err != nil {
			_ = index.close()
			return annUSearchBuild{}, fmt.Errorf("USearch 添加向量 %d：%w", id, err)
		}
	}
	duration := time.Since(started)
	memoryBytes, err := index.memoryUsage()
	if err != nil {
		_ = index.close()
		return annUSearchBuild{}, err
	}
	serializedBytes, err := index.serializedLength()
	if err != nil {
		_ = index.close()
		return annUSearchBuild{}, err
	}
	hardware, err := index.hardwareAcceleration()
	if err != nil {
		_ = index.close()
		return annUSearchBuild{}, err
	}
	return annUSearchBuild{
		index:            index,
		duration:         duration,
		vectorsPerSecond: float64(len(base)) / duration.Seconds(),
		memoryBytes:      memoryBytes,
		serializedBytes:  serializedBytes,
		hardware:         hardware,
	}, nil
}

func (index *annUSearchIndex) add(key uint64, vector []float32) error {
	var message C.usearch_error_t
	C.usearch_add(index.handle, C.usearch_key_t(key), unsafe.Pointer(&vector[0]), C.usearch_scalar_f32_k, &message)
	return annUSearchError(message)
}

func (index *annUSearchIndex) setExpansionSearch(expansion int) error {
	var message C.usearch_error_t
	C.usearch_change_expansion_search(index.handle, C.size_t(expansion), &message)
	return annUSearchError(message)
}

func (index *annUSearchIndex) search(query []float32, k int) ([]uint64, error) {
	keys := make([]C.usearch_key_t, k)
	distances := make([]C.usearch_distance_t, k)
	var message C.usearch_error_t
	count := C.usearch_search(index.handle, unsafe.Pointer(&query[0]), C.usearch_scalar_f32_k, C.size_t(k), &keys[0], &distances[0], &message)
	if err := annUSearchError(message); err != nil {
		return nil, err
	}
	result := make([]uint64, int(count))
	for i := range result {
		result[i] = uint64(keys[i])
	}
	return result, nil
}

func (index *annUSearchIndex) memoryUsage() (uint64, error) {
	var message C.usearch_error_t
	value := C.usearch_memory_usage(index.handle, &message)
	return uint64(value), annUSearchError(message)
}

func (index *annUSearchIndex) serializedLength() (uint64, error) {
	var message C.usearch_error_t
	value := C.usearch_serialized_length(index.handle, &message)
	return uint64(value), annUSearchError(message)
}

func (index *annUSearchIndex) hardwareAcceleration() (string, error) {
	var message C.usearch_error_t
	value := C.usearch_hardware_acceleration(index.handle, &message)
	if err := annUSearchError(message); err != nil {
		return "", err
	}
	return C.GoString(value), nil
}

func (index *annUSearchIndex) close() error {
	if index == nil || index.handle == nil {
		return nil
	}
	var message C.usearch_error_t
	C.usearch_free(index.handle, &message)
	index.handle = nil
	return annUSearchError(message)
}

func annUSearchError(message C.usearch_error_t) error {
	if message == nil {
		return nil
	}
	return fmt.Errorf("USearch：%s", C.GoString(message))
}
