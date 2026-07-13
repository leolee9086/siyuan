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

package vamana

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/storage"
)

func TestDiskBuilderReusesGraphBBQWithoutChangingCodes(t *testing.T) {
	const (
		count     = 128
		dimension = 64
	)
	vectors := make([][]float32, count)
	for vectorIndex := range vectors {
		vector := make([]float32, dimension)
		for dimensionIndex := range vector {
			vector[dimensionIndex] = float32((vectorIndex+1)*(dimensionIndex+5)%97) / 97
		}
		vectors[vectorIndex] = vector
	}
	config := DefaultDiskBuildConfig()
	config.BuildSeed = 1
	config.NumWorkers = 2
	builder := &diskBuilder{vectors: vectors, dimension: dimension, config: config}
	if err := builder.buildGraph(); err != nil {
		t.Fatal(err)
	}
	expected := &diskBuilder{vectors: vectors, dimension: dimension, config: config}
	expected.computeBBQData()
	if !reflect.DeepEqual(builder.bbqCentroid, expected.bbqCentroid) ||
		!reflect.DeepEqual(builder.bbqPacked, expected.bbqPacked) ||
		!reflect.DeepEqual(builder.bbqLowerBounds, expected.bbqLowerBounds) ||
		!reflect.DeepEqual(builder.bbqUpperBounds, expected.bbqUpperBounds) ||
		!reflect.DeepEqual(builder.bbqCorrections, expected.bbqCorrections) ||
		!reflect.DeepEqual(builder.bbqQuantizedSums, expected.bbqQuantizedSums) {
		t.Fatal("复用的图构建 BBQ 数据与磁盘 builder 重新量化结果不一致")
	}
}

// ============================================================================
// BuildFromVectors Tests - Using SIFT Dataset
// ============================================================================

// TestBuildFromVectors_SIFT tests BuildFromVectors with real SIFT dataset
func TestBuildFromVectors_SIFT(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	// Load 1000 vectors from SIFT dataset for testing
	numVectors := 1000
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load SIFT vectors: %v", err)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_sift")

	// Build index
	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 64

	result, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	// Verify result
	if result.NumPoints != uint64(numVectors) {
		t.Errorf("NumPoints mismatch: expected %d, got %d", numVectors, result.NumPoints)
	}
	if result.Dimension != dim {
		t.Errorf("Dimension mismatch: expected %d, got %d", dim, result.Dimension)
	}
	if result.Medoid >= uint64(numVectors) {
		t.Errorf("Invalid medoid: %d (should be < %d)", result.Medoid, numVectors)
	}
	if !result.BBQEnabled {
		t.Error("BBQ should be enabled for SIFT dimension (128)")
	}

	// Verify files exist
	indexPath := basePath + diskIndexExt
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		t.Error("Index file was not created")
	}

	bbqPath := basePath + diskBBQExt
	if _, err := os.Stat(bbqPath); os.IsNotExist(err) {
		t.Error("BBQ file was not created")
	}

	t.Logf("SIFT Build result: NumPoints=%d, Dimension=%d, Medoid=%d, MaxDegree=%d, BBQEnabled=%v",
		result.NumPoints, result.Dimension, result.Medoid, result.MaxDegree, result.BBQEnabled)
}

