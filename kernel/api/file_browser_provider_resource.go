package api

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/assets"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func listFileBrowserProviderResources(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderResourceRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.Provider == "" || request.Session == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	page, err := newFileBrowserProviderRegistry().ListResources(c.Request.Context(), request.Provider, request.Session, request.Page)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderResourcePage(page)
}

func publicProviderResourcePage(page externalprovider.ResourcePage) externalprovider.PublicResourcePage {
	resources := make([]externalprovider.PublicResourceDescriptor, 0, len(page.Resources))
	for _, resource := range page.Resources {
		resources = append(resources, externalprovider.PublicResourceDescriptor{
			Provider: resource.Ref.Provider, Session: resource.Ref.Session, ID: resource.ID,
			Name: resource.Name, Kind: resource.Kind, ReadOnly: resource.ReadOnly,
			Capabilities: append([]string(nil), resource.Capabilities...), Source: resource.Source,
			Aliases: append([]externalprovider.ResourceAlias(nil), resource.Aliases...),
		})
	}
	return externalprovider.PublicResourcePage{
		Resources: resources, Total: page.Total, Limit: page.Limit,
		NextCursor: page.NextCursor, HasMore: page.HasMore,
	}
}

type sForgeFileBrowserProviderEntry struct {
	ID          string                        `json:"id"`
	Name        string                        `json:"name"`
	Kind        externalprovider.EntryKind    `json:"kind"`
	IsDir       bool                          `json:"isDir"`
	Size        int64                         `json:"size"`
	Modified    int64                         `json:"modified"`
	Created     int64                         `json:"created"`
	Extension   string                        `json:"extension,omitempty"`
	MediaType   string                        `json:"mediaType,omitempty"`
	Revision    externalprovider.Revision     `json:"revision,omitempty"`
	Metadata    map[string]string             `json:"metadata,omitempty"`
	Address     externalprovider.AssetAddress `json:"address"`
	PreviewKind assets.PreviewKind            `json:"previewKind"`
	ContentURL  string                        `json:"contentURL,omitempty"`
}

type sForgeFileBrowserProviderDirectoryPage struct {
	Entries    []sForgeFileBrowserProviderEntry `json:"entries"`
	Total      int                              `json:"total"`
	TotalKnown bool                             `json:"totalKnown"`
	Limit      int                              `json:"limit"`
	NextCursor string                           `json:"nextCursor,omitempty"`
	HasMore    bool                             `json:"hasMore"`
}

func publicProviderDirectoryPage(page externalprovider.DirectoryPage) (sForgeFileBrowserProviderDirectoryPage, error) {
	entries := make([]sForgeFileBrowserProviderEntry, 0, len(page.Entries))
	for _, entry := range page.Entries {
		projected, err := publicProviderEntry(entry)
		if err != nil {
			return sForgeFileBrowserProviderDirectoryPage{}, err
		}
		entries = append(entries, projected)
	}
	return sForgeFileBrowserProviderDirectoryPage{
		Entries: entries, Total: page.Total, TotalKnown: page.TotalKnown, Limit: page.Limit,
		NextCursor: page.NextCursor, HasMore: page.HasMore,
	}, nil
}

func publicProviderEntry(entry externalprovider.Entry) (sForgeFileBrowserProviderEntry, error) {
	if entry.Address == nil || strings.TrimSpace(entry.Address.Token) == "" {
		return sForgeFileBrowserProviderEntry{}, fileprovider.ErrProviderResponse
	}
	format := assets.Classify(entry.Name, entry.MediaType)
	result := sForgeFileBrowserProviderEntry{
		ID: entry.ID, Name: entry.Name, Kind: entry.Kind, IsDir: entry.IsDir, Size: entry.Size,
		Modified: entry.Modified, Created: entry.Created, Extension: entry.Extension, MediaType: entry.MediaType,
		Revision: entry.Revision, Metadata: entry.Metadata, Address: *entry.Address,
		PreviewKind: format.PreviewKind,
	}
	if !entry.IsDir {
		result.ContentURL = providerContentURL(entry.Ref, entry.Address.Token)
	}
	return result, nil
}

func providerContentURL(ref externalprovider.ResourceRef, token string) string {
	query := url.Values{}
	query.Set("provider", string(ref.Provider))
	query.Set("session", string(ref.Session))
	query.Set("resource", string(ref.Resource))
	query.Set("token", token)
	return "/api/s-forge/file-browser/provider/content?" + query.Encode()
}

func revisionValue(revision externalprovider.Revision) string {
	if revision.ETag != "" {
		return revision.ETag
	}
	if revision.VersionID != "" {
		return revision.VersionID
	}
	return strconv.FormatInt(revision.ModifiedAt.UnixNano(), 10) + "-" + strconv.FormatInt(revision.Size, 10)
}

func listFileBrowserProviderDirectory(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderListRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	registry := newFileBrowserProviderRegistry()
	parent, err := resolveProviderLocator(registry, request.providerResourceLocator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	page, err := registry.ListResource(c.Request.Context(), parent, externalprovider.ListRequest{
		Parent:           parent,
		Page:             request.Page,
		Recursive:        request.Recursive,
		Sort:             request.Sort,
		IncludeMetadata:  request.IncludeMetadata,
		DirectoriesFirst: request.DirectoriesFirst,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	publicPage, err := publicProviderDirectoryPage(page)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicPage
}

func statFileBrowserProviderEntry(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderStatRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	registry := newFileBrowserProviderRegistry()
	target, err := resolveProviderLocator(registry, request.providerResourceLocator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	entry, err := registry.StatResource(c.Request.Context(), externalprovider.StatRequest{
		Target: target, IncludeMetadata: request.IncludeMetadata, Preconditions: request.Preconditions,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	projected, err := publicProviderEntry(entry)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = struct {
		sForgeFileBrowserProviderEntry
		RevisionValue string `json:"revisionValue"`
	}{sForgeFileBrowserProviderEntry: projected, RevisionValue: revisionValue(entry.Revision)}
}

func providerOpenRequestFromLocator(registry *fileprovider.ProviderRegistry, locator providerResourceLocator, value sForgeFileBrowserProviderOpenRequest) (externalprovider.OpenRequest, error) {
	target, err := resolveProviderLocator(registry, locator)
	if err != nil {
		return externalprovider.OpenRequest{}, err
	}
	return externalprovider.OpenRequest{Target: target, Range: value.Range, Preconditions: value.Preconditions}, nil
}
