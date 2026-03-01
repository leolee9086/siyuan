# 向量数据库基准测试数据集

本文档描述用于向量数据库性能测试的标准数据集，包括下载方式、格式说明和加载代码示例。

## 推荐数据集

### 1. SIFT1M（首选）

| 属性 | 值 |
|------|-----|
| 维度 | 128 |
| 基础向量数 | 1,000,000 |
| 查询向量数 | 10,000 |
| 训练向量数 | 100,000 |
| 文件格式 | fvecs/ivecs |
| 总大小 | ~500MB |

**特点**：
- 业界最广泛使用的基准数据集
- 128维适合测试各种量化方案
- 包含标准ground truth便于验证召回率

**下载地址**：
- 官方：http://corpus-texmex.irisa.fr/
- 直接链接：ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz

### 2. GIST1M

| 属性 | 值 |
|------|-----|
| 维度 | 960 |
| 基础向量数 | 1,000,000 |
| 查询向量数 | 1,000 |
| 训练向量数 | 500,000 |
| 文件格式 | fvecs/ivecs |
| 总大小 | ~4GB |

**特点**：
- 高维度测试场景
- 适合评估维度对性能的影响
- 更接近实际图像特征维度

**下载地址**：
- 官方：http://corpus-texmex.irisa.fr/
- 直接链接：ftp://ftp.irisa.fr/local/texmex/corpus/gist.tar.gz

### 3. GloVe（文本嵌入）

| 属性 | 值 |
|------|-----|
| 维度 | 25/50/100/200 |
| 向量数 | 1,183,514 |
| 文件格式 | txt (空格分隔) |
| 总大小 | ~200MB-2GB |

**特点**：
- 真实的词向量数据
- 多种维度可选
- 适合文本检索场景测试

**下载地址**：
- 官方：https://nlp.stanford.edu/projects/glove/
- ann-benchmarks格式：https://github.com/erikbern/ann-benchmarks

### 4. Deep1M/Deep1B

| 属性 | Deep1M | Deep1B |
|------|--------|--------|
| 维度 | 96 | 96 |
| 基础向量数 | 1,000,000 | 1,000,000,000 |
| 查询向量数 | 10,000 | 10,000 |
| 文件格式 | fvecs | fvecs |

**特点**：
- 深度学习图像特征
- Deep1B适合十亿级测试
- 96维是常见的嵌入维度

**下载地址**：
- https://research.yandex.com/datasets/biganns

## 文件格式说明

### fvecs 格式（浮点向量）

```
[4字节: 维度d][d*4字节: float32向量数据]
[4字节: 维度d][d*4字节: float32向量数据]
...
```

每个向量前有4字节的维度信息（int32），后跟d个float32值。

### ivecs 格式（整数向量）

```
[4字节: 维度d][d*4字节: int32向量数据]
[4字节: 维度d][d*4字节: int32向量数据]
...
```

用于存储ground truth的近邻ID列表。

### bvecs 格式（字节向量）

```
[4字节: 维度d][d字节: uint8向量数据]
[4字节: 维度d][d字节: uint8向量数据]
...
```

用于存储量化后的向量或原始字节特征。

## 存储位置

```
test_data/
├── sift/
│   ├── sift_base.fvecs      # 基础向量 (100万)
│   ├── sift_query.fvecs     # 查询向量 (1万)
│   ├── sift_learn.fvecs     # 训练向量 (10万)
│   └── sift_groundtruth.ivecs  # 真实近邻
├── gist/
│   ├── gist_base.fvecs
│   ├── gist_query.fvecs
│   ├── gist_learn.fvecs
│   └── gist_groundtruth.ivecs
└── glove/
    └── glove.twitter.27B.100d.txt
```

## Go 数据加载代码

### fvecs 读取器

```go
package benchmark

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

// FvecsReader 读取 fvecs 格式文件
type FvecsReader struct {
	file *os.File
	dim  int
}

// NewFvecsReader 创建 fvecs 读取器
func NewFvecsReader(path string) (*FvecsReader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open fvecs file: %w", err)
	}

	// 读取第一个向量的维度
	var dim int32
	if err := binary.Read(f, binary.LittleEndian, &dim); err != nil {
		f.Close()
		return nil, fmt.Errorf("read dimension: %w", err)
	}

	// 重置到文件开头
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		f.Close()
		return nil, fmt.Errorf("seek to start: %w", err)
	}

	return &FvecsReader{
		file: f,
		dim:  int(dim),
	}, nil
}

// Dimension 返回向量维度
func (r *FvecsReader) Dimension() int {
	return r.dim
}

// ReadVector 读取单个向量
func (r *FvecsReader) ReadVector() ([]float32, error) {
	var dim int32
	if err := binary.Read(r.file, binary.LittleEndian, &dim); err != nil {
		if err == io.EOF {
			return nil, io.EOF
		}
		return nil, fmt.Errorf("read dimension: %w", err)
	}

	vec := make([]float32, dim)
	if err := binary.Read(r.file, binary.LittleEndian, vec); err != nil {
		return nil, fmt.Errorf("read vector data: %w", err)
	}

	return vec, nil
}

// ReadAll 读取所有向量
func (r *FvecsReader) ReadAll() ([][]float32, error) {
	var vectors [][]float32
	for {
		vec, err := r.ReadVector()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		vectors = append(vectors, vec)
	}
	return vectors, nil
}

// ReadBatch 批量读取向量
func (r *FvecsReader) ReadBatch(count int) ([][]float32, error) {
	vectors := make([][]float32, 0, count)
	for i := 0; i < count; i++ {
		vec, err := r.ReadVector()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		vectors = append(vectors, vec)
	}
	return vectors, nil
}

// Close 关闭文件
func (r *FvecsReader) Close() error {
	return r.file.Close()
}
```