// TestBuildFromVectors_SIFT_LargeScale tests with larger SIFT subset
func TestBuildFromVectors_SIFT_LargeScale(t *testing.T) {
	requireScaleTest(t)

	if testing.Short() {
		t.Skip("Skipping large scale test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	// Load 10000 vectors for larger scale test
	numVectors := 10000
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load SIFT vectors: %v", err)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_sift_large")

	config := DefaultDiskBuildConfig()
	config.R = 64
	config.L = 128
	config.NumWorkers = 4

	result, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	if result.NumPoints != uint64(numVectors) {
		t.Errorf("NumPoints mismatch: expected %d, got %d", numVectors, result.NumPoints)
	}
	if result.Dimension != dim {
		t.Errorf("Dimension mismatch: expected %d, got %d", dim, result.Dimension)
	}

	t.Logf("Large scale SIFT build: NumPoints=%d, Dimension=%d, Medoid=%d, BuildTime included in test duration",
		result.NumPoints, result.Dimension, result.Medoid)
}

// ============================================================================
// Edge Case Tests - Using Constructed Data
// ============================================================================

func TestBuildFromVectors_LowDimension(t *testing.T) {
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_lowdim")

	// Construct low-dimension vectors (BBQ should be disabled)
	numVectors := 50
	dimension := 16 // < BBQEnableThreshold
	vectors := make([][]float32, numVectors)
	for i := 0; i < numVectors; i++ {
		vectors[i] = make([]float32, dimension)
		for j := 0; j < dimension; j++ {
			vectors[i][j] = float32(i*dimension+j) * 0.01
		}
	}

	config := DefaultDiskBuildConfig()
	config.EnableBBQ = false // Explicitly disable

	result, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	if result.BBQEnabled {
		t.Error("BBQ should be disabled for low dimension")
	}

	// BBQ file should not exist
	bbqPath := basePath + diskBBQExt
	if _, err := os.Stat(bbqPath); !os.IsNotExist(err) {
		t.Error("BBQ file should not be created when BBQ is disabled")
	}

	t.Logf("Low-dim build: NumPoints=%d, Dimension=%d, BBQEnabled=%v",
		result.NumPoints, result.Dimension, result.BBQEnabled)
}

func TestBuildFromVectors_EmptyVectors(t *testing.T) {
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_empty")

	vectors := [][]float32{}
	config := DefaultDiskBuildConfig()

	_, err := BuildFromVectors(basePath, vectors, config)
	if err == nil {
		t.Error("Expected error for empty vectors")
	}
}

func TestBuildFromVectors_InconsistentDimension(t *testing.T) {
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_inconsistent")

	vectors := [][]float32{
		{1.0, 2.0, 3.0},
		{1.0, 2.0}, // Different dimension
	}
	config := DefaultDiskBuildConfig()

	_, err := BuildFromVectors(basePath, vectors, config)
	if err == nil {
		t.Error("Expected error for inconsistent dimensions")
	}
}

func TestBuildFromVectors_SingleVector(t *testing.T) {
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_build_single")

	vectors := [][]float32{
		{1.0, 2.0, 3.0, 4.0},
	}
	config := DefaultDiskBuildConfig()
	config.EnableBBQ = false

	result, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	if result.NumPoints != 1 {
		t.Errorf("NumPoints mismatch: expected 1, got %d", result.NumPoints)
	}
	if result.Medoid != 0 {
		t.Errorf("Medoid should be 0 for single vector, got %d", result.Medoid)
	}
}

// TestSetNeighborsLockedPreservesConcurrentBackedge 验证节点完成自身邻居构建时不丢失其他工作线程已写入的反向边。
func TestSetNeighborsLockedPreservesConcurrentBackedge(t *testing.T) {
	idx := New(1, DefaultConfig())
	idx.initializeForBuild([][]float32{{0}, {1}, {2}})

	idx.setNeighborsLocked(0, []uint32{1})
	idx.addEdgeAndPruneLocked(0, 2)
	idx.setNeighborsLocked(0, []uint32{1})

	neighbors := idx.GetNeighbors(0)
	if !containsID(neighbors, 1) || !containsID(neighbors, 2) {
		t.Fatalf("node neighbors lost during build interleaving: got %v, want both 1 and 2", neighbors)
	}
}

// ============================================================================
// DiskBuildConfig Tests
// ============================================================================

func TestDiskBuildConfig_Validate(t *testing.T) {
	config := DiskBuildConfig{}
	config.Validate(128)

	if config.R != DefaultR {
		t.Errorf("R should default to %d, got %d", DefaultR, config.R)
	}
	if config.L != DefaultL {
		t.Errorf("L should default to %d, got %d", DefaultL, config.L)
	}
	if config.Alpha != DefaultAlpha {
		t.Errorf("Alpha should default to %f, got %f", DefaultAlpha, config.Alpha)
	}
	if config.BlockSize != SectorSize {
		t.Errorf("BlockSize should default to %d, got %d", SectorSize, config.BlockSize)
	}
	if !config.EnableBBQ {
		t.Error("EnableBBQ should be true for dimension >= BBQEnableThreshold")
	}
}

func TestDiskBuildConfig_LConstraint(t *testing.T) {
	config := DiskBuildConfig{
		Config: Config{
			R: 100,
			L: 50, // L < R
		},
	}
	config.Validate(64)

	if config.L < config.R {
		t.Errorf("L should be >= R after validation, got L=%d, R=%d", config.L, config.R)
	}
}

// ============================================================================
// Medoid Computation Tests
// ============================================================================

func TestComputeMedoid(t *testing.T) {
	// Create vectors where the centroid is at origin
	// and one vector is exactly at origin
	vectors := [][]float32{
		{1.0, 0.0},
		{-1.0, 0.0},
		{0.0, 1.0},
		{0.0, -1.0},
		{0.0, 0.0}, // This should be the medoid (closest to centroid)
	}

	builder := &diskBuilder{
		vectors:   vectors,
		dimension: 2,
	}

	medoid := builder.computeMedoid()

	// The centroid is (0, 0), so vector at index 4 should be the medoid
	if medoid != 4 {
		t.Errorf("Expected medoid to be 4, got %d", medoid)
	}
}

func TestComputeMedoid_SingleVector(t *testing.T) {
	vectors := [][]float32{
		{1.0, 2.0, 3.0},
	}

	builder := &diskBuilder{
		vectors:   vectors,
		dimension: 3,
	}

	medoid := builder.computeMedoid()
	if medoid != 0 {
		t.Errorf("Expected medoid to be 0 for single vector, got %d", medoid)
	}
}

func TestComputeMedoid_EmptyVectors(t *testing.T) {
	builder := &diskBuilder{
		vectors:   [][]float32{},
		dimension: 3,
	}

	medoid := builder.computeMedoid()
	if medoid != 0xFFFFFFFF {
		t.Errorf("Expected medoid to be MaxUint32 for empty vectors, got %d", medoid)
	}
}

// ============================================================================
// BBQ Computation Tests
// ============================================================================

func TestComputeBBQData_SIFT(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	// Load 100 vectors from SIFT for BBQ computation test
	numVectors := 100
	vectors, dimension, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load SIFT vectors: %v", err)
	}

	builder := &diskBuilder{
		vectors:   vectors,
		dimension: dimension,
		config: DiskBuildConfig{
			Config:     DefaultConfig(),
			NumWorkers: 4,
			EnableBBQ:  true,
		},
	}

	builder.computeBBQData()

	// Verify BBQ data was computed
	packedSize := (dimension + 7) / 8
	expectedPackedLen := numVectors * packedSize

	if len(builder.bbqPacked) != expectedPackedLen {
		t.Errorf("bbqPacked length mismatch: expected %d, got %d",
			expectedPackedLen, len(builder.bbqPacked))
	}
	if len(builder.bbqLowerBounds) != numVectors {
		t.Errorf("bbqLowerBounds length mismatch: expected %d, got %d",
			numVectors, len(builder.bbqLowerBounds))
	}
	if len(builder.bbqUpperBounds) != numVectors {
		t.Errorf("bbqUpperBounds length mismatch: expected %d, got %d",
			numVectors, len(builder.bbqUpperBounds))
	}
	if len(builder.bbqCorrections) != numVectors {
		t.Errorf("bbqCorrections length mismatch: expected %d, got %d",
			numVectors, len(builder.bbqCorrections))
	}
	if len(builder.bbqQuantizedSums) != numVectors {
		t.Errorf("bbqQuantizedSums length mismatch: expected %d, got %d",
			numVectors, len(builder.bbqQuantizedSums))
	}

	// Verify centroid was computed
	if len(builder.bbqCentroid) != dimension {
		t.Errorf("bbqCentroid length mismatch: expected %d, got %d",
			dimension, len(builder.bbqCentroid))
	}

	// Verify packed codes are not all zeros
	nonZeroCount := 0
	for _, b := range builder.bbqPacked {
		if b != 0 {
			nonZeroCount++
		}
	}
	if nonZeroCount == 0 {
		t.Error("bbqPacked should have some non-zero values")
	}

	t.Logf("BBQ data computed with SIFT: packedSize=%d, nonZeroBytes=%d/%d",
		packedSize, nonZeroCount, len(builder.bbqPacked))
}

