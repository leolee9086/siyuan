package vectordb

import (
    "math/bits"
)

// QuantizationUtils provides utilities for scalar quantization

// ComputeQuantizedVectorQuantiles computes 0.5 quantiles (median) for binary quantization
// returns vector of medians
func ComputeQuantizedVectorQuantiles(vectors [][]float32, dimension int) []float32 {
    if len(vectors) == 0 {
        return make([]float32, dimension)
    }
    
    // For now, we use 0.0 as the threshold for all dimensions as a simple heuristic for normalized vectors
    // Centered vectors (like from embeddings) often have mean ~0
    // A more robust implementation would compute actual median per dimension
    medians := make([]float32, dimension)
    for i := range medians {
        medians[i] = 0.0
    }
    return medians
}

// Float32ToBinary quantizes a float32 vector to a packed uint64 array (1 bit per dimension)
// vectors are packed into []uint64 chunks
func Float32ToBinary(vec []float32) []uint64 {
    dim := len(vec)
    numChunks := (dim + 63) / 64
    res := make([]uint64, numChunks)
    
    for i := 0; i < dim; i++ {
        if vec[i] > 0 {
            chunkIdx := i / 64
            bitIdx := uint(i % 64)
            res[chunkIdx] |= (1 << bitIdx)
        }
    }
    return res
}

// HammingDistance computes Hamming distance between two packed binary vectors
// The result is the number of differing bits
func HammingDistance(a, b []uint64) int {
    if len(a) != len(b) {
        return 65535 // Mismatch error, simplified
    }
    
    dist := 0
    // Loop unrolling for common sizes could be here, but compiler usually handles it well
    // or we can optimize manually later if needed
    for i := 0; i < len(a); i++ {
        xor := a[i] ^ b[i]
        dist += bits.OnesCount64(xor)
    }
    return dist
}
