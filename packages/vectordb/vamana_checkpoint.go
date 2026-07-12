package vectordb

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/storage"
)

const (
	vamanaManifestFileExt = ".current"
	vamanaManifestVersion = uint32(1)
)

type vamanaGenerationManifest struct {
	Version        uint32 `msgpack:"version"`
	Generation     string `msgpack:"generation"`
	CommitSequence uint64 `msgpack:"commitSequence"`
}

type VamanaMaintenanceStats struct {
	TotalPoints           uint64
	DeletedPoints         uint64
	PendingPoints         int
	WALBytes              int64
	CheckpointRecommended bool
	ActiveGeneration      string
}

// resolveVamanaGeneration 通过原子 manifest 解析当前完整 generation；旧格式直接使用 rootPath。
func resolveVamanaGeneration(rootPath string) (string, error) {
	manifest, err := readVamanaGenerationManifest(rootPath)
	if err != nil {
		if os.IsNotExist(err) {
			return rootPath, nil
		}
		return "", err
	}
	activePath := filepath.Join(filepath.Dir(rootPath), manifest.Generation)
	if _, err := os.Stat(activePath + ".index"); err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("%w: DiskVamana generation index is missing", storage.ErrCorruptedFile)
		}
		return "", err
	}
	return activePath, nil
}

func readVamanaGenerationManifest(rootPath string) (vamanaGenerationManifest, error) {
	data, err := os.ReadFile(rootPath + vamanaManifestFileExt)
	if err != nil {
		return vamanaGenerationManifest{}, err
	}
	var manifest vamanaGenerationManifest
	if err := msgpack.Unmarshal(data, &manifest); err != nil {
		return vamanaGenerationManifest{}, fmt.Errorf("%w: decode DiskVamana generation manifest: %v", storage.ErrCorruptedFile, err)
	}
	if manifest.Version != vamanaManifestVersion {
		return vamanaGenerationManifest{}, fmt.Errorf("%w: unsupported DiskVamana generation manifest version %d", storage.ErrVersionMismatch, manifest.Version)
	}
	rootName := filepath.Base(rootPath)
	if filepath.Base(manifest.Generation) != manifest.Generation || !strings.HasPrefix(manifest.Generation, rootName+".gen-") {
		return vamanaGenerationManifest{}, fmt.Errorf("%w: invalid DiskVamana generation %q", storage.ErrCorruptedFile, manifest.Generation)
	}
	return manifest, nil
}

func publishVamanaGeneration(rootPath, generationPath string, sequence uint64) error {
	manifest := vamanaGenerationManifest{
		Version:        vamanaManifestVersion,
		Generation:     filepath.Base(generationPath),
		CommitSequence: sequence,
	}
	data, err := msgpack.Marshal(&manifest)
	if err != nil {
		return err
	}
	return atomicWriteFile(rootPath+vamanaManifestFileExt, data)
}

var publishVamanaGenerationFile = publishVamanaGeneration

func hasVamanaCollection(rootPath string) (bool, error) {
	if _, err := os.Stat(rootPath + vamanaManifestFileExt); err == nil {
		return true, nil
	} else if !os.IsNotExist(err) {
		return false, err
	}
	if _, err := os.Stat(rootPath + ".index"); err == nil {
		return true, nil
	} else if !os.IsNotExist(err) {
		return false, err
	}
	return false, nil
}

func (vc *VamanaCollection) MaintenanceStats() VamanaMaintenanceStats {
	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	if vc.Index == nil {
		return VamanaMaintenanceStats{}
	}
	total := vc.Index.NumPointsTotal()
	live := uint64(len(vc.IDMap))
	deleted := uint64(0)
	if total > live {
		deleted = total - live
	}
	walBytes := vc.walBytes
	threshold := vc.WALCheckpointBytes
	if threshold <= 0 {
		threshold = DefaultVamanaCheckpointWALBytes
	}
	return VamanaMaintenanceStats{
		TotalPoints:           total,
		DeletedPoints:         deleted,
		PendingPoints:         len(vc.PendingVectors),
		WALBytes:              walBytes,
		CheckpointRecommended: walBytes >= threshold || total > 0 && deleted*10 >= total*3,
		ActiveGeneration:      filepath.Base(vc.BasePath),
	}
}

func (vc *VamanaCollection) AutoCheckpointNeeded() bool {
	return vc.checkpointNeeded.Load()
}