### ivecs 读取器（Ground Truth）

```go
// IvecsReader 读取 ivecs 格式文件
type IvecsReader struct {
	file *os.File
	k    int // 每个查询的近邻数
}

// NewIvecsReader 创建 ivecs 读取器
func NewIvecsReader(path string) (*IvecsReader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open ivecs file: %w", err)
	}

	var k int32
	if err := binary.Read(f, binary.LittleEndian, &k); err != nil {
		f.Close()
		return nil, fmt.Errorf("read k: %w", err)
	}

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		f.Close()
		return nil, fmt.Errorf("seek to start: %w", err)
	}

	return &IvecsReader{
		file: f,
		k:    int(k),
	}, nil
}

// K 返回每个查询的近邻数
func (r *IvecsReader) K() int {
	return r.k
}

// ReadNeighbors 读取单个查询的近邻ID列表
func (r *IvecsReader) ReadNeighbors() ([]int32, error) {
	var k int32
	if err := binary.Read(r.file, binary.LittleEndian, &k); err != nil {
		if err == io.EOF {
			return nil, io.EOF
		}
		return nil, fmt.Errorf("read k: %w", err)
	}

	neighbors := make([]int32, k)
	if err := binary.Read(r.file, binary.LittleEndian, neighbors); err != nil {
		return nil, fmt.Errorf("read neighbors: %w", err)
	}

	return neighbors, nil
}

// ReadAll 读取所有查询的近邻
func (r *IvecsReader) ReadAll() ([][]int32, error) {
	var groundTruth [][]int32
	for {
		neighbors, err := r.ReadNeighbors()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		groundTruth = append(groundTruth, neighbors)
	}
	return groundTruth, nil
}

// Close 关闭文件
func (r *IvecsReader) Close() error {
	return r.file.Close()
}
```

### 使用示例

```go
package main

import (
	"fmt"
	"log"
	"path/filepath"
)

func main() {
	dataDir := "test_data/sift"

	// 加载基础向量
	baseReader, err := NewFvecsReader(filepath.Join(dataDir, "sift_base.fvecs"))
	if err != nil {
		log.Fatal(err)
	}
	defer baseReader.Close()

	fmt.Printf("向量维度: %d\n", baseReader.Dimension())

	// 批量读取
	vectors, err := baseReader.ReadBatch(1000)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("读取向量数: %d\n", len(vectors))

	// 加载查询向量
	queryReader, err := NewFvecsReader(filepath.Join(dataDir, "sift_query.fvecs"))
	if err != nil {
		log.Fatal(err)
	}
	defer queryReader.Close()

	queries, err := queryReader.ReadAll()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("查询向量数: %d\n", len(queries))

	// 加载 ground truth
	gtReader, err := NewIvecsReader(filepath.Join(dataDir, "sift_groundtruth.ivecs"))
	if err != nil {
		log.Fatal(err)
	}
	defer gtReader.Close()

	groundTruth, err := gtReader.ReadAll()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Ground truth 条目数: %d, 每条近邻数: %d\n", 
		len(groundTruth), gtReader.K())
}
```

### 召回率计算

```go
// ComputeRecall 计算召回率
// results: 搜索返回的ID列表
// groundTruth: 真实近邻ID列表
// k: 评估的近邻数
func ComputeRecall(results []int32, groundTruth []int32, k int) float64 {
	if k > len(groundTruth) {
		k = len(groundTruth)
	}
	if k > len(results) {
		k = len(results)
	}

	// 构建 ground truth 集合
	gtSet := make(map[int32]struct{}, k)
	for i := 0; i < k; i++ {
		gtSet[groundTruth[i]] = struct{}{}
	}

	// 计算命中数
	hits := 0
	for i := 0; i < k; i++ {
		if _, ok := gtSet[results[i]]; ok {
			hits++
		}
	}

	return float64(hits) / float64(k)
}

// ComputeAverageRecall 计算平均召回率
func ComputeAverageRecall(
	allResults [][]int32,
	allGroundTruth [][]int32,
	k int,
) float64 {
	if len(allResults) != len(allGroundTruth) {
		panic("results and ground truth length mismatch")
	}

	var totalRecall float64
	for i := range allResults {
		totalRecall += ComputeRecall(allResults[i], allGroundTruth[i], k)
	}

	return totalRecall / float64(len(allResults))
}
```

## 数据下载脚本

```bash
#!/bin/bash
# download_sift.sh - 下载 SIFT1M 数据集

DATA_DIR="test_data/sift"
mkdir -p "$DATA_DIR"

echo "下载 SIFT1M 数据集..."
wget -c ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz -O /tmp/sift.tar.gz

echo "解压数据..."
tar -xzf /tmp/sift.tar.gz -C "$DATA_DIR" --strip-components=1

echo "完成！文件列表："
ls -lh "$DATA_DIR"
```

## 参考资源

- [Texmex Corpus](http://corpus-texmex.irisa.fr/) - SIFT/GIST 官方来源
- [ann-benchmarks](https://github.com/erikbern/ann-benchmarks) - ANN 算法基准测试框架
- [Big-ANN Benchmarks](https://big-ann-benchmarks.com/) - 十亿级数据集基准
- [Yandex Research Datasets](https://research.yandex.com/datasets/biganns) - Deep1B 等大规模数据集
