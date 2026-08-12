package synologyfilestation

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	pathpkg "path"
	"sort"
	"strconv"
	"strings"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type resource struct {
	session  *session
	ref      externalprovider.ResourceRef
	rootPath string
	rootName string
}

func (r *resource) Ref() externalprovider.ResourceRef {
	if r == nil {
		return externalprovider.ResourceRef{}
	}
	return r.ref
}

func (r *resource) Descriptor() externalprovider.ResourceDescriptor {
	if r == nil || r.session == nil {
		return externalprovider.ResourceDescriptor{}
	}
	spec, ok := r.session.resourceByID(r.ref.Resource)
	if !ok {
		return externalprovider.ResourceDescriptor{}
	}
	return r.session.resourceDescriptor(spec)
}

func (r *resource) remotePath(relative string) string {
	if relative == "" {
		return r.rootPath
	}
	if r.rootPath == "/" {
		return "/" + relative
	}
	return strings.TrimRight(r.rootPath, "/") + "/" + relative
}

func (r *resource) relativePath(remote string) (string, error) {
	return relativeRemotePath(r.rootPath, remote)
}

func (r *resource) capabilities() []string {
	return []string{
		externalprovider.CapabilityList,
		externalprovider.CapabilityStat,
		externalprovider.CapabilityOpen,
		externalprovider.CapabilityRead,
		externalprovider.CapabilityWrite,
		externalprovider.CapabilityCreate,
		externalprovider.CapabilityUpdate,
		externalprovider.CapabilityDelete,
		externalprovider.CapabilityCopy,
		externalprovider.CapabilityMove,
		externalprovider.CapabilityPaging,
		externalprovider.CapabilityOperations,
	}
}

func (r *resource) List(ctx context.Context, request externalprovider.ListRequest) (externalprovider.DirectoryPage, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if err := externalprovider.ValidateListRequest(request); err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	parent, err := r.resolve(request.Parent)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if request.Recursive || len(request.Sort) > 1 {
		return r.listMaterialized(ctx, parent, request)
	}
	limit := request.Page.Limit
	if limit == 0 {
		limit = DefaultPageLimit
	}
	offset, err := decodeCursor(request.Page.Cursor)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	filePage, err := r.listRemotePage(ctx, parent.Path, offset, limit, request.Sort)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	entries, err := r.entriesFromFiles(parent.Path, filePage.Files, false)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	sortEntries(entries, request.Sort, request.DirectoriesFirst)
	nextOffset := offset + len(filePage.Files)
	hasMore := len(filePage.Files) > 0 && len(filePage.Files) >= limit
	if filePage.TotalKnown {
		hasMore = nextOffset < filePage.Total
	}
	page := externalprovider.DirectoryPage{
		Entries:    entries,
		Total:      filePage.Total,
		TotalKnown: filePage.TotalKnown,
		Limit:      limit,
		HasMore:    hasMore,
		Parent:     parent,
	}
	if hasMore {
		page.NextCursor = encodeCursor(nextOffset)
	}
	return page, nil
}

