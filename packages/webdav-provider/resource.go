package webdavprovider

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	pathpkg "path"
	"sort"
	"strconv"
	"strings"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type resource struct {
	session *session
	ref     externalprovider.ResourceRef
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
	return r.session.resourceDescriptor()
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
	entries, err := r.readEntries(ctx, parent.Path, request.Recursive)
	if err != nil {
		return externalprovider.DirectoryPage{}, unavailable(err)
	}
	if len(entries) > MaxListEntries {
		return externalprovider.DirectoryPage{}, responseError(fmt.Errorf("directory contains more than %d entries", MaxListEntries))
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
	info, err := r.session.client.Stat(ctx, target.Path)
	if err != nil {
		return externalprovider.Entry{}, mapRemoteError(err)
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
	info, err := r.session.client.Stat(ctx, target.Path)
	if err != nil {
		return externalprovider.OpenResult{}, mapRemoteError(err)
	}
	if info.IsDir {
		return externalprovider.OpenResult{}, externalprovider.ErrInvalidRequest
	}
	reader, err := r.session.client.Open(ctx, target.Path)
	if err != nil {
		return externalprovider.OpenResult{}, mapRemoteError(err)
	}
	entry := r.entryFromInfo(target.Path, info)
	reader, size, err := applyRange(reader, info.Size, request.Range)
	if err != nil {
		_ = reader.Close()
		return externalprovider.OpenResult{}, err
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
	targetPath := joinPath(parent.Path, request.Name)
	if err := r.checkPreconditions(ctx, targetPath, request.Preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if request.Kind == externalprovider.EntryKindDirectory {
		if request.Content != nil {
			return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
		}
		if err := r.session.client.Mkdir(ctx, targetPath); err != nil {
			return externalprovider.MutationResult{}, mapRemoteError(err)
		}
	} else {
		if request.Content == nil {
			return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
		}
		if err := r.write(ctx, targetPath, request.Content, request.Size); err != nil {
			return externalprovider.MutationResult{}, err
		}
	}
	entry, err := r.statPath(ctx, targetPath)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	return externalprovider.MutationResult{Operation: "create", Target: targetPath, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
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
	destination := target.Path
	if request.NewName != "" {
		destination = joinPath(pathpkg.Dir(target.Path), request.NewName)
	}
	if request.Content != nil {
		if err := r.write(ctx, destination, request.Content, request.Size); err != nil {
			return externalprovider.MutationResult{}, err
		}
		if destination != target.Path {
			if err := r.session.client.RemoveAll(ctx, target.Path); err != nil {
				return externalprovider.MutationResult{}, mapRemoteError(err)
			}
		}
	} else if destination != target.Path {
		if err := r.session.client.Move(ctx, target.Path, destination, false); err != nil {
			return externalprovider.MutationResult{}, mapRemoteError(err)
		}
	} else {
		return externalprovider.MutationResult{}, ErrUnsupported
	}
	entry, err := r.statPath(ctx, destination)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	return externalprovider.MutationResult{Operation: "update", Source: target.Path, Target: destination, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
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
	result := externalprovider.MutationResult{Operation: "delete"}
	for _, targetRef := range request.Targets {
		target, err := r.resolve(targetRef)
		if err != nil {
			result.Failures = append(result.Failures, externalprovider.MutationFailure{Target: targetRef, Code: "invalid-target", Message: err.Error()})
			continue
		}
		if err := r.checkPreconditions(ctx, target.Path, request.Preconditions); err != nil {
			result.Failures = append(result.Failures, externalprovider.MutationFailure{Target: targetRef, Code: "precondition", Message: err.Error()})
			continue
		}
		if err := r.session.client.RemoveAll(ctx, target.Path); err != nil {
			result.Failures = append(result.Failures, externalprovider.MutationFailure{Target: targetRef, Code: "delete", Message: mapRemoteError(err).Error()})
			continue
		}
		result.Count++
	}
	if result.Count == 0 && len(result.Failures) > 0 {
		return result, externalprovider.ErrResponse
	}
	return result, nil
}

func (r *resource) Copy(ctx context.Context, request externalprovider.CopyRequest) (externalprovider.MutationResult, error) {
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, false, request.Preconditions)
}

func (r *resource) Move(ctx context.Context, request externalprovider.MoveRequest) (externalprovider.MutationResult, error) {
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, true, request.Preconditions)
}

func (r *resource) copyMove(ctx context.Context, sourceRef, destinationRef externalprovider.ResourceRef, overwrite, move bool, preconditions externalprovider.Preconditions) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly {
		return externalprovider.MutationResult{}, externalprovider.ErrPermission
	}
	if err := externalprovider.ValidateResourceRef(sourceRef); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateResourceRef(destinationRef); err != nil {
		return externalprovider.MutationResult{}, err
	}
	source, err := r.resolve(sourceRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	destination, err := r.resolve(destinationRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := r.checkPreconditions(ctx, source.Path, preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if move {
		err = r.session.client.Move(ctx, source.Path, destination.Path, overwrite)
	} else {
		err = r.session.client.Copy(ctx, source.Path, destination.Path, overwrite)
	}
	if err != nil {
		return externalprovider.MutationResult{}, mapRemoteError(err)
	}
	entry, err := r.statPath(ctx, destination.Path)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	operation := "copy"
	if move {
		operation = "move"
	}
	return externalprovider.MutationResult{Operation: operation, Source: source.Path, Target: destination.Path, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
}

func (r *resource) resolve(ref externalprovider.ResourceRef) (externalprovider.ResourceRef, error) {
	if r == nil || r.session == nil || ref.Provider != r.ref.Provider || ref.Session != r.ref.Session || ref.Resource != r.ref.Resource {
		return externalprovider.ResourceRef{}, externalprovider.ErrInvalidRequest
	}
	path, err := normalizePath(ref.Path)
	if err != nil {
		return externalprovider.ResourceRef{}, err
	}
	ref.Path = path
	return ref, nil
}

func (r *resource) readEntries(ctx context.Context, parent string, recursive bool) ([]externalprovider.Entry, error) {
	infos, err := r.session.client.ReadDir(ctx, parent, recursive)
	if err != nil {
		return nil, err
	}
	entries := make([]externalprovider.Entry, 0, len(infos))
	seen := make(map[string]struct{}, len(infos))
	for index := range infos {
		info := &infos[index]
		path, err := relativePath(info.Path, r.session.endpoint.Path)
		if err != nil || path == parent {
			continue
		}
		if recursive {
			if parent != "" && path != parent && !strings.HasPrefix(path, parent+"/") {
				continue
			}
		} else {
			dir := pathpkg.Dir(path)
			if dir == "." {
				dir = ""
			}
			if dir != parent {
				continue
			}
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		entries = append(entries, r.entryFromInfo(path, info))
	}
	return entries, nil
}

func (r *resource) statPath(ctx context.Context, path string) (externalprovider.Entry, error) {
	info, err := r.session.client.Stat(ctx, path)
	if err != nil {
		return externalprovider.Entry{}, mapRemoteError(err)
	}
	return r.entryFromInfo(path, info), nil
}

func (r *resource) entryFromInfo(path string, info *FileInfo) externalprovider.Entry {
	if info == nil {
		info = &FileInfo{}
	}
	name := pathpkg.Base(path)
	if path == "" || name == "." {
		name = resourceName(r.session.endpoint)
	}
	kind := externalprovider.EntryKindFile
	if info.IsDir {
		kind = externalprovider.EntryKindDirectory
	}
	ref := externalprovider.ResourceRef{Provider: r.ref.Provider, Session: r.ref.Session, Resource: r.ref.Resource, Path: path}
	modified := info.ModTime.UnixMilli()
	return externalprovider.Entry{
		ID:        entryID(ref),
		Name:      name,
		Path:      path,
		Ref:       ref,
		Kind:      kind,
		IsDir:     info.IsDir,
		Size:      maxInt64(info.Size),
		Modified:  modified,
		Created:   0,
		Extension: extension(name),
		MediaType: info.MediaType,
		Revision:  externalprovider.Revision{ETag: info.ETag, ModifiedAt: info.ModTime, Size: maxInt64(info.Size)},
	}
}

func (r *resource) write(ctx context.Context, path string, content io.Reader, expectedSize int64) error {
	writer, err := r.session.client.Create(ctx, path)
	if err != nil {
		return mapRemoteError(err)
	}
	count, copyErr := io.Copy(writer, content)
	closeErr := writer.Close()
	if copyErr != nil {
		return unavailable(copyErr)
	}
	if closeErr != nil {
		return unavailable(closeErr)
	}
	if expectedSize >= 0 && count != expectedSize {
		return externalprovider.ErrInvalidRequest
	}
	return nil
}

func (r *resource) checkPreconditions(ctx context.Context, path string, preconditions externalprovider.Preconditions) error {
	if err := externalprovider.ValidatePreconditions(preconditions); err != nil {
		return err
	}
	if preconditions.VersionID != "" {
		return ErrUnsupported
	}
	if preconditions.IfMatch == "" && preconditions.IfNoneMatch == "" {
		return nil
	}
	info, err := r.session.client.Stat(ctx, path)
	if err != nil {
		if preconditions.IfNoneMatch == "*" {
			return nil
		}
		return mapRemoteError(err)
	}
	if preconditions.IfMatch != "" && preconditions.IfMatch != info.ETag {
		return externalprovider.ErrConflict
	}
	if preconditions.IfNoneMatch == "*" {
		return externalprovider.ErrConflict
	}
	return nil
}

func applyRange(reader io.ReadCloser, size int64, value *externalprovider.ByteRange) (io.ReadCloser, int64, error) {
	if value == nil {
		return reader, size, nil
	}
	if value.Start < 0 || value.Start >= size {
		return reader, 0, externalprovider.ErrInvalidRequest
	}
	if _, err := io.Copy(io.Discard, io.LimitReader(reader, value.Start)); err != nil {
		return reader, 0, err
	}
	length := size - value.Start
	if value.End > 0 {
		if value.End < value.Start || value.End >= size {
			return reader, 0, externalprovider.ErrInvalidRequest
		}
		length = value.End - value.Start + 1
	}
	return &limitedReadCloser{Reader: io.LimitReader(reader, length), closer: reader}, length, nil
}

type limitedReadCloser struct {
	io.Reader
	closer io.Closer
}

func (r *limitedReadCloser) Close() error {
	return r.closer.Close()
}

func normalizePath(value string) (string, error) {
	if strings.IndexByte(value, 0) >= 0 || strings.HasPrefix(value, "/") || strings.HasPrefix(value, "\\") {
		return "", externalprovider.ErrInvalidRequest
	}
	value = strings.ReplaceAll(value, "\\", "/")
	if value == "" {
		return "", nil
	}
	parts := strings.Split(value, "/")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		switch part {
		case "", ".":
			continue
		case "..":
			return "", externalprovider.ErrInvalidRequest
		default:
			clean = append(clean, part)
		}
	}
	return strings.Join(clean, "/"), nil
}

func relativePath(value, base string) (string, error) {
	value = strings.ReplaceAll(value, "\\", "/")
	base = strings.Trim(strings.ReplaceAll(base, "\\", "/"), "/")
	value = strings.Trim(value, "/")
	if base != "" {
		if value == base {
			value = ""
		} else if strings.HasPrefix(value, base+"/") {
			value = strings.TrimPrefix(value, base+"/")
		}
	}
	return normalizePath(value)
}

func joinPath(parent, name string) string {
	if parent == "" || parent == "." {
		return name
	}
	return parent + "/" + name
}

func entryID(ref externalprovider.ResourceRef) string {
	hash := sha256.Sum256([]byte(string(ref.Provider) + "\x00" + string(ref.Session) + "\x00" + string(ref.Resource) + "\x00" + ref.Path))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func extension(name string) string {
	ext := pathpkg.Ext(name)
	return strings.ToLower(ext)
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}

func sortEntries(entries []externalprovider.Entry, terms []externalprovider.SortTerm, directoriesFirst bool) {
	if len(entries) < 2 && !directoriesFirst {
		return
	}
	sort.SliceStable(entries, func(left, right int) bool {
		a, b := entries[left], entries[right]
		if directoriesFirst && a.IsDir != b.IsDir {
			return a.IsDir
		}
		for _, term := range terms {
			compare := compareEntry(a, b, term.Field)
			if compare != 0 {
				if term.Desc {
					return compare > 0
				}
				return compare < 0
			}
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
	if err != nil || offset < 0 || offset > externalprovider.MaxPageLimit*externalprovider.MaxPageLimit {
		return 0, externalprovider.ErrInvalidRequest
	}
	return offset, nil
}

func mapRemoteError(err error) error {
	if err == nil {
		return nil
	}
	if errorsIsNotFound(err) {
		return externalprovider.ErrNotFound
	}
	return unavailable(err)
}

func errorsIsNotFound(err error) bool {
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "404") || strings.Contains(text, "not found") || strings.Contains(text, "does not exist")
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

var _ externalprovider.SessionProvider = (*Provider)(nil)
var _ externalprovider.HealthProvider = (*Provider)(nil)
var _ externalprovider.ListResource = (*resource)(nil)
var _ externalprovider.StatResource = (*resource)(nil)
var _ externalprovider.OpenResource = (*resource)(nil)
var _ externalprovider.CreateResource = (*resource)(nil)
var _ externalprovider.UpdateResource = (*resource)(nil)
var _ externalprovider.DeleteResource = (*resource)(nil)
var _ externalprovider.CopyResource = (*resource)(nil)
var _ externalprovider.MoveResource = (*resource)(nil)

var _ = time.Time{}