// ============================================================================
// Integration Tests
// ============================================================================

func TestBuildFromVectors_CompatibleWithDiskIndex_SIFT(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	// Set up reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "test_compat")

	// Load test vectors from SIFT
	numVectors := 500
	vectors, _, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load SIFT vectors: %v", err)
	}

	// Build index
	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 64

	result, err := BuildFromVectors(basePath, vectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}

	// Try to open with DiskVamanaIndex
	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer idx.Close()

	// Verify metadata matches
	if idx.NumPointsTotal() != result.NumPoints {
		t.Errorf("NumPoints mismatch: build=%d, loaded=%d",
			result.NumPoints, idx.NumPointsTotal())
	}
	if idx.Dimension() != result.Dimension {
		t.Errorf("Dimension mismatch: build=%d, loaded=%d",
			result.Dimension, idx.Dimension())
	}
	if idx.Medoid() != result.Medoid {
		t.Errorf("Medoid mismatch: build=%d, loaded=%d",
			result.Medoid, idx.Medoid())
	}

	// Verify BBQ data was loaded
	if result.BBQEnabled && !idx.HasBBQ() {
		t.Error("BBQ was enabled during build but not loaded")
	}

	t.Logf("Compatibility test passed: NumPoints=%d, Dimension=%d, Medoid=%d",
		idx.NumPointsTotal(), idx.Dimension(), idx.Medoid())
}

