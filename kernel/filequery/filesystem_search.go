package filequery

import (
	"context"
	"path/filepath"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

type fileSearchScope struct {
	path      string
	recursive bool
}

// canEnumerateFiles identifies requests whose semantics do not require an
// asset metadata row. Basic browsing must see files before they are indexed;
// tag, palette, dimension and star predicates remain index-owned.
func canEnumerateFiles(request assetmeta.SearchRequest) bool {
	if hasNonEmpty(request.Tags) || request.Palette != nil {
		return false
	}
	return request.MinWidth <= 0 && request.MaxWidth <= 0 &&
		request.MinHeight <= 0 && request.MaxHeight <= 0 &&
		request.MinStar <= 0 && (request.MaxStar <= 0 || request.MaxStar >= 5)
}

func hasNonEmpty(values []string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

func resolveBrowserRoots(roots []filebrowser.Root, requested []string, allRoots bool) ([]filebrowser.Root, error) {
	available := make(map[string]filebrowser.Root, len(roots))
	for _, root := range roots {
		if root.Exists && root.Capabilities.Browse {
			available[root.ID] = root
		}
	}
	if allRoots {
		result := make([]filebrowser.Root, 0, len(available))
		for _, root := range available {
			result = append(result, root)
		}
		sort.SliceStable(result, func(left, right int) bool {
			if strings.ToLower(result[left].ID) != strings.ToLower(result[right].ID) {
				return strings.ToLower(result[left].ID) < strings.ToLower(result[right].ID)
			}
			return result[left].ID < result[right].ID
		})
		return result, nil
	}
	if len(requested) == 0 {
		requested = []string{"workspace"}
	}
	result := make([]filebrowser.Root, 0, len(requested))
	seen := make(map[string]bool, len(requested))
	for _, rootID := range requested {
		root, ok := available[rootID]
		if !ok {
			return nil, filebrowser.ErrRootNotFound
		}
		if !seen[root.ID] {
			seen[root.ID] = true
			result = append(result, root)
		}
	}
	return result, nil
}

func (s *Service) searchFiles(ctx context.Context, roots []filebrowser.Root, request assetmeta.SearchRequest) (Result, error) {
	assets := make([]assetmeta.AssetMeta, 0)
	seen := make(map[string]struct{})
	for _, root := range roots {
		if err := s.scanRootFiles(ctx, root, request, seen, &assets); err != nil {
			return Result{}, err
		}
	}
	sortFileAssets(assets, request.OrderBy)
	limit, offset := normalizePage(request.Limit, request.Offset)
	totalCount := len(assets)
	start := offset
	if start > totalCount {
		start = totalCount
	}
	end := start + limit
	if end > totalCount {
		end = totalCount
	}
	page := assets[start:end]
	if !fileSearchNeedsMetadata(request) {
		for index := range page {
			page[index] = projectFileAssetForAddress(page[index])
		}
	}
	result := Result{Assets: page, TotalCount: totalCount}
	if totalCount > 0 {
		result.PageCount = (totalCount + limit - 1) / limit
	}
	return result, nil
}

func normalizePage(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = 200
	} else if limit > 1000 {
		limit = 1000
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

func (s *Service) scanRootFiles(ctx context.Context, root filebrowser.Root, request assetmeta.SearchRequest,
	seen map[string]struct{}, assets *[]assetmeta.AssetMeta) error {
	recursive := request.Recursive == nil || *request.Recursive
	needsMetadata := fileSearchNeedsMetadata(request)
	scopes := []fileSearchScope{{path: request.PathPrefix, recursive: recursive}}
	if !recursive && len(request.PathPrefixes) > 0 {
		for _, prefix := range request.PathPrefixes {
			prefix = normalizeRelativePrefix(prefix)
			if prefix != "" {
				scopes = append(scopes, fileSearchScope{path: prefix, recursive: true})
			}
		}
	}
	for _, scope := range scopes {
		maxDepth := 0
		if !scope.recursive {
			maxDepth = 1
		}
		_, err := s.enumerator.ScanContext(ctx, filebrowser.ScanRequest{
			RootID: root.ID, Path: normalizeRelativePrefix(scope.path), MaxDepth: maxDepth,
		}, func(entry filebrowser.WalkEntry) error {
			if err := ctx.Err(); err != nil {
				return err
			}
			if entry.IsDir || entry.Restricted {
				return nil
			}
			if !scope.recursive && entry.Depth > 1 {
				return nil
			}
			key := strings.ToLower(root.ID) + "\x00" + strings.ToLower(entry.Path)
			if _, exists := seen[key]; exists {
				return nil
			}
			asset := basicFileAsset(root, entry)
			if needsMetadata {
				asset = projectFileAssetForAddress(asset)
			}
			if !matchesFileSearch(asset, request) {
				return nil
			}
			seen[key] = struct{}{}
			*assets = append(*assets, asset)
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func normalizeRelativePrefix(raw string) string {
	prefix := strings.Trim(strings.ReplaceAll(raw, "\\", "/"), "/")
	if prefix == "." {
		return ""
	}
	return prefix
}

func basicFileAsset(root filebrowser.Root, entry filebrowser.WalkEntry) assetmeta.AssetMeta {
	return assetmeta.AssetMeta{
		RootID: root.ID, Path: entry.Path, Name: entry.Name,
		Tags: []string{}, Source: "scan", ImportTime: entry.Updated, FileSize: entry.Size,
	}
}

func projectFileAssetForAddress(asset assetmeta.AssetMeta) assetmeta.AssetMeta {
	root := filebrowser.Root{ID: asset.RootID, Kind: filebrowser.RootKindAgent}
	if asset.RootID == "workspace" {
		root.Kind = filebrowser.RootKindWorkspace
	}
	for _, address := range indexAddresses(root, asset.Path) {
		if indexed, ok := assetmeta.GetIndexAssetAt(address); ok {
			if indexed.Tags == nil {
				indexed.Tags = []string{}
			}
			indexed.RootID = asset.RootID
			indexed.Path = asset.Path
			indexed.Name = asset.Name
			indexed.FileSize = asset.FileSize
			if indexed.ImportTime == 0 {
				indexed.ImportTime = asset.ImportTime
			}
			return indexed
		}
	}
	return asset
}

func fileSearchNeedsMetadata(request assetmeta.SearchRequest) bool {
	return strings.TrimSpace(request.Keyword) != "" || request.OrderBy == "star" || request.OrderBy == "resolution"
}

func indexAddresses(root filebrowser.Root, relative string) []assetmeta.AssetAddress {
	addresses := make([]assetmeta.AssetAddress, 0, 2)
	if root.Kind == filebrowser.RootKindWorkspace {
		normalized := normalizeRelativePrefix(relative)
		if strings.EqualFold(normalized, "data") || strings.HasPrefix(strings.ToLower(normalized), "data/") {
			legacyPath := strings.TrimPrefix(normalized, "data")
			legacyPath = strings.TrimPrefix(legacyPath, "/")
			if address, err := assetmeta.NewAssetAddress(assetmeta.LegacyDataRootID, legacyPath); err == nil {
				addresses = append(addresses, address)
			}
		}
	}
	if address, err := assetmeta.NewAssetAddress(root.ID, relative); err == nil {
		addresses = append(addresses, address)
	}
	return addresses
}

func matchesFileSearch(asset assetmeta.AssetMeta, request assetmeta.SearchRequest) bool {
	if !matchesExtensions(asset.Path, request.Exts) {
		return false
	}
	if request.MinSize > 0 && asset.FileSize < request.MinSize {
		return false
	}
	if request.MaxSize > 0 && asset.FileSize > request.MaxSize {
		return false
	}
	if keyword := strings.ToLower(strings.TrimSpace(request.Keyword)); keyword != "" {
		if !strings.Contains(strings.ToLower(asset.Name), keyword) &&
			!strings.Contains(strings.ToLower(asset.Path), keyword) &&
			!strings.Contains(strings.ToLower(asset.Annotation), keyword) &&
			!containsTag(asset.Tags, keyword) {
			return false
		}
	}
	return true
}

func matchesExtensions(path string, requested []string) bool {
	valid := make(map[string]struct{}, len(requested))
	for _, extension := range requested {
		extension = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(extension), "."))
		if extension == "" {
			continue
		}
		if strings.IndexFunc(extension, func(r rune) bool {
			return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
		}) == -1 {
			valid[extension] = struct{}{}
		}
	}
	if len(valid) == 0 {
		return true
	}
	extension := strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), ".")
	_, ok := valid[extension]
	return ok
}

func containsTag(tags []string, keyword string) bool {
	for _, tag := range tags {
		if strings.Contains(strings.ToLower(tag), keyword) {
			return true
		}
	}
	return false
}

func sortFileAssets(assets []assetmeta.AssetMeta, orderBy string) {
	sort.SliceStable(assets, func(left, right int) bool {
		first, second := assets[left], assets[right]
		switch orderBy {
		case "name":
			if strings.ToLower(first.Name) != strings.ToLower(second.Name) {
				return strings.ToLower(first.Name) < strings.ToLower(second.Name)
			}
		case "size":
			if first.FileSize != second.FileSize {
				return first.FileSize > second.FileSize
			}
		case "resolution":
			firstArea, secondArea := first.Width*first.Height, second.Width*second.Height
			if firstArea != secondArea {
				return firstArea > secondArea
			}
		case "star":
			if first.Star != second.Star {
				return first.Star > second.Star
			}
		default:
			if first.ImportTime != second.ImportTime {
				return first.ImportTime > second.ImportTime
			}
		}
		return first.RootID+"\x00"+first.Path < second.RootID+"\x00"+second.Path
	})
}
