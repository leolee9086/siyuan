// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// 本文件由 kernel/vectordb/dataset_loader_test.go 移植。
// 提供 SIFT/GIST 数据集 fvecs/ivecs 格式的加载函数，供真实数据规模测试使用。

package vectordb

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os"
)

// loadFvecs 读取 fvecs 格式文件 (SIFT1M/GIST1M) - Optimized
// Format: <d(int32)> <float32>...<float32>
func loadFvecs(path string) ([][]float32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	// 预读文件大小以估算容量
	fi, err := f.Stat()
	if err != nil {
		return nil, 0, err
	}
	fileSize := fi.Size()

	// 读取第一个维度
	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	f.Seek(0, 0) // 重置

	dim := int(firstDim)
	rowBytes := 4 + dim*4
	numVectors := int(fileSize / int64(rowBytes))

	// 预分配所有内存以减少 GC
	vectors := make([][]float32, 0, numVectors)

	reader := bufio.NewReaderSize(f, 16*1024*1024) // 16MB Buffer
	buf := make([]byte, rowBytes)

	for {
		if _, err := io.ReadFull(reader, buf); err != nil {
			if err == io.EOF {
				break
			}
			return nil, 0, err
		}

		d := int32(binary.LittleEndian.Uint32(buf[0:4]))
		if int(d) != dim {
			return nil, 0, fmt.Errorf("dimension mismatch: expected %d, got %d", dim, d)
		}

		vec := make([]float32, dim)
		for i := 0; i < dim; i++ {
			bits := binary.LittleEndian.Uint32(buf[4+i*4:])
			vec[i] = math.Float32frombits(bits)
		}
		vectors = append(vectors, vec)
	}

	return vectors, dim, nil
}

// loadIvecs 读取 ivecs 格式文件 (Ground Truth) - Optimized
// Format: <d(int32)> <int32>...<int32>
func loadIvecs(path string) ([][]int32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return nil, 0, err
	}
	fileSize := fi.Size()

	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	f.Seek(0, 0)

	dim := int(firstDim)
	rowBytes := 4 + dim*4
	numVectors := int(fileSize / int64(rowBytes))

	vectors := make([][]int32, 0, numVectors)
	reader := bufio.NewReaderSize(f, 4*1024*1024)
	buf := make([]byte, rowBytes)

	for {
		if _, err := io.ReadFull(reader, buf); err != nil {
			if err == io.EOF {
				break
			}
			return nil, 0, err
		}

		d := int32(binary.LittleEndian.Uint32(buf[0:4]))
		if int(d) != dim {
			return nil, 0, fmt.Errorf("dimension mismatch: expected %d, got %d", dim, d)
		}

		vec := make([]int32, dim)
		for i := 0; i < dim; i++ {
			vec[i] = int32(binary.LittleEndian.Uint32(buf[4+i*4:]))
		}
		vectors = append(vectors, vec)
	}

	return vectors, dim, nil
}