// ============================================================================
// BBQ Threshold Test
// ============================================================================

func TestBBQEnableThreshold(t *testing.T) {
	// Test that BBQ is enabled only for dimension >= threshold
	// Using constructed vectors since we need different dimensions
	testCases := []struct {
		dimension int
		expectBBQ bool
	}{
		{32, false},
		{33, true}, // BBQEnableThreshold
		{64, true},
		{128, true},
	}

	for _, tc := range testCases {
		tmpDir := t.TempDir()
		basePath := filepath.Join(tmpDir, "test_threshold")

		// Construct vectors with specific dimension
		numVectors := 50
		vectors := make([][]float32, numVectors)
		for i := 0; i < numVectors; i++ {
			vectors[i] = make([]float32, tc.dimension)
			for j := 0; j < tc.dimension; j++ {
				vectors[i][j] = float32(i*tc.dimension+j) * 0.001
			}
		}

		config := DefaultDiskBuildConfig()

		result, err := BuildFromVectors(basePath, vectors, config)
		if err != nil {
			t.Fatalf("BuildFromVectors failed for dim=%d: %v", tc.dimension, err)
		}

		if result.BBQEnabled != tc.expectBBQ {
			t.Errorf("dim=%d: expected BBQEnabled=%v, got %v",
				tc.dimension, tc.expectBBQ, result.BBQEnabled)
		}
	}
}

// Ensure bbq package constant is accessible
var _ = bbq.BBQEnableThreshold

// ============================================================================
// Recall Tests - Verify BuildFromVectors produces high-quality index
// ============================================================================

// TestBuildFromVectors_Recall_10K tests that BuildFromVectors produces an index
// with acceptable recall rate using SIFT dataset (10K vectors)
// Validates recall >= 70% @ L=50
func TestBuildFromVectors_Recall_10K(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	// Set up reader factory for disk index
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	const numVectors = 10000 // Use 10K vectors
	const numQueries = 100
	const k = 10
	const searchL = 50     // Search list size L=50 as specified
	const rerankFactor = 5 // Expand search candidates for reranking
	const minRecall = 0.95 // Minimum acceptable recall@10 with L=50

	t.Logf("=== BuildFromVectors Recall Test (SIFT %dK) ===", numVectors/1000)

	// Step 1: Load SIFT base vectors
	t.Logf("Step 1: Loading %d base vectors...", numVectors)
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("  Loaded %d vectors, dimension=%d", len(baseVectors), dim)

	// Step 2: Load query vectors
	t.Logf("Step 2: Loading query vectors...")
	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	if len(queryVectors) < numQueries {
		t.Fatalf("Not enough query vectors: got %d, need %d", len(queryVectors), numQueries)
	}
	queryVectors = queryVectors[:numQueries]
	t.Logf("  Using %d query vectors", numQueries)

	// Step 3: Compute ground truth
	t.Logf("Step 3: Computing ground truth (k=%d)...", k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors, k)

	// Step 4: Build disk index using BuildFromVectors
	t.Logf("Step 4: Building disk index with BuildFromVectors...")
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "recall_test_10k_index")

	config := DefaultDiskBuildConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2
	config.NumWorkers = 4

	result, err := BuildFromVectors(basePath, baseVectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}
	t.Logf("  Build completed: NumPoints=%d, Dimension=%d, Medoid=%d, BBQEnabled=%v",
		result.NumPoints, result.Dimension, result.Medoid, result.BBQEnabled)

	// Step 5: Open the disk index
	t.Logf("Step 5: Opening disk index...")
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Failed to open disk index: %v", err)
	}
	defer diskIdx.Close()

	t.Logf("  Index loaded: NumPoints=%d, Dimension=%d, HasBBQ=%v",
		diskIdx.NumPointsTotal(), diskIdx.Dimension(), diskIdx.HasBBQ())

	// Step 6: Execute search and compute recall
	// searchListSize = searchL * rerankFactor for BBQ two-phase search
	searchListSize := searchL * rerankFactor
	t.Logf("Step 6: Computing recall@%d with L=%d, rerankFactor=%d (searchListSize=%d)...", k, searchL, rerankFactor, searchListSize)
	recall := computeDiskAverageRecall(diskIdx, queryVectors, groundTruth, k, searchListSize)
	t.Logf("  Recall@%d (L=%d, rerankFactor=%d): %.2f%%", k, searchL, rerankFactor, recall*100)

	// Step 7: Verify recall meets threshold
	if recall < minRecall {
		t.Errorf("Recall too low: %.2f%%, expected >= %.2f%%", recall*100, minRecall*100)
	}

	t.Logf("\n=== BuildFromVectors Recall Test (10K) Completed ===")
}

