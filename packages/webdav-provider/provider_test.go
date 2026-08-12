package webdavprovider

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type fakeDAV struct {
	files map[string]fakeFile
}

type fakeFile struct {
	data []byte
	dir  bool
}

func newFakeDAV() *fakeDAV {
	return &fakeDAV{files: map[string]fakeFile{
		"":             {dir: true},
		"a.txt":        {data: []byte("abcdef")},
		"b.txt":        {data: []byte("xy")},
		"folder":       {dir: true},
		"folder/c.txt": {data: []byte("nested")},
	}}
}

func (f *fakeDAV) Stat(_ context.Context, name string) (*FileInfo, error) {
	file, ok := f.files[strings.Trim(name, "/")]
	if !ok {
		return nil, externalprovider.ErrNotFound
	}
	return &FileInfo{Path: name, Size: int64(len(file.data)), IsDir: file.dir, ModTime: time.Unix(100, 0), ETag: "etag-" + strings.Trim(name, "/")}, nil
}

func (f *fakeDAV) ReadDir(_ context.Context, name string, recursive bool) ([]FileInfo, error) {
	parent := strings.Trim(name, "/")
	result := make([]FileInfo, 0)
	for path, file := range f.files {
		if path == parent || path == "" {
			continue
		}
		dir := path
		if slash := strings.LastIndexByte(dir, '/'); slash >= 0 {
			dir = dir[:slash]
		} else {
			dir = ""
		}
		if recursive {
			if parent != "" && !strings.HasPrefix(path, parent+"/") {
				continue
			}
		} else if dir != parent {
			continue
		}
		result = append(result, FileInfo{Path: path, Size: int64(len(file.data)), IsDir: file.dir, ModTime: time.Unix(100, 0), ETag: "etag-" + path})
	}
	return result, nil
}

func (f *fakeDAV) Open(_ context.Context, name string) (io.ReadCloser, error) {
	file, ok := f.files[strings.Trim(name, "/")]
	if !ok || file.dir {
		return nil, externalprovider.ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(file.data)), nil
}

func (f *fakeDAV) Create(_ context.Context, name string) (io.WriteCloser, error) {
	return &fakeWriter{commit: func(data []byte) { f.files[strings.Trim(name, "/")] = fakeFile{data: data} }}, nil
}

func (f *fakeDAV) Mkdir(_ context.Context, name string) error {
	f.files[strings.Trim(name, "/")] = fakeFile{dir: true}
	return nil
}

func (f *fakeDAV) RemoveAll(_ context.Context, name string) error {
	name = strings.Trim(name, "/")
	for path := range f.files {
		if path == name || strings.HasPrefix(path, name+"/") {
			delete(f.files, path)
		}
	}
	return nil
}

func (f *fakeDAV) Copy(_ context.Context, source, destination string, overwrite bool) error {
	return f.copy(source, destination, overwrite)
}

func (f *fakeDAV) Move(_ context.Context, source, destination string, overwrite bool) error {
	if err := f.copy(source, destination, overwrite); err != nil {
		return err
	}
	return f.RemoveAll(context.Background(), source)
}

func (f *fakeDAV) copy(source, destination string, overwrite bool) error {
	source = strings.Trim(source, "/")
	destination = strings.Trim(destination, "/")
	file, ok := f.files[source]
	if !ok {
		return externalprovider.ErrNotFound
	}
	if _, exists := f.files[destination]; exists && !overwrite {
		return externalprovider.ErrConflict
	}
	f.files[destination] = file
	return nil
}

type fakeWriter struct {
	bytes.Buffer
	commit func([]byte)
}

func (w *fakeWriter) Close() error {
	w.commit(append([]byte(nil), w.Bytes()...))
	return nil
}

