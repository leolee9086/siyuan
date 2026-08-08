// Package filequery coordinates authorized file-browser roots with indexed asset metadata.
package filequery

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

// RootProvider exposes the current, authorization-filtered browser roots.
type RootProvider interface {
	ListRoots() ([]filebrowser.Root, error)
}

// IndexSearch keeps index implementation details outside the query coordinator.
type IndexSearch func(assetmeta.SearchRequest) ([]assetmeta.AssetMeta, int, error)

// FileEnumerator is the narrow traversal port used by default file browsing.
// The query domain supplies only an authorized root-relative scan request and
// a file callback; filesystem access, link policy and scheduling remain in
// filebrowser/fswalk.
type FileEnumerator interface {
	ScanContext(context.Context, filebrowser.ScanRequest, filebrowser.ScanVisitor) (filebrowser.ScanResult, error)
}

// Result is the browser-addressable page returned by a file query.
type Result struct {
	Assets     []assetmeta.AssetMeta `json:"assets"`
	TotalCount int                   `json:"totalCount"`
	PageCount  int                   `json:"pageCount"`
}

// TagRequest describes an authorized browser-root scope for the tag tree.
type TagRequest struct {
	RootIDs  []string `json:"rootIDs,omitempty"`
	AllRoots bool     `json:"allRoots,omitempty"`
}

// Service translates browser root IDs at the only boundary that knows both authorization and metadata identities.
type Service struct {
	roots      RootProvider
	search     IndexSearch
	enumerator FileEnumerator
}

// NewService composes a root authority and an indexed metadata search implementation.
func NewService(roots RootProvider, search IndexSearch, enumerators ...FileEnumerator) *Service {
	if search == nil {
		search = assetmeta.SearchAssetsAdvanced
	}
	var enumerator FileEnumerator
	if len(enumerators) > 0 {
		enumerator = enumerators[0]
	}
	return &Service{roots: roots, search: search, enumerator: enumerator}
}

// Search scopes every query to roots currently exposed by the file browser.
func (s *Service) Search(ctx context.Context, request assetmeta.SearchRequest) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{}, err
	}
	if s == nil || s.roots == nil || s.search == nil {
		return Result{}, filebrowser.ErrRootUnavailable
	}
	roots, err := s.roots.ListRoots()
	if err != nil {
		return Result{}, err
	}
	browserRequested := append([]string(nil), request.RootIDs...)
	browserAllRoots := request.AllRoots
	if s.enumerator != nil && canEnumerateFiles(request) {
		browserRoots, rootErr := resolveBrowserRoots(roots, browserRequested, browserAllRoots)
		if rootErr != nil {
			return Result{}, rootErr
		}
		return s.searchFiles(ctx, browserRoots, request)
	}
	mapping := buildRootMapping(roots)
	indexRoots, err := resolveIndexRoots(mapping, browserRequested, browserAllRoots)
	if err != nil {
		return Result{}, err
	}

	request.RootIDs = indexRoots
	request.AllRoots = false
	if request.PathPrefix != "" {
		indexRoots, request.PathPrefix = scopePathPrefix(browserRequested, browserAllRoots, request.PathPrefix, indexRoots)
		request.RootIDs = indexRoots
	}
	if len(request.PathPrefixes) > 0 {
		indexRoots, request.PathPrefixes = scopePathPrefixes(browserRequested, browserAllRoots, request.PathPrefixes, indexRoots)
		request.RootIDs = indexRoots
	}
	assets, totalCount, err := s.search(request)
	if err != nil {
		return Result{}, err
	}
	if err = ctx.Err(); err != nil {
		return Result{}, err
	}

	result := Result{Assets: make([]assetmeta.AssetMeta, 0, len(assets)), TotalCount: totalCount}
	for _, asset := range assets {
		browserRootID, path, ok := mapping.toBrowserAddress(asset.RootID, asset.Path)
		if !ok {
			continue
		}
		asset.RootID = browserRootID
		asset.Path = path
		result.Assets = append(result.Assets, asset)
	}
	if request.Limit > 0 && totalCount > 0 {
		result.PageCount = (totalCount + request.Limit - 1) / request.Limit
	}
	return result, nil
}

// TagCounts resolves browser root IDs before reading tag counts from the shared asset index.
func (s *Service) TagCounts(ctx context.Context, request TagRequest) ([]assetmeta.TagCount, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s == nil || s.roots == nil {
		return nil, filebrowser.ErrRootUnavailable
	}
	roots, err := s.roots.ListRoots()
	if err != nil {
		return nil, err
	}
	mapping := buildRootMapping(roots)
	indexRoots, err := resolveIndexRoots(mapping, request.RootIDs, request.AllRoots)
	if err != nil {
		return nil, err
	}
	tags, err := assetmeta.GetTagCounts(indexRoots)
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	return tags, nil
}