func (r *resource) listMaterialized(ctx context.Context, parent externalprovider.ResourceRef, request externalprovider.ListRequest) (externalprovider.DirectoryPage, error) {
	entries := make([]externalprovider.Entry, 0)
	queue := []string{parent.Path}
	seenDirectories := map[string]struct{}{parent.Path: {}}
	for len(queue) > 0 {
		directory := queue[0]
		queue = queue[1:]
		offset := 0
		for {
			page, err := r.listRemotePage(ctx, directory, offset, DefaultPageLimit, request.Sort)
			if err != nil {
				return externalprovider.DirectoryPage{}, err
			}
			children, err := r.entriesFromFiles(directory, page.Files, false)
			if err != nil {
				return externalprovider.DirectoryPage{}, err
			}
			entries = append(entries, children...)
			if len(entries) > MaxListEntries {
				return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
			}
			if request.Recursive {
				for _, child := range children {
					if !child.IsDir {
						continue
					}
					if _, exists := seenDirectories[child.Path]; exists {
						return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
					}
					seenDirectories[child.Path] = struct{}{}
					queue = append(queue, child.Path)
				}
			}
			nextOffset := offset + len(page.Files)
			hasMore := len(page.Files) > 0 && len(page.Files) >= DefaultPageLimit
			if page.TotalKnown {
				hasMore = nextOffset < page.Total
			}
			if !hasMore {
				break
			}
			if nextOffset <= offset {
				return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
			}
			offset = nextOffset
		}
		if !request.Recursive {
			break
		}
	}
	sortEntries(entries, request.Sort, request.DirectoriesFirst)
	limit := request.Page.Limit
	if limit == 0 {
		limit = DefaultPageLimit
	}
	offset, err := decodeCursor(request.Page.Cursor)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if offset > len(entries) {
		offset = len(entries)
	}
	end := offset + limit
	if end > len(entries) {
		end = len(entries)
	}
	page := externalprovider.DirectoryPage{
		Entries:    append([]externalprovider.Entry(nil), entries[offset:end]...),
		Total:      len(entries),
		TotalKnown: true,
		Limit:      limit,
		HasMore:    end < len(entries),
		Parent:     parent,
	}
	if page.HasMore {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func (r *resource) Stat(ctx context.Context, request externalprovider.StatRequest) (externalprovider.Entry, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.Entry{}, err
	}
	if err := externalprovider.ValidateStatRequest(request); err != nil {
		return externalprovider.Entry{}, err
	}
	target, err := r.resolve(request.Target)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	if err := r.checkPreconditions(ctx, target.Path, request.Preconditions); err != nil {
		return externalprovider.Entry{}, err
	}
	info, err := r.statRemote(ctx, target.Path)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	return r.entryFromInfo(target.Path, info), nil
}

func (r *resource) Open(ctx context.Context, request externalprovider.OpenRequest) (externalprovider.OpenResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.OpenResult{}, err
	}
	if err := externalprovider.ValidateOpenRequest(request); err != nil {
		return externalprovider.OpenResult{}, err
	}
	target, err := r.resolve(request.Target)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	if err := r.checkPreconditions(ctx, target.Path, request.Preconditions); err != nil {
		return externalprovider.OpenResult{}, err
	}
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	reader, info, err := client.Open(ctx, sid, r.remotePath(target.Path), request.Range)
	if err != nil {
		return externalprovider.OpenResult{}, mapAPIError(err)
	}
	if reader == nil {
		return externalprovider.OpenResult{}, externalprovider.ErrResponse
	}
	relative, err := r.relativePath(info.Path)
	if err != nil || relative != target.Path {
		_ = reader.Close()
		return externalprovider.OpenResult{}, externalprovider.ErrResponse
	}
	if info.IsDir {
		_ = reader.Close()
		return externalprovider.OpenResult{}, externalprovider.ErrInvalidRequest
	}
	entry := r.entryFromInfo(relative, info)
	size := info.Size
	if request.Range != nil {
		size = rangeSize(info.Size, request.Range)
		if size < 0 {
			_ = reader.Close()
			return externalprovider.OpenResult{}, externalprovider.ErrInvalidRequest
		}
	}
	return externalprovider.OpenResult{Entry: entry, Reader: reader, Size: size, MediaType: info.MediaType, Revision: entry.Revision}, nil
}

