package fileproperties

import (
	"context"
	"errors"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

// MetadataStore 隔离属性组合逻辑和 assetmeta 的工作空间主数据实现。
type MetadataStore interface {
	LoadAssetAt(assetmeta.AssetAddress) (assetmeta.AssetMeta, error)
	SetAssetAt(assetmeta.AssetAddress, assetmeta.AssetMeta) error
}

// Service 组合根授权物理快照和工作空间私有元数据，不接触绝对路径或文件句柄。
type Service struct {
	files    *filebrowser.Service
	metadata MetadataStore
	now      func() time.Time
}

func NewService(files *filebrowser.Service, metadata MetadataStore) *Service {
	return &Service{files: files, metadata: metadata, now: time.Now}
}

// Inspect 批量读取属性；元数据损坏只标记对应项，仍保留其物理属性。
func (s *Service) Inspect(ctx context.Context, request filebrowser.BatchPropertiesRequest) (InspectResult, error) {
	physical, err := s.files.BatchProperties(ctx, request)
	if err != nil {
		return InspectResult{}, err
	}
	result := InspectResult{
		Items: make([]InspectItem, len(physical.Items)), SuccessCount: physical.SuccessCount, FailureCount: physical.FailureCount,
	}
	for index, item := range physical.Items {
		combined := InspectItem{Request: item.Request, Properties: item.Properties, Error: item.Error}
		if item.Properties != nil {
			combined.MetadataWritable = s.metadata != nil
			s.attachMetadata(&combined)
			if combined.MetadataError != nil {
				result.MetadataFailureCount++
			}
		}
		result.Items[index] = combined
	}
	return result, nil
}

func (s *Service) attachMetadata(item *InspectItem) {
	if s.metadata == nil {
		item.MetadataError = failureMessage("metadata-unavailable", "metadata store is unavailable")
		return
	}
	address, err := metadataAddress(item.Properties)
	if err != nil {
		item.MetadataError = failure("invalid-address", err)
		return
	}
	meta, err := s.metadata.LoadAssetAt(address)
	if errors.Is(err, fs.ErrNotExist) {
		meta = metadataFromProperties(address, item.Properties)
	} else if err != nil {
		item.MetadataError = failure("metadata-read-failed", err)
		return
	} else {
		item.MetadataPersisted = true
		mergePhysicalMetadata(&meta, address, item.Properties)
	}
	item.Metadata = &meta
}

// Update 批量修改元数据；物理地址和 revision 在写入前由文件浏览服务重新验证。
func (s *Service) Update(ctx context.Context, request BatchUpdateRequest) (BatchUpdateResult, error) {
	physicalRequest := filebrowser.BatchPropertiesRequest{Items: make([]filebrowser.FileRequest, len(request.Items))}
	for index, item := range request.Items {
		physicalRequest.Items[index] = item.Request
	}
	physical, err := s.files.BatchProperties(ctx, physicalRequest)
	if err != nil {
		return BatchUpdateResult{}, err
	}
	result := BatchUpdateResult{Items: make([]UpdateItemResult, len(request.Items))}
	for index, requested := range request.Items {
		physicalItem := physical.Items[index]
		updated := UpdateItemResult{Request: requested.Request, Properties: physicalItem.Properties, Error: physicalItem.Error}
		if updated.Error == nil {
			s.updateOne(ctx, requested, &updated)
		}
		if updated.Error == nil {
			result.SuccessCount++
		} else {
			result.FailureCount++
		}
		result.Items[index] = updated
	}
	return result, nil
}

func (s *Service) updateOne(ctx context.Context, requested UpdateItem, result *UpdateItemResult) {
	if err := ctx.Err(); err != nil {
		result.Error = failure("canceled", err)
		return
	}
	if s.metadata == nil {
		result.Error = failureMessage("metadata-unavailable", "metadata store is unavailable")
		return
	}
	if requested.Patch.empty() {
		result.Error = failureMessage("invalid-patch", "metadata patch is empty")
		return
	}
	if requested.Revision != "" && requested.Revision != result.Properties.Revision {
		result.Error = failureMessage("revision-conflict", "file properties changed after selection")
		return
	}
	address, err := metadataAddress(result.Properties)
	if err != nil {
		result.Error = failure("invalid-address", err)
		return
	}
	meta, err := s.metadata.LoadAssetAt(address)
	if errors.Is(err, fs.ErrNotExist) {
		meta = metadataFromProperties(address, result.Properties)
	} else if err != nil {
		result.Error = failure("metadata-read-failed", err)
		return
	}
	requested.Patch.apply(&meta)
	mergePhysicalMetadata(&meta, address, result.Properties)
	if meta.ImportTime == 0 {
		meta.ImportTime = s.now().Unix()
	}
	if err = s.metadata.SetAssetAt(address, meta); err != nil {
		result.Error = failure("metadata-write-failed", err)
		return
	}
	result.Metadata = &meta
}

func metadataAddress(properties *filebrowser.ItemProperties) (assetmeta.AssetAddress, error) {
	rootID := properties.Root.ID
	relative := properties.Entry.Path
	if properties.Root.Kind == filebrowser.RootKindWorkspace && strings.HasPrefix(relative, "data/") {
		rootID = assetmeta.LegacyDataRootID
		relative = strings.TrimPrefix(relative, "data/")
	}
	return assetmeta.NewAssetAddress(rootID, relative)
}

func metadataFromProperties(address assetmeta.AssetAddress, properties *filebrowser.ItemProperties) assetmeta.AssetMeta {
	meta := assetmeta.AssetMeta{Tags: []string{}}
	mergePhysicalMetadata(&meta, address, properties)
	return meta
}

func mergePhysicalMetadata(meta *assetmeta.AssetMeta, address assetmeta.AssetAddress, properties *filebrowser.ItemProperties) {
	meta.RootID = address.RootID
	meta.Path = address.Path
	meta.Name = properties.Entry.Name
	meta.FileSize = properties.Entry.Size
	meta.Width = properties.Width
	meta.Height = properties.Height
	if meta.Tags == nil {
		meta.Tags = []string{}
	}
}

func (patch MetadataPatch) empty() bool {
	return patch.Tags == nil && patch.Star == nil && patch.Annotation == nil && patch.BoundBlockID == nil &&
		patch.Source == nil && patch.SourceID == nil
}

func (patch MetadataPatch) apply(meta *assetmeta.AssetMeta) {
	if patch.Tags != nil {
		meta.Tags = normalizedTags(*patch.Tags)
	}
	if patch.Star != nil {
		meta.Star = *patch.Star
		if meta.Star < 0 {
			meta.Star = 0
		} else if meta.Star > 5 {
			meta.Star = 5
		}
	}
	if patch.Annotation != nil {
		meta.Annotation = strings.TrimSpace(*patch.Annotation)
	}
	if patch.BoundBlockID != nil {
		meta.BoundBlockID = strings.TrimSpace(*patch.BoundBlockID)
	}
	if patch.Source != nil {
		meta.Source = strings.TrimSpace(*patch.Source)
	}
	if patch.SourceID != nil {
		meta.SourceID = strings.TrimSpace(*patch.SourceID)
	}
}

func normalizedTags(tags []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		key := strings.ToLower(tag)
		if tag != "" && !seen[key] {
			seen[key] = true
			result = append(result, tag)
		}
	}
	sort.SliceStable(result, func(i, j int) bool { return strings.ToLower(result[i]) < strings.ToLower(result[j]) })
	return result
}

func failure(code string, err error) *filebrowser.PropertyFailure {
	return &filebrowser.PropertyFailure{Code: code, Message: err.Error()}
}

func failureMessage(code, message string) *filebrowser.PropertyFailure {
	return &filebrowser.PropertyFailure{Code: code, Message: message}
}