func TestProviderSessionAndResourceLifecycle(t *testing.T) {
	fake := newFakeDAV()
	provider := NewProviderWithOptions(Options{
		AllowInsecureHTTP: true,
		ClientFactory:     func(*http.Client, string, Credentials) (Client, error) { return fake, nil },
	})
	s, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{Endpoint: "http://127.0.0.1:8080/dav"})
	if err != nil {
		t.Fatal(err)
	}
	page, err := s.Resources(context.Background(), externalprovider.PageRequest{})
	if err != nil || len(page.Resources) != 1 || page.Resources[0].Ref.Session != s.ID() {
		t.Fatalf("resource descriptor lost opaque reference: %#v %v", page, err)
	}
	resourceValue, err := s.OpenResource(context.Background(), page.Resources[0].Ref)
	if err != nil {
		t.Fatal(err)
	}
	resource := resourceValue.(externalprovider.ListResource)
	list, err := resource.List(context.Background(), externalprovider.ListRequest{Parent: page.Resources[0].Ref, Page: externalprovider.PageRequest{Limit: 1}})
	if err != nil || len(list.Entries) != 1 || !list.HasMore || list.NextCursor == "" {
		t.Fatalf("first page contract failed: %#v %v", list, err)
	}
	next, err := resource.List(context.Background(), externalprovider.ListRequest{Parent: page.Resources[0].Ref, Page: externalprovider.PageRequest{Limit: 1, Cursor: list.NextCursor}})
	if err != nil || len(next.Entries) != 1 {
		t.Fatalf("cursor was not provider-owned and repeatable: %#v %v", next, err)
	}
	if _, err := resource.List(context.Background(), externalprovider.ListRequest{Parent: externalprovider.ResourceRef{Provider: provider.ID(), Session: s.ID(), Resource: RootResourceID, Path: "../escape"}}); err == nil {
		t.Fatal("path traversal was accepted")
	}
	opened, err := resource.(externalprovider.OpenResource).Open(context.Background(), externalprovider.OpenRequest{Target: externalprovider.ResourceRef{Provider: provider.ID(), Session: s.ID(), Resource: RootResourceID, Path: "a.txt"}, Range: &externalprovider.ByteRange{Start: 1, End: 3}})
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(opened.Reader)
	_ = opened.Reader.Close()
	if string(data) != "bcd" || opened.Size != 3 {
		t.Fatalf("range semantics incorrect: %q size=%d", data, opened.Size)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Resources(context.Background(), externalprovider.PageRequest{}); err != ErrClosed {
		t.Fatalf("closed session remained usable: %v", err)
	}
}

func TestProviderMutationsAndReadOnlyBoundary(t *testing.T) {
	fake := newFakeDAV()
	provider := NewProviderWithOptions(Options{AllowInsecureHTTP: true, ClientFactory: func(*http.Client, string, Credentials) (Client, error) { return fake, nil }})
	s, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{Endpoint: "http://127.0.0.1:8080"})
	if err != nil {
		t.Fatal(err)
	}
	root := externalprovider.ResourceRef{Provider: provider.ID(), Session: s.ID(), Resource: RootResourceID}
	raw, _ := s.OpenResource(context.Background(), root)
	resource := raw.(externalprovider.CreateResource)
	created, err := resource.Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "new.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("new"), Size: 3})
	if err != nil || created.Count != 1 {
		t.Fatalf("create failed: %#v %v", created, err)
	}
	updated, err := raw.(externalprovider.UpdateResource).Update(context.Background(), externalprovider.UpdateRequest{Target: created.Entries[0].Ref, NewName: "renamed.txt"})
	if err != nil || updated.Target != "renamed.txt" {
		t.Fatalf("rename failed: %#v %v", updated, err)
	}
	_, err = raw.(externalprovider.CopyResource).Copy(context.Background(), externalprovider.CopyRequest{Source: updated.Entries[0].Ref, Destination: externalprovider.ResourceRef{Provider: provider.ID(), Session: s.ID(), Resource: RootResourceID, Path: "copy.txt"}})
	if err != nil {
		t.Fatal(err)
	}
	deleted, err := raw.(externalprovider.DeleteResource).Delete(context.Background(), externalprovider.DeleteRequest{Targets: []externalprovider.ResourceRef{updated.Entries[0].Ref}})
	if err != nil || deleted.Count != 1 {
		t.Fatalf("delete failed: %#v %v", deleted, err)
	}
	readOnly, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{Endpoint: "http://127.0.0.1:8080", ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	rawReadOnly, _ := readOnly.OpenResource(context.Background(), rootFor(readOnly, provider.ID()))
	if _, err := rawReadOnly.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: rootFor(readOnly, provider.ID()), Name: "blocked.txt", Kind: externalprovider.EntryKindDirectory}); err != externalprovider.ErrPermission {
		t.Fatalf("read-only session allowed mutation: %v", err)
	}
}

func rootFor(session externalprovider.Session, provider externalprovider.ProviderID) externalprovider.ResourceRef {
	return externalprovider.ResourceRef{Provider: provider, Session: session.ID(), Resource: RootResourceID}
}
