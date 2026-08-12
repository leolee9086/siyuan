package windowssmbmount

import (
	"bytes"
	"context"
	"errors"
	"io"
	"io/fs"
	"strings"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type fakeDiscoverer struct {
	mounts []Mount
	err    error
}

func (f fakeDiscoverer) Discover(context.Context) ([]Mount, error) {
	return append([]Mount(nil), f.mounts...), f.err
}

type fakeNode struct {
	info    FileInfo
	content []byte
}

type fakeFileSystem struct {
	nodes map[string]fakeNode
}

func newFakeFileSystem() *fakeFileSystem {
	return &fakeFileSystem{nodes: map[string]fakeNode{
		"":             {info: FileInfo{Name: "视频素材", IsDir: true}},
		"folder":       {info: FileInfo{Name: "folder", IsDir: true}},
		"folder/a.txt": {info: FileInfo{Name: "a.txt", Size: 6}, content: []byte("abcdef")},
		"root.txt":     {info: FileInfo{Name: "root.txt", Size: 4}, content: []byte("root")},
	}}
}

func (f *fakeFileSystem) ReadDir(_ context.Context, parent string) ([]FileInfo, error) {
	parent = strings.Trim(parent, "/")
	prefix := parent
	if prefix != "" {
		prefix += "/"
	}
	seen := make(map[string]struct{})
	result := make([]FileInfo, 0)
	for path, node := range f.nodes {
		if path == parent || !strings.HasPrefix(path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(path, prefix)
		name := rest
		if slash := strings.IndexByte(rest, '/'); slash >= 0 {
			name = rest[:slash]
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		if slash := strings.IndexByte(rest, '/'); slash >= 0 {
			result = append(result, FileInfo{Name: name, IsDir: true})
		} else {
			result = append(result, node.info)
		}
	}
	return result, nil
}

func (f *fakeFileSystem) Stat(_ context.Context, path string) (FileInfo, error) {
	node, ok := f.nodes[strings.Trim(path, "/")]
	if !ok {
		return FileInfo{}, fs.ErrNotExist
	}
	return node.info, nil
}

func (f *fakeFileSystem) Open(_ context.Context, path string) (io.ReadCloser, error) {
	node, ok := f.nodes[strings.Trim(path, "/")]
	if !ok || node.info.IsDir {
		return nil, fs.ErrNotExist
	}
	return io.NopCloser(bytes.NewReader(node.content)), nil
}

func (f *fakeFileSystem) Create(_ context.Context, path string, content io.Reader, size int64, _ fs.FileMode) error {
	path = strings.Trim(path, "/")
	if content == nil {
		f.nodes[path] = fakeNode{info: FileInfo{Name: path[strings.LastIndexByte(path, '/')+1:], IsDir: true}}
		return nil
	}
	data, err := io.ReadAll(content)
	if err != nil {
		return err
	}
	if size >= 0 && int64(len(data)) != size {
		return fs.ErrInvalid
	}
	f.nodes[path] = fakeNode{info: FileInfo{Name: path[strings.LastIndexByte(path, '/')+1:], Size: int64(len(data))}, content: data}
	return nil
}

func (f *fakeFileSystem) Rename(_ context.Context, source, destination string) error {
	node, ok := f.nodes[strings.Trim(source, "/")]
	if !ok {
		return fs.ErrNotExist
	}
	delete(f.nodes, strings.Trim(source, "/"))
	node.info.Name = destination[strings.LastIndexByte(destination, '/')+1:]
	f.nodes[strings.Trim(destination, "/")] = node
	return nil
}

func (f *fakeFileSystem) Remove(_ context.Context, path string, _ bool) error {
	path = strings.Trim(path, "/")
	if path == "" {
		return fs.ErrInvalid
	}
	if _, ok := f.nodes[path]; !ok {
		return fs.ErrNotExist
	}
	delete(f.nodes, path)
	return nil
}

func (f *fakeFileSystem) Copy(_ context.Context, source, destination string, _ bool) error {
	node, ok := f.nodes[strings.Trim(source, "/")]
	if !ok {
		return fs.ErrNotExist
	}
	f.nodes[strings.Trim(destination, "/")] = node
	return nil
}

func TestNormalizeMountsKeepsDistinctSharesAndAliases(t *testing.T) {
	resources, err := normalizeMounts([]Mount{
		{LocalName: "N:", RemoteName: `\\192.168.31.195\视频素材`},
		{LocalName: "O:", RemoteName: `\\192.168.31.195\工作文件`},
		{LocalName: "n:", RemoteName: `\\192.168.31.195\视频素材`},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 2 {
		t.Fatalf("expected two shares, got %d", len(resources))
	}
	if resources[0].id == resources[1].id || resources[0].share == resources[1].share {
		t.Fatalf("distinct shares collapsed into one resource: %#v", resources)
	}
	if len(resources[0].aliases)+len(resources[1].aliases) != 2 {
		t.Fatalf("duplicate mapped aliases were not deduplicated: %#v", resources)
	}
	if _, _, _, err := parseUNC(`\\192.168.31.195\视频素材\child`); !errors.Is(err, ErrInvalidEndpoint) {
		t.Fatalf("subdirectory was accepted as an SMB share: %v", err)
	}
}

func TestProviderSessionListsDistinctResourcesWithOpaqueRefs(t *testing.T) {
	files := newFakeFileSystem()
	provider := NewProvider(Config{
		Discoverer: fakeDiscoverer{mounts: []Mount{
			{LocalName: "N:", RemoteName: `\\192.168.31.195\视频素材`},
			{LocalName: "O:", RemoteName: `\\192.168.31.195\工作文件`},
		}},
		FileSystems: func(string) FileSystem { return files },
	})
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	page, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Resources) != 2 || page.Resources[0].ID == page.Resources[1].ID {
		t.Fatalf("mapped shares were not retained as distinct resources: %#v", page)
	}
	for _, descriptor := range page.Resources {
		if descriptor.Ref.Path != "" || descriptor.Source.Name != "192.168.31.195" {
			t.Fatalf("physical path crossed descriptor boundary: %#v", descriptor)
		}
	}
	resourceValue, err := sessionValue.OpenResource(context.Background(), page.Resources[0].Ref)
	if err != nil {
		t.Fatal(err)
	}
	root := page.Resources[0].Ref
	rootPage, err := resourceValue.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 1}, DirectoriesFirst: true})
	if err != nil || len(rootPage.Entries) != 1 || !rootPage.HasMore {
		t.Fatalf("directory paging failed: %#v %v", rootPage, err)
	}
	if _, err := resourceValue.(externalprovider.OpenResource).Open(context.Background(), externalprovider.OpenRequest{Target: externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: root.Resource, Path: "../escape"}}); !errors.Is(err, externalprovider.ErrInvalidRequest) {
		t.Fatalf("path traversal was accepted: %v", err)
	}
}

func TestProviderRejectsMissingMappedSharesAndReadOnlyWrites(t *testing.T) {
	provider := NewProvider(Config{Discoverer: fakeDiscoverer{}})
	if _, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{}); !errors.Is(err, ErrNoMappedShares) {
		t.Fatalf("missing mapped shares did not fail explicitly: %v", err)
	}
	provider = NewProvider(Config{
		Discoverer:  fakeDiscoverer{mounts: []Mount{{RemoteName: `\\nas\share`}}},
		FileSystems: func(string) FileSystem { return newFakeFileSystem() },
	})
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	page, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	resourceValue, err := sessionValue.OpenResource(context.Background(), page.Resources[0].Ref)
	if err != nil {
		t.Fatal(err)
	}
	_, err = resourceValue.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: page.Resources[0].Ref, Name: "new.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("x"), Size: 1})
	if !errors.Is(err, externalprovider.ErrPermission) {
		t.Fatalf("read-only SMB resource accepted a write: %v", err)
	}
}
