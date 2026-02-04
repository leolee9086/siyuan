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
	// 注意：为了方便 garbage collection 和内存管理，这里还是使用切片切分
	// 如果内存压力大，可以改为一维大数组
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