func (r *resource) Create(ctx context.Context, request externalprovider.CreateRequest) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateCreateRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	parent, err := r.resolve(request.Parent)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	target := joinPath(parent.Path, request.Name)
	if err := r.checkPreconditions(ctx, target, request.Preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if request.Kind == externalprovider.EntryKindDirectory {
		if request.Content != nil {
			return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
		}
		info, err := client.CreateFolder(ctx, sid, r.remotePath(parent.Path), request.Name)
		if err != nil {
			return externalprovider.MutationResult{}, mapAPIError(err)
		}
		relative, err := r.relativePath(info.Path)
		if err != nil || relative != target {
			return externalprovider.MutationResult{}, externalprovider.ErrResponse
		}
		entry := r.entryFromInfo(relative, info)
		return externalprovider.MutationResult{Operation: "create", Target: target, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	} else {
		if request.Content == nil {
			return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
		}
		if err := client.Upload(ctx, sid, r.remotePath(parent.Path), request.Name, request.Content, request.Size, request.MediaType, false); err != nil {
			return externalprovider.MutationResult{}, mapAPIError(err)
		}
		info, err := r.statRemote(ctx, target)
		if err != nil {
			return externalprovider.MutationResult{}, err
		}
		entry := r.entryFromInfo(target, info)
		return externalprovider.MutationResult{Operation: "create", Target: target, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	}
}

func (r *resource) Update(ctx context.Context, request externalprovider.UpdateRequest) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateUpdateRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	target, err := r.resolve(request.Target)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := r.checkPreconditions(ctx, target.Path, request.Preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if request.Content != nil && request.NewName != "" {
		return externalprovider.MutationResult{}, ErrUnsupported
	}
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	destination := target.Path
	if request.Content != nil {
		info, statErr := r.statRemote(ctx, target.Path)
		if statErr != nil {
			return externalprovider.MutationResult{}, statErr
		}
		if info.IsDir {
			return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
		}
		if err := client.Upload(ctx, sid, r.remotePath(normalizeParent(target.Path)), pathpkg.Base(target.Path), request.Content, request.Size, request.MediaType, true); err != nil {
			return externalprovider.MutationResult{}, mapAPIError(err)
		}
		info, err := r.statRemote(ctx, target.Path)
		if err != nil {
			return externalprovider.MutationResult{}, err
		}
		entry := r.entryFromInfo(target.Path, info)
		return externalprovider.MutationResult{Operation: "update", Source: target.Path, Target: destination, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	} else if request.NewName != "" {
		destination = joinPath(normalizeParent(target.Path), request.NewName)
		info, err := client.Rename(ctx, sid, r.remotePath(target.Path), request.NewName)
		if err != nil {
			return externalprovider.MutationResult{}, mapAPIError(err)
		}
		relative, err := r.relativePath(info.Path)
		if err != nil || relative != destination {
			return externalprovider.MutationResult{}, externalprovider.ErrResponse
		}
		entry := r.entryFromInfo(relative, info)
		return externalprovider.MutationResult{Operation: "update", Source: target.Path, Target: destination, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	} else {
		return externalprovider.MutationResult{}, ErrUnsupported
	}
}

func (r *resource) Delete(ctx context.Context, request externalprovider.DeleteRequest) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateDeleteRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	remotePaths := make([]string, 0, len(request.Targets))
	for _, ref := range request.Targets {
		target, err := r.resolve(ref)
		if err != nil {
			return externalprovider.MutationResult{}, err
		}
		if target.Path == "" {
			return externalprovider.MutationResult{}, externalprovider.ErrPermission
		}
		if err := r.checkPreconditions(ctx, target.Path, request.Preconditions); err != nil {
			return externalprovider.MutationResult{}, err
		}
		remotePaths = append(remotePaths, r.remotePath(target.Path))
	}
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	operation, err := client.Delete(ctx, sid, remotePaths, request.Recursive)
	if err != nil {
		return externalprovider.MutationResult{}, mapAPIError(err)
	}
	return r.operationResult("delete", "", "", len(remotePaths), operation)
}

func (r *resource) Copy(ctx context.Context, request externalprovider.CopyRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateCopyRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, false, request.Preconditions)
}

func (r *resource) Move(ctx context.Context, request externalprovider.MoveRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateMoveRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, true, request.Preconditions)
}

func (r *resource) copyMove(ctx context.Context, sourceRef, destinationRef externalprovider.ResourceRef, overwrite, move bool, preconditions externalprovider.Preconditions) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	source, err := r.resolve(sourceRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	destination, err := r.resolve(destinationRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if source.Path == "" {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	if err := r.checkPreconditions(ctx, source.Path, preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	destinationInfo, err := r.statRemote(ctx, destination.Path)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if !destinationInfo.IsDir {
		return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
	}
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	operation, err := client.CopyMove(ctx, sid, []string{r.remotePath(source.Path)}, r.remotePath(destination.Path), move, overwrite)
	if err != nil {
		return externalprovider.MutationResult{}, mapAPIError(err)
	}
	name := pathpkg.Base(source.Path)
	target := joinPath(destination.Path, name)
	operationName := "copy"
	if move {
		operationName = "move"
	}
	return r.operationResult(operationName, source.Path, target, 1, operation)
}

func (r *resource) operationResult(name, source, target string, count int, operation Operation) (externalprovider.MutationResult, error) {
	ref, err := r.session.provider.registerOperation(operation, r.session)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	return externalprovider.MutationResult{Operation: name, Source: source, Target: target, Count: count, OperationRef: &ref}, nil
}

func (r *resource) resolve(ref externalprovider.ResourceRef) (externalprovider.ResourceRef, error) {
	if r == nil || r.session == nil || ref.Provider != r.ref.Provider || ref.Session != r.ref.Session || ref.Resource != r.ref.Resource {
		return externalprovider.ResourceRef{}, externalprovider.ErrInvalidRequest
	}
	path, err := normalizeRelativePath(ref.Path)
	if err != nil {
		return externalprovider.ResourceRef{}, err
	}
	ref.Path = path
	return ref, nil
}

func (r *resource) listRemotePage(ctx context.Context, parent string, offset, limit int, sortTerms []externalprovider.SortTerm) (FilePage, error) {
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return FilePage{}, err
	}
	page, err := client.List(ctx, sid, r.remotePath(parent), offset, limit, sortTerms)
	if err != nil {
		return FilePage{}, mapAPIError(err)
	}
	if page.Total < 0 || len(page.Files) > limit {
		return FilePage{}, externalprovider.ErrResponse
	}
	return page, nil
}

func (r *resource) entriesFromFiles(parent string, files []FileInfo, recursive bool) ([]externalprovider.Entry, error) {
	entries := make([]externalprovider.Entry, 0, len(files))
	seen := make(map[string]struct{}, len(files))
	for _, info := range files {
		relative, err := r.relativePath(info.Path)
		if err != nil {
			return nil, externalprovider.ErrResponse
		}
		if relative == parent {
			continue
		}
		if !recursive && normalizeParent(relative) != parent {
			return nil, externalprovider.ErrResponse
		}
		if _, exists := seen[relative]; exists {
			return nil, externalprovider.ErrResponse
		}
		seen[relative] = struct{}{}
		entries = append(entries, r.entryFromInfo(relative, info))
	}
	return entries, nil
}

func (r *resource) statRemote(ctx context.Context, relative string) (FileInfo, error) {
	sid, client, err := r.session.credentialsSnapshot()
	if err != nil {
		return FileInfo{}, err
	}
	info, err := client.Stat(ctx, sid, r.remotePath(relative))
	if err != nil {
		return FileInfo{}, mapAPIError(err)
	}
	resolved, err := r.relativePath(info.Path)
	if err != nil || resolved != relative {
		return FileInfo{}, externalprovider.ErrResponse
	}
	if info.ETag == "" {
		ref := externalprovider.ResourceRef{Provider: r.ref.Provider, Session: r.ref.Session, Resource: r.ref.Resource, Path: relative}
		info.ETag = revisionToken(ref, info)
	}
	return info, nil
}

func (r *resource) checkPreconditions(ctx context.Context, target string, preconditions externalprovider.Preconditions) error {
	if err := externalprovider.ValidatePreconditions(preconditions); err != nil {
		return err
	}
	if preconditions.VersionID != "" {
		return ErrUnsupported
	}
	if preconditions.IfMatch == "" && preconditions.IfNoneMatch == "" {
		return nil
	}
	info, err := r.statRemote(ctx, target)
	if err != nil {
		if preconditions.IfNoneMatch == "*" && errors.Is(err, externalprovider.ErrNotFound) {
			return nil
		}
		return err
	}
	if preconditions.IfMatch != "" && preconditions.IfMatch != info.ETag {
		return externalprovider.ErrConflict
	}
	if preconditions.IfNoneMatch == "*" || preconditions.IfNoneMatch == info.ETag {
		return externalprovider.ErrConflict
	}
	return nil
}

func (r *resource) entryFromInfo(relative string, info FileInfo) externalprovider.Entry {
	name := info.Name
	if strings.TrimSpace(name) == "" {
		name = pathpkg.Base(relative)
	}
	if relative == "" {
		name = r.rootName
	}
	kind := externalprovider.EntryKindFile
	if info.IsDir {
		kind = externalprovider.EntryKindDirectory
	}
	ref := externalprovider.ResourceRef{Provider: r.ref.Provider, Session: r.ref.Session, Resource: r.ref.Resource, Path: relative}
	return externalprovider.Entry{
		ID:        entryID(ref),
		Name:      name,
		Path:      relative,
		Ref:       ref,
		Kind:      kind,
		IsDir:     info.IsDir,
		Size:      maxInt64(info.Size),
		Modified:  unixMillis(info.Modified),
		Created:   unixMillis(info.Created),
		Extension: extension(name),
		MediaType: info.MediaType,
		Revision:  externalprovider.Revision{ETag: revisionToken(ref, info), ModifiedAt: info.Modified, Size: maxInt64(info.Size)},
	}
}

func encodeCursor(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodeCursor(cursor string) (int, error) {
	if cursor == "" {
		return 0, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, externalprovider.ErrInvalidRequest
	}
	offset, err := strconv.Atoi(string(decoded))
	if err != nil || offset < 0 || offset > MaxListEntries {
		return 0, externalprovider.ErrInvalidRequest
	}
	return offset, nil
}

func sortEntries(entries []externalprovider.Entry, terms []externalprovider.SortTerm, directoriesFirst bool) {
	sort.SliceStable(entries, func(left, right int) bool {
		a, b := entries[left], entries[right]
		if directoriesFirst && a.IsDir != b.IsDir {
			return a.IsDir
		}
		for _, term := range terms {
			comparison := compareEntry(a, b, term.Field)
			if comparison == 0 {
				continue
			}
			if term.Desc {
				return comparison > 0
			}
			return comparison < 0
		}
		return strings.ToLower(a.Path) < strings.ToLower(b.Path)
	})
}

func compareEntry(left, right externalprovider.Entry, field string) int {
	switch strings.ToLower(strings.TrimSpace(field)) {
	case "size":
		return compareInt64(left.Size, right.Size)
	case "modified", "mtime":
		return compareInt64(left.Modified, right.Modified)
	case "created", "crtime":
		return compareInt64(left.Created, right.Created)
	case "type", "kind":
		return strings.Compare(string(left.Kind), string(right.Kind))
	default:
		return strings.Compare(strings.ToLower(left.Name), strings.ToLower(right.Name))
	}
}

func compareInt64(left, right int64) int {
	if left < right {
		return -1
	}
	if left > right {
		return 1
	}
	return 0
}

func joinPath(parent, name string) string {
	if parent == "" {
		return name
	}
	return parent + "/" + name
}

func normalizeParent(value string) string {
	parent := pathpkg.Dir(value)
	if parent == "." || parent == "/" {
		return ""
	}
	return parent
}

func extension(name string) string {
	return strings.ToLower(pathpkg.Ext(name))
}

func entryID(ref externalprovider.ResourceRef) string {
	hash := sha256.Sum256([]byte(string(ref.Provider) + "\x00" + string(ref.Session) + "\x00" + string(ref.Resource) + "\x00" + ref.Path))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func revisionToken(ref externalprovider.ResourceRef, info FileInfo) string {
	if info.ETag != "" {
		return info.ETag
	}
	hash := sha256.Sum256([]byte(string(ref.Provider) + "\x00" + string(ref.Session) + "\x00" + string(ref.Resource) + "\x00" + ref.Path + "\x00" + strconv.FormatInt(info.Size, 10) + "\x00" + strconv.FormatInt(info.Modified.UnixNano(), 10)))
	return "syno-" + base64.RawURLEncoding.EncodeToString(hash[:])
}

func unixMillis(value time.Time) int64 {
	if value.IsZero() {
		return 0
	}
	return value.UnixMilli()
}

func rangeSize(size int64, value *externalprovider.ByteRange) int64 {
	if value == nil {
		return size
	}
	if size <= 0 || value.Start < 0 || value.Start >= size {
		return -1
	}
	end := size - 1
	if value.End > 0 {
		end = value.End
	}
	if end < value.Start || end >= size {
		return -1
	}
	return end - value.Start + 1
}

func (p *Provider) Health(ctx context.Context) (externalprovider.HealthStatus, error) {
	if p == nil {
		return externalprovider.HealthStatus{Available: false}, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return externalprovider.HealthStatus{Available: false}, err
	}
	return externalprovider.HealthStatus{Available: true}, nil
}

var _ externalprovider.ListResource = (*resource)(nil)
var _ externalprovider.StatResource = (*resource)(nil)
var _ externalprovider.OpenResource = (*resource)(nil)
var _ externalprovider.CreateResource = (*resource)(nil)
var _ externalprovider.UpdateResource = (*resource)(nil)
var _ externalprovider.DeleteResource = (*resource)(nil)
var _ externalprovider.CopyResource = (*resource)(nil)
var _ externalprovider.MoveResource = (*resource)(nil)
