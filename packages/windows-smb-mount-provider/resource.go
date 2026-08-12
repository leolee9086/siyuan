package windowssmbmount

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	pathpkg "path"
	"sort"
	"strings"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type resource struct {
	session *session
	spec    mountSpec
	ref     externalprovider.ResourceRef
	files   FileSystem
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
	return r.session.resourceDescriptor(r.spec)
}

func (r *resource) capabilities() []string {
	return []string{
		externalprovider.CapabilityList, externalprovider.CapabilityStat,
		externalprovider.CapabilityOpen, externalprovider.CapabilityRead,
		externalprovider.CapabilityWrite, externalprovider.CapabilityCreate,
		externalprovider.CapabilityUpdate, externalprovider.CapabilityDelete,
		externalprovider.CapabilityCopy, externalprovider.CapabilityMove,
		externalprovider.CapabilityPaging,
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
	if r.files == nil {
		return externalprovider.DirectoryPage{}, externalprovider.ErrUnavailable
	}
	entries, err := r.readEntries(ctx, parent.Path, request.Recursive)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	sort.SliceStable(entries, func(left, right int) bool {
		if request.DirectoriesFirst && entries[left].IsDir != entries[right].IsDir {
			return entries[left].IsDir
		}
		for _, term := range request.Sort {
			comparison := compareEntries(entries[left], entries[right], term.Field)
			if comparison != 0 {
				if term.Desc {
					return comparison > 0
				}
				return comparison < 0
			}
		}
		return strings.ToLower(entries[left].Name) < strings.ToLower(entries[right].Name)
	})
	if len(entries) > MaxListEntries {
		return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
	}
	limit := request.Page.Limit
	if limit == 0 {
		limit = DefaultPageLimit
	}
	offset, err := decodeCursor(request.Page.Cursor)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if offset > len(entries) {
		return externalprovider.DirectoryPage{}, externalprovider.ErrInvalidRequest
	}
	end := offset + limit
	if end > len(entries) {
		end = len(entries)
	}
	page := externalprovider.DirectoryPage{
		Entries: entries[offset:end], Total: len(entries), TotalKnown: true, Limit: limit,
		HasMore: end < len(entries), Parent: parent,
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
	info, err := r.files.Stat(ctx, target.Path)
	if err != nil {
		return externalprovider.Entry{}, mapSystemError(err)
	}
	return r.entry(target.Path, info), nil
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
	info, err := r.files.Stat(ctx, target.Path)
	if err != nil {
		return externalprovider.OpenResult{}, mapSystemError(err)
	}
	if info.IsDir {
		return externalprovider.OpenResult{}, externalprovider.ErrInvalidRequest
	}
	reader, err := r.files.Open(ctx, target.Path)
	if err != nil {
		return externalprovider.OpenResult{}, mapSystemError(err)
	}
	reader, size, err := applyRange(reader, info.Size, request.Range)
	if err != nil {
		_ = reader.Close()
		return externalprovider.OpenResult{}, err
	}
	entry := r.entry(target.Path, info)
	return externalprovider.OpenResult{Entry: entry, Reader: reader, Size: size, MediaType: info.MediaType, Revision: entry.Revision}, nil
}

func (r *resource) Create(ctx context.Context, request externalprovider.CreateRequest) (externalprovider.MutationResult, error) {
	if err := r.session.check(ctx); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateCreateRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if r.session.readOnly || request.Content == nil && request.Kind != externalprovider.EntryKindDirectory {
		if r.session.readOnly {
			return externalprovider.MutationResult{}, externalprovider.ErrPermission
		}
		return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
	}
	if request.Kind == externalprovider.EntryKindDirectory && request.Content != nil {
		return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
	}
	parent, err := r.resolve(request.Parent)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	target := joinPath(parent.Path, request.Name)
	if request.Kind == externalprovider.EntryKindDirectory {
		err = r.files.Create(ctx, target, nil, 0, 0755)
	} else {
		err = r.files.Create(ctx, target, request.Content, request.Size, 0644)
	}
	if err != nil {
		return externalprovider.MutationResult{}, mapSystemError(err)
	}
	entry, err := r.Stat(ctx, externalprovider.StatRequest{Target: r.refWithPath(target)})
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	return externalprovider.MutationResult{Operation: "create", Target: target, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
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
	destination := target.Path
	if request.NewName != "" {
		destination = joinPath(pathpkg.Dir(target.Path), request.NewName)
	}
	if request.Content != nil {
		err = r.files.Create(ctx, destination, request.Content, request.Size, 0644)
		if err == nil && destination != target.Path {
			err = r.files.Remove(ctx, target.Path, false)
		}
	} else if destination != target.Path {
		err = r.files.Rename(ctx, target.Path, destination)
	} else {
		return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
	}
	if err != nil {
		return externalprovider.MutationResult{}, mapSystemError(err)
	}
	entry, err := r.Stat(ctx, externalprovider.StatRequest{Target: r.refWithPath(destination)})
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
		if err := r.files.Remove(ctx, target.Path, request.Recursive); err != nil {
			result.Failures = append(result.Failures, externalprovider.MutationFailure{Target: targetRef, Code: "delete", Message: mapSystemError(err).Error()})
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
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, false)
}

func (r *resource) Move(ctx context.Context, request externalprovider.MoveRequest) (externalprovider.MutationResult, error) {
	return r.copyMove(ctx, request.Source, request.Destination, request.Overwrite, true)
}

func (r *resource) copyMove(ctx context.Context, sourceRef, destinationRef externalprovider.ResourceRef, overwrite, move bool) (externalprovider.MutationResult, error) {
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
	if move {
		err = r.files.Rename(ctx, source.Path, destination.Path)
	} else {
		err = r.files.Copy(ctx, source.Path, destination.Path, overwrite)
	}
	if err != nil {
		return externalprovider.MutationResult{}, mapSystemError(err)
	}
	entry, err := r.Stat(ctx, externalprovider.StatRequest{Target: destination})
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
	path, err := normalizeRelativePath(ref.Path)
	if err != nil {
		return externalprovider.ResourceRef{}, err
	}
	ref.Path = path
	return ref, nil
}

func (r *resource) readEntries(ctx context.Context, parent string, recursive bool) ([]externalprovider.Entry, error) {
	entries := make([]externalprovider.Entry, 0)
	queue := []string{parent}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		infos, err := r.files.ReadDir(ctx, current)
		if err != nil {
			return nil, mapSystemError(err)
		}
		for _, info := range infos {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			path := joinPath(current, info.Name)
			entries = append(entries, r.entry(path, info))
			if len(entries) > MaxListEntries {
				return nil, externalprovider.ErrResponse
			}
			if recursive && info.IsDir {
				queue = append(queue, path)
			}
		}
		if !recursive {
			break
		}
	}
	return entries, nil
}

func (r *resource) refWithPath(path string) externalprovider.ResourceRef {
	return externalprovider.ResourceRef{Provider: r.ref.Provider, Session: r.ref.Session, Resource: r.ref.Resource, Path: path}
}

func (r *resource) entry(path string, info FileInfo) externalprovider.Entry {
	name := info.Name
	if name == "" {
		name = pathpkg.Base(path)
	}
	kind := externalprovider.EntryKindFile
	if info.IsDir {
		kind = externalprovider.EntryKindDirectory
	}
	ref := r.refWithPath(path)
	return externalprovider.Entry{
		ID: entryID(ref), Name: name, Path: path, Ref: ref, Kind: kind, IsDir: info.IsDir,
		Size: maxInt64(info.Size), Modified: info.ModTime.UnixMilli(), Extension: strings.ToLower(pathpkg.Ext(name)), MediaType: info.MediaType,
		Revision: externalprovider.Revision{ModifiedAt: info.ModTime, Size: maxInt64(info.Size)},
	}
}

func joinPath(parent, name string) string {
	if parent == "" {
		return name
	}
	return parent + "/" + name
}

func compareEntries(left, right externalprovider.Entry, field string) int {
	switch strings.ToLower(strings.TrimSpace(field)) {
	case "size":
		return compareInt64(left.Size, right.Size)
	case "modified", "mtime":
		return compareInt64(left.Modified, right.Modified)
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

func entryID(ref externalprovider.ResourceRef) string {
	digest := sha256.Sum256([]byte(string(ref.Provider) + "\x00" + string(ref.Session) + "\x00" + string(ref.Resource) + "\x00" + ref.Path))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}

var _ externalprovider.ListResource = (*resource)(nil)
var _ externalprovider.StatResource = (*resource)(nil)
var _ externalprovider.OpenResource = (*resource)(nil)
var _ externalprovider.CreateResource = (*resource)(nil)
var _ externalprovider.UpdateResource = (*resource)(nil)
var _ externalprovider.DeleteResource = (*resource)(nil)
var _ externalprovider.CopyResource = (*resource)(nil)
var _ externalprovider.MoveResource = (*resource)(nil)