// Checkpoint 把磁盘图、append 区、删除位和外部 ID 映射发布为一个新的不可变 generation。
func (vc *VamanaCollection) Checkpoint(ctx context.Context) (CheckpointResult, error) {
	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()
	vc.Mu.Lock()
	defer vc.Mu.Unlock()

	if err := ctx.Err(); err != nil {
		return CheckpointResult{}, err
	}
	if vc.Index == nil {
		return CheckpointResult{}, ErrCollectionClosed
	}
	rootPath := vc.RootPath
	if rootPath == "" {
		rootPath = vc.BasePath
	}
	walBytes := vc.walBytes
	originalPoints := vc.Index.NumPointsTotal()

	desiredGenerationPath := fmt.Sprintf("%s.gen-%020d", rootPath, vc.LastCommitSequence)
	activeIsGeneration := vc.BasePath != rootPath && strings.HasPrefix(filepath.Base(vc.BasePath), filepath.Base(rootPath)+".gen-")
	if activeIsGeneration && walBytes == 0 && len(vc.PendingVectors) == 0 && vc.Index.NumPoints() == vc.Index.NumPointsTotal() {
		return CheckpointResult{
			Engine:          EngineDiskVamana,
			CommitSequence:  vc.LastCommitSequence,
			OriginalPoints:  originalPoints,
			RemainingPoints: originalPoints,
		}, nil
	}
	generationPath := desiredGenerationPath
	if generationPath == vc.BasePath {
		generationPath += ".next"
	}
	if err := removeVamanaFiles(generationPath); err != nil {
		return CheckpointResult{}, err
	}
	compactResult, err := vc.Index.Compact(generationPath)
	if err != nil {
		return CheckpointResult{}, err
	}
	if err := ctx.Err(); err != nil {
		_ = removeVamanaFiles(generationPath)
		return CheckpointResult{}, err
	}

	remappedIDs := make(map[string]uint64, len(vc.IDMap))
	remappedDocs := make(map[uint64]string, len(vc.DocMap))
	remappedMetas := make(map[uint64][]byte, len(vc.Metas))
	for id, oldID := range vc.IDMap {
		newID, ok := compactResult.Remap(oldID)
		if !ok {
			_ = removeVamanaFiles(generationPath)
			return CheckpointResult{}, fmt.Errorf("DiskVamana checkpoint lost live ID %q", id)
		}
		remappedIDs[id] = newID
		remappedDocs[newID] = id
		if meta, ok := vc.Metas[oldID]; ok {
			remappedMetas[newID] = append([]byte(nil), meta...)
		}
	}
	if uint64(len(remappedIDs)) != compactResult.RemainingPoints {
		_ = removeVamanaFiles(generationPath)
		return CheckpointResult{}, fmt.Errorf("DiskVamana checkpoint mapping count %d does not match graph count %d", len(remappedIDs), compactResult.RemainingPoints)
	}

	next := &VamanaCollection{
		ColName:            vc.ColName,
		ColDim:             vc.ColDim,
		Meta:               vc.Meta,
		RootPath:           rootPath,
		BasePath:           generationPath,
		Config:             vc.Config,
		WALCheckpointBytes: vc.WALCheckpointBytes,
		CosineNormalized:   vc.CosineNormalized,
		LastCommitSequence: vc.LastCommitSequence,
		IDMap:              remappedIDs,
		DocMap:             remappedDocs,
		Metas:              remappedMetas,
		PendingVectors:     make(map[string][]float32),
	}
	if err := saveVamanaCollectionStateLocked(next, generationPath); err != nil {
		_ = removeVamanaFiles(generationPath)
		return CheckpointResult{}, err
	}
	reopened, err := openVamanaCollectionGeneration(vc.ColName, rootPath, generationPath, vc.Meta)
	if err != nil {
		_ = removeVamanaFiles(generationPath)
		return CheckpointResult{}, err
	}
	reopened.Config = vc.Config
	if err := publishVamanaGenerationFile(rootPath, generationPath, vc.LastCommitSequence); err != nil {
		_ = reopened.Close()
		_ = removeVamanaFiles(generationPath)
		return CheckpointResult{}, err
	}

	oldBasePath := vc.BasePath
	closeErr := vc.Index.Close()
	walCloseErr := vc.closeWALLocked()
	vc.adoptCheckpointLocked(reopened)
	cleanupPending := closeErr != nil || walCloseErr != nil
	if oldBasePath != generationPath {
		cleanupPending = removeVamanaFiles(oldBasePath) != nil || cleanupPending
	}
	return CheckpointResult{
		Engine:          EngineDiskVamana,
		CommitSequence:  vc.LastCommitSequence,
		OriginalPoints:  compactResult.OriginalPoints,
		RemainingPoints: compactResult.RemainingPoints,
		ReclaimedPoints: compactResult.DeletedPoints,
		WALBytesBefore:  walBytes,
		CleanupPending:  cleanupPending,
	}, nil
}

func (vc *VamanaCollection) adoptCheckpointLocked(next *VamanaCollection) {
	vc.ColDim = next.ColDim
	vc.Meta = next.Meta
	vc.RootPath = next.RootPath
	vc.BasePath = next.BasePath
	vc.Config = next.Config
	vc.WALCheckpointBytes = next.WALCheckpointBytes
	vc.CosineNormalized = next.CosineNormalized
	vc.LastCommitSequence = next.LastCommitSequence
	vc.Index = next.Index
	vc.IDMap = next.IDMap
	vc.DocMap = next.DocMap
	vc.Metas = next.Metas
	vc.PendingVectors = next.PendingVectors
	vc.walFile = nil
	vc.walBytes = 0
	vc.checkpointNeeded.Store(false)
}

func fileSizeOrZero(path string) int64 {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
}