// TestBuildFromVectors_Recall_100K tests that BuildFromVectors produces an index
// with acceptable recall rate using SIFT dataset (100K vectors)
func TestBuildFromVectors_Recall_100K(t *testing.T) {
	requireScaleTest(t)

	if testing.Short() {
		t.Skip("Skipping 100K recall test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	// Set up reader factory for disk index
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	const numVectors = 100000 // Use 100K vectors for meaningful recall test
	const numQueries = 100
	const k = 10
	const searchL = 500    // 50x k for high recall at 100K scale
	const minRecall = 0.70 // Minimum acceptable recall@10 with L=500

	t.Logf("=== BuildFromVectors Recall Test (SIFT %dK) ===", numVectors/1000)

	// Step 1: Load SIFT base vectors
	t.Logf("Step 1: Loading %d base vectors...", numVectors)
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("  Loaded %d vectors, dimension=%d", len(baseVectors), dim)

	// Step 2: Load query vectors
	t.Logf("Step 2: Loading query vectors...")
	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	if len(queryVectors) < numQueries {
		t.Fatalf("Not enough query vectors: got %d, need %d", len(queryVectors), numQueries)
	}
	queryVectors = queryVectors[:numQueries]
	t.Logf("  Using %d query vectors", numQueries)

	// Step 3: Compute ground truth
	t.Logf("Step 3: Computing ground truth (k=%d)...", k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors, k)

	// Step 4: Build disk index using BuildFromVectors
	t.Logf("Step 4: Building disk index with BuildFromVectors...")
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "recall_test_index")

	config := DefaultDiskBuildConfig()
	config.R = 64
	config.L = 128
	config.Alpha = 1.2
	config.NumWorkers = 4

	result, err := BuildFromVectors(basePath, baseVectors, config)
	if err != nil {
		t.Fatalf("BuildFromVectors failed: %v", err)
	}
	t.Logf("  Build completed: NumPoints=%d, Dimension=%d, Medoid=%d, BBQEnabled=%v",
		result.NumPoints, result.Dimension, result.Medoid, result.BBQEnabled)

	// Step 5: Open the disk index
	t.Logf("Step 5: Opening disk index...")
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Failed to open disk index: %v", err)
	}
	defer diskIdx.Close()

	t.Logf("  Index loaded: NumPoints=%d, Dimension=%d, HasBBQ=%v",
		diskIdx.NumPointsTotal(), diskIdx.Dimension(), diskIdx.HasBBQ())

	// Step 6: Execute search and compute recall
	t.Logf("Step 6: Computing recall@%d with searchL=%d...", k, searchL)
	recall := computeDiskAverageRecall(diskIdx, queryVectors, groundTruth, k, searchL)
	t.Logf("  Recall@%d (L=%d): %.2f%%", k, searchL, recall*100)

	// Step 7: Verify recall meets threshold
	if recall < minRecall {
		t.Errorf("Recall too low: %.2f%%, expected >= %.2f%%", recall*100, minRecall*100)
	}

	// Additional: Test with different searchL values
	t.Logf("\n  Testing different searchL values:")
	for _, testL := range []int{20, 50, 100, 200} {
		testRecall := computeDiskAverageRecall(diskIdx, queryVectors, groundTruth, k, testL)
		t.Logf("    searchL=%d: Recall@%d = %.2f%%", testL, k, testRecall*100)
	}

	t.Logf("\n=== BuildFromVectors Recall Test Completed ===")
}