// scopePathPrefix translates the browser-root path used by the UI to the legacy data index path.
// The workspace root exposes both the old data identity and the newer workspace identity.
func scopePathPrefix(requested []string, allRoots bool, prefix string, resolved []string) ([]string, string) {
	prefix = strings.Trim(strings.ReplaceAll(prefix, "\\", "/"), "/")
	if prefix == "" || allRoots || len(requested) != 1 || requested[0] != "workspace" {
		return resolved, prefix
	}
	if prefix == "data" || strings.HasPrefix(prefix, "data/") {
		return []string{assetmeta.LegacyDataRootID}, strings.TrimPrefix(strings.TrimPrefix(prefix, "data"), "/")
	}
	return []string{"workspace"}, prefix
}

func scopePathPrefixes(requested []string, allRoots bool, prefixes []string, resolved []string) ([]string, []string) {
	resultRoots := make([]string, 0, len(resolved))
	result := make([]string, 0, len(prefixes))
	for _, prefix := range prefixes {
		roots, scoped := scopePathPrefix(requested, allRoots, prefix, resultRoots)
		resultRoots = uniqueRoots(append(resultRoots, roots...))
		result = append(result, scoped)
	}
	if len(resultRoots) == 0 {
		resultRoots = resolved
	}
	return resultRoots, result
}

type rootMapping struct {
	browserToIndex map[string][]string
	indexToBrowser map[string]browserAddress
}

type browserAddress struct {
	rootID string
	prefix string
}

func buildRootMapping(roots []filebrowser.Root) rootMapping {
	mapping := rootMapping{
		browserToIndex: map[string][]string{},
		indexToBrowser: map[string]browserAddress{},
	}
	for _, root := range roots {
		if !root.Exists || !root.Capabilities.Browse {
			continue
		}
		addBrowserRootMapping(&mapping, root, root.ID, "")
		for _, mount := range root.Mounts {
			mounted := mount.AsRoot()
			if !mounted.Exists || !mounted.Capabilities.Browse {
				continue
			}
			addBrowserRootMapping(&mapping, mounted, root.ID, mount.RelativePath)
		}
	}
	return mapping
}

func addBrowserRootMapping(mapping *rootMapping, root filebrowser.Root, displayRootID, prefix string) {
	prefix = normalizeRelativePrefix(prefix)
	if prefix != "" {
		prefix += "/"
	}
	browserID := root.ID
	indexIDs := []string{browserID}
	mapping.indexToBrowser[browserID] = browserAddress{rootID: displayRootID, prefix: prefix}
	if root.Kind == filebrowser.RootKindWorkspace {
		indexIDs = append([]string{assetmeta.LegacyDataRootID}, indexIDs...)
		mapping.indexToBrowser[assetmeta.LegacyDataRootID] = browserAddress{
			rootID: displayRootID, prefix: prefix + "data/",
		}
	}
	mapping.browserToIndex[browserID] = uniqueRoots(append(mapping.browserToIndex[browserID], indexIDs...))
	if browserID != displayRootID {
		// Selecting the displayed ancestor must include metadata identities of
		// its mounted descendants. Filesystem scans already cover the ancestor
		// physically; this keeps tag/palette queries from silently dropping a
		// mounted root when the selection is the displayed root.
		mapping.browserToIndex[displayRootID] = uniqueRoots(append(mapping.browserToIndex[displayRootID], indexIDs...))
	}
}

func resolveIndexRoots(mapping rootMapping, requested []string, allRoots bool) ([]string, error) {
	if allRoots {
		all := make([]string, 0, len(mapping.indexToBrowser))
		for rootID := range mapping.indexToBrowser {
			all = append(all, rootID)
		}
		sort.Strings(all)
		return all, nil
	}
	if len(requested) == 0 {
		requested = []string{"workspace"}
	}
	indexRoots := make([]string, 0, len(requested))
	for _, browserRootID := range requested {
		roots, ok := mapping.browserToIndex[browserRootID]
		if !ok {
			return nil, filebrowser.ErrRootNotFound
		}
		indexRoots = append(indexRoots, roots...)
	}
	return uniqueRoots(indexRoots), nil
}

func uniqueRoots(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func (m rootMapping) toBrowserAddress(indexRootID, relative string) (string, string, bool) {
	address, ok := m.indexToBrowser[indexRootID]
	if !ok {
		return "", "", false
	}
	return address.rootID, address.prefix + relative, true
}

// IsRootError lets API callers preserve root authorization errors without exposing index implementation details.
func IsRootError(err error) bool {
	return errors.Is(err, filebrowser.ErrRootNotFound) || errors.Is(err, filebrowser.ErrRootUnavailable)
}
