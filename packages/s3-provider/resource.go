package s3provider

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
	return r.session.resourceDescriptor(string(r.ref.Resource))
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
		externalprovider.CapabilityVersioning,
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
	limit := request.Page.Limit
	if limit == 0 {
		limit = DefaultPageLimit
	}
	delimiter := "/"
	if request.Recursive {
		delimiter = ""
	}
	page, err := r.session.store.ListObjects(ctx, string(r.ref.Resource), parent.Path, delimiter, request.Page.Cursor, limit)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	entries := make([]externalprovider.Entry, 0, len(page.Objects)+len(page.Prefixes))
	for _, prefix := range page.Prefixes {
		key, err := normalizeKey(prefix)
		if err != nil {
			return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
		}
		entries = append(entries, r.entryFromObject(ObjectInfo{Key: key, IsPrefix: true}))
	}
	for _, object := range page.Objects {
		key, err := normalizeKey(object.Key)
		if err != nil {
			return externalprovider.DirectoryPage{}, externalprovider.ErrResponse
		}
		if key == parent.Path && strings.HasSuffix(object.Key, "/") {
			continue
		}
		entries = append(entries, r.entryFromObject(ObjectInfo{Key: key, Size: object.Size, Modified: object.Modified, ETag: object.ETag, VersionID: object.VersionID, MediaType: object.MediaType, Metadata: object.Metadata, IsPrefix: object.IsPrefix || strings.HasSuffix(object.Key, "/")}))
	}
	sort.SliceStable(entries, func(left, right int) bool {
		if request.DirectoriesFirst && entries[left].IsDir != entries[right].IsDir {
			return entries[left].IsDir
		}
		return strings.ToLower(entries[left].Path) < strings.ToLower(entries[right].Path)
	})
	return externalprovider.DirectoryPage{Entries: entries, TotalKnown: false, Limit: limit, NextCursor: page.NextCursor, HasMore: page.HasMore, Parent: parent}, nil
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
	object, err := r.session.store.StatObject(ctx, string(r.ref.Resource), target.Path, request.Preconditions)
	if err != nil {
		if strings.HasSuffix(target.Path, "/") || errorsIsNotFound(err) {
			if directory, listErr := r.session.store.ListObjects(ctx, string(r.ref.Resource), target.Path, "/", "", 1); listErr == nil && (len(directory.Objects) > 0 || len(directory.Prefixes) > 0) {
				object = ObjectInfo{Key: target.Path, IsPrefix: true}
			} else {
				return externalprovider.Entry{}, err
			}
		} else {
			return externalprovider.Entry{}, err
		}
	}
	return r.entryFromObject(object), nil
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
	reader, object, err := r.session.store.OpenObject(ctx, string(r.ref.Resource), target.Path, request.Range, request.Preconditions)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	entry := r.entryFromObject(object)
	return externalprovider.OpenResult{Entry: entry, Reader: reader, Size: object.Size, MediaType: object.MediaType, Revision: entry.Revision}, nil
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
	key := joinKey(parent.Path, request.Name, request.Kind == externalprovider.EntryKindDirectory)
	if request.Kind == externalprovider.EntryKindDirectory {
		object, err := r.session.store.PutObject(ctx, string(r.ref.Resource), key, strings.NewReader(""), 0, "application/x-directory", nil, request.Preconditions)
		if err != nil {
			return externalprovider.MutationResult{}, err
		}
		object.IsPrefix = true
		entry := r.entryFromObject(object)
		return externalprovider.MutationResult{Operation: "create", Target: key, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	}
	if request.Content == nil {
		return externalprovider.MutationResult{}, externalprovider.ErrInvalidRequest
	}
	object, err := r.session.store.PutObject(ctx, string(r.ref.Resource), key, request.Content, request.Size, request.MediaType, request.Metadata, request.Preconditions)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	entry := r.entryFromObject(object)
	return externalprovider.MutationResult{Operation: "create", Target: key, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
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
		destination = joinKey(pathpkg.Dir(target.Path), request.NewName, strings.HasSuffix(target.Path, "/"))
	}
	if request.Content != nil {
		object, err := r.session.store.PutObject(ctx, string(r.ref.Resource), destination, request.Content, request.Size, request.MediaType, request.Metadata, request.Preconditions)
		if err != nil {
			return externalprovider.MutationResult{}, err
		}
		if destination != target.Path {
			if err := r.session.store.DeleteObject(ctx, string(r.ref.Resource), target.Path, true, externalprovider.Preconditions{}); err != nil {
				return externalprovider.MutationResult{}, err
			}
		}
		entry := r.entryFromObject(object)
		return externalprovider.MutationResult{Operation: "update", Source: target.Path, Target: destination, Count: 1, Entries: []externalprovider.Entry{entry}, Revision: entry.Revision}, nil
	}
	if destination == target.Path {
		return externalprovider.MutationResult{}, ErrUnsupported
	}
	object, err := r.session.store.CopyObject(ctx, string(r.ref.Resource), target.Path, string(r.ref.Resource), destination, false, request.Preconditions)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := r.session.store.DeleteObject(ctx, string(r.ref.Resource), target.Path, true, request.Preconditions); err != nil {
		return externalprovider.MutationResult{}, err
	}
	entry := r.entryFromObject(object)
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
		if err := r.session.store.DeleteObject(ctx, string(r.ref.Resource), target.Path, request.Recursive, request.Preconditions); err != nil {
			result.Failures = append(result.Failures, externalprovider.MutationFailure{Target: targetRef, Code: "delete", Message: err.Error()})
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
	source, err := r.resolve(sourceRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	destination, err := r.resolve(destinationRef)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	object, err := r.session.store.CopyObject(ctx, string(r.ref.Resource), source.Path, string(r.ref.Resource), destination.Path, overwrite, preconditions)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if move {
		if err := r.session.store.DeleteObject(ctx, string(r.ref.Resource), source.Path, true, preconditions); err != nil {
			return externalprovider.MutationResult{}, err
		}
	}
	entry := r.entryFromObject(object)
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
	key, err := normalizeKey(ref.Path)
	if err != nil {
		return externalprovider.ResourceRef{}, err
	}
	ref.Path = key
	return ref, nil
}

func (r *resource) entryFromObject(object ObjectInfo) externalprovider.Entry {
	path := object.Key
	if object.IsPrefix && !strings.HasSuffix(path, "/") {
		path += "/"
	}
	name := pathpkg.Base(strings.TrimSuffix(path, "/"))
	if name == "." || name == "" {
		name = string(r.ref.Resource)
	}
	isDirectory := object.IsPrefix || strings.HasSuffix(path, "/")
	kind := externalprovider.EntryKindObject
	if isDirectory {
		kind = externalprovider.EntryKindDirectory
	}
	return externalprovider.Entry{
		ID:        entryID(r.ref, path),
		Name:      name,
		Path:      path,
		Ref:       externalprovider.ResourceRef{Provider: r.ref.Provider, Session: r.ref.Session, Resource: r.ref.Resource, Path: path},
		Kind:      kind,
		IsDir:     isDirectory,
		Size:      maxInt64(object.Size),
		Modified:  object.Modified.UnixMilli(),
		Extension: extension(name),
		MediaType: object.MediaType,
		Metadata:  object.Metadata,
		Revision:  externalprovider.Revision{ETag: object.ETag, VersionID: object.VersionID, ModifiedAt: object.Modified, Size: maxInt64(object.Size)},
	}
}

func joinKey(parent, name string, directory bool) string {
	if parent == "." {
		parent = ""
	}
	key := name
	if parent != "." && parent != "" {
		key = parent + "/" + name
	}
	if directory && !strings.HasSuffix(key, "/") {
		key += "/"
	}
	return key
}

func normalizeKey(value string) (string, error) {
	if strings.IndexByte(value, 0) >= 0 || strings.HasPrefix(value, "/") || strings.HasPrefix(value, "\\") {
		return "", externalprovider.ErrInvalidRequest
	}
	value = strings.ReplaceAll(value, "\\", "/")
	trailing := strings.HasSuffix(value, "/")
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
	result := strings.Join(clean, "/")
	if trailing && result != "" {
		result += "/"
	}
	return result, nil
}

func extension(name string) string {
	return strings.ToLower(pathpkg.Ext(name))
}

func entryID(ref externalprovider.ResourceRef, path string) string {
	hash := sha256.Sum256([]byte(string(ref.Provider) + "\x00" + string(ref.Session) + "\x00" + string(ref.Resource) + "\x00" + path))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}

func errorsIsNotFound(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "not found") || strings.Contains(strings.ToLower(err.Error()), "nosuch")
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
