package synologyfilestation

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	pathpkg "path"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type fakeClient struct {
	mu          sync.Mutex
	files       map[string]FileInfo
	contents    map[string][]byte
	loggedIn    bool
	loggedOut   bool
	shareLists  int
	outsideList bool
	lastTask    Operation
}

func newFakeClient() *fakeClient {
	modified := time.Unix(100, 0)
	return &fakeClient{
		files: map[string]FileInfo{
			"/share":                  {Path: "/share", Name: "share", IsDir: true, Modified: modified},
			"/share/a.txt":            {Path: "/share/a.txt", Name: "a.txt", Size: 6, Modified: modified},
			"/share/folder":           {Path: "/share/folder", Name: "folder", IsDir: true, Modified: modified},
			"/share/folder/nested.md": {Path: "/share/folder/nested.md", Name: "nested.md", Size: 6, Modified: modified},
		},
		contents: map[string][]byte{
			"/share/a.txt":            []byte("abcdef"),
			"/share/folder/nested.md": []byte("nested"),
		},
	}
}

func (f *fakeClient) Login(_ context.Context, credentials Credentials) (string, error) {
	if credentials.Account != "tester" || credentials.Password != "secret" {
		return "", externalprovider.ErrPermission
	}
	f.mu.Lock()
	f.loggedIn = true
	f.mu.Unlock()
	return "remote-sid", nil
}

func (f *fakeClient) Logout(context.Context, string) error {
	f.mu.Lock()
	f.loggedOut = true
	f.mu.Unlock()
	return nil
}

func (f *fakeClient) ListShares(context.Context, string) ([]ShareInfo, error) {
	f.mu.Lock()
	f.shareLists++
	f.mu.Unlock()
	return []ShareInfo{
		{Name: "视频素材", Path: "/video-assets"},
		{Name: "工作文件", Path: "/work-files"},
	}, nil
}

func (f *fakeClient) shareListCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.shareLists
}

func (f *fakeClient) List(_ context.Context, _ string, folder string, offset, limit int, _ []externalprovider.SortTerm) (FilePage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.outsideList {
		return FilePage{Files: []FileInfo{{Path: "/other/leak.txt", Name: "leak.txt"}}, Total: 1, TotalKnown: true}, nil
	}
	paths := make([]string, 0)
	for filePath := range f.files {
		if filePath != folder && pathpkg.Dir(filePath) == folder {
			paths = append(paths, filePath)
		}
	}
	sort.Strings(paths)
	if offset > len(paths) {
		offset = len(paths)
	}
	end := offset + limit
	if end > len(paths) {
		end = len(paths)
	}
	files := make([]FileInfo, 0, end-offset)
	for _, filePath := range paths[offset:end] {
		files = append(files, f.files[filePath])
	}
	return FilePage{Files: files, Total: len(paths), TotalKnown: true}, nil
}

func (f *fakeClient) Stat(_ context.Context, _ string, filePath string) (FileInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	info, ok := f.files[filePath]
	if !ok {
		return FileInfo{}, externalprovider.ErrNotFound
	}
	return info, nil
}

func (f *fakeClient) Open(_ context.Context, _ string, filePath string, byteRange *externalprovider.ByteRange) (io.ReadCloser, FileInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	info, ok := f.files[filePath]
	if !ok {
		return nil, FileInfo{}, externalprovider.ErrNotFound
	}
	data := f.contents[filePath]
	start, end := int64(0), int64(len(data))
	if byteRange != nil {
		start = byteRange.Start
		if byteRange.End > 0 {
			end = byteRange.End + 1
		}
	}
	if start < 0 || start > end || end > int64(len(data)) {
		return nil, FileInfo{}, externalprovider.ErrInvalidRequest
	}
	return io.NopCloser(bytes.NewReader(data[start:end])), info, nil
}

func (f *fakeClient) CreateFolder(_ context.Context, _ string, parent, name string) (FileInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	filePath := pathpkg.Join(parent, name)
	if _, exists := f.files[filePath]; exists {
		return FileInfo{}, externalprovider.ErrConflict
	}
	info := FileInfo{Path: filePath, Name: name, IsDir: true, Modified: time.Unix(200, 0)}
	f.files[filePath] = info
	return info, nil
}

func (f *fakeClient) Upload(_ context.Context, _ string, parent, name string, body io.Reader, size int64, mediaType string, overwrite bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	filePath := pathpkg.Join(parent, name)
	if _, exists := f.files[filePath]; exists && !overwrite {
		return externalprovider.ErrConflict
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	if int64(len(data)) != size {
		return externalprovider.ErrInvalidRequest
	}
	f.contents[filePath] = data
	f.files[filePath] = FileInfo{Path: filePath, Name: name, Size: size, MediaType: mediaType, Modified: time.Unix(200, 0)}
	return nil
}

func (f *fakeClient) Rename(_ context.Context, _ string, filePath, name string) (FileInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	info, ok := f.files[filePath]
	if !ok {
		return FileInfo{}, externalprovider.ErrNotFound
	}
	destination := pathpkg.Join(pathpkg.Dir(filePath), name)
	delete(f.files, filePath)
	info.Path = destination
	info.Name = name
	f.files[destination] = info
	if content, exists := f.contents[filePath]; exists {
		delete(f.contents, filePath)
		f.contents[destination] = content
	}
	return info, nil
}

func (f *fakeClient) Delete(_ context.Context, _ string, _ []string, _ bool) (Operation, error) {
	return Operation{ID: "delete-task", API: "SYNO.FileStation.Delete", Version: 2}, nil
}

func (f *fakeClient) CopyMove(_ context.Context, _ string, _ []string, _ string, move, _ bool) (Operation, error) {
	id := "copy-task"
	if move {
		id = "move-task"
	}
	return Operation{ID: id, API: "SYNO.FileStation.CopyMove", Version: 3}, nil
}

func (f *fakeClient) Task(_ context.Context, _ string, operation Operation) (TaskStatus, error) {
	f.mu.Lock()
	f.lastTask = operation
	f.mu.Unlock()
	return TaskStatus{ID: operation.ID, State: externalprovider.OperationCompleted, Progress: 100}, nil
}

func TestProviderResourceContractAndOperations(t *testing.T) {
	fake := newFakeClient()
	provider, err := NewProviderWithFactory(Config{
		Endpoint:          "http://127.0.0.1:5000",
		RootPath:          "/share",
		AllowInsecureHTTP: true,
		Credentials:       Credentials{Account: "tester", Password: "secret"},
	}, func(_ *http.Client, endpoint string) (Client, error) {
		if endpoint != "http://127.0.0.1:5000" {
			t.Fatalf("unexpected endpoint %q", endpoint)
		}
		return fake, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{})
	if err != nil {
		t.Fatal(err)
	}
	resources, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 1})
	if err != nil || len(resources.Resources) != 1 || resources.Resources[0].Ref.Path != "" {
		t.Fatalf("resource enumeration failed: %#v %v", resources, err)
	}
	root := resources.Resources[0].Ref
	raw, err := sessionValue.OpenResource(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	childResource, err := sessionValue.OpenResource(context.Background(), externalprovider.ResourceRef{
		Provider: provider.ID(), Session: sessionValue.ID(), Resource: RootResourceID, Path: "folder/nested.md",
	})
	if err != nil {
		t.Fatal(err)
	}
	if childResource.Ref().Path != "" || childResource.Descriptor().Ref.Path != "" {
		t.Fatalf("OpenResource returned a child address instead of the share root: ref=%#v descriptor=%#v", childResource.Ref(), childResource.Descriptor())
	}
	first, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 1}})
	if err != nil || len(first.Entries) != 1 || !first.HasMore || first.NextCursor == "" || first.Total != 2 {
		t.Fatalf("first page failed: %#v %v", first, err)
	}
	second, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 1, Cursor: first.NextCursor}})
	if err != nil || len(second.Entries) != 1 || second.HasMore {
		t.Fatalf("second page failed: %#v %v", second, err)
	}
	recursive, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 10}, Recursive: true, DirectoriesFirst: true})
	if err != nil || recursive.Total != 3 || len(recursive.Entries) != 3 || !recursive.Entries[0].IsDir {
		t.Fatalf("recursive listing failed: %#v %v", recursive, err)
	}
	target := externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: RootResourceID, Path: "a.txt"}
	stat, err := raw.(externalprovider.StatResource).Stat(context.Background(), externalprovider.StatRequest{Target: target})
	if err != nil || stat.Path != "a.txt" || stat.Revision.ETag == "" {
		t.Fatalf("stat failed: %#v %v", stat, err)
	}
	opened, err := raw.(externalprovider.OpenResource).Open(context.Background(), externalprovider.OpenRequest{Target: target, Range: &externalprovider.ByteRange{Start: 1, End: 3}})
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(opened.Reader)
	closeErr := opened.Reader.Close()
	if readErr != nil || closeErr != nil || string(data) != "bcd" || opened.Size != 3 {
		t.Fatalf("range open failed: %q size=%d read=%v close=%v", data, opened.Size, readErr, closeErr)
	}
	created, err := raw.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "new.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("new"), Size: 3, MediaType: "text/plain"})
	if err != nil || created.Count != 1 || len(created.Entries) != 1 || created.OperationRef != nil {
		t.Fatalf("synchronous upload failed: %#v %v", created, err)
	}
	renamed, err := raw.(externalprovider.UpdateResource).Update(context.Background(), externalprovider.UpdateRequest{Target: created.Entries[0].Ref, NewName: "renamed.txt", Size: -1})
	if err != nil || renamed.Target != "renamed.txt" || len(renamed.Entries) != 1 {
		t.Fatalf("synchronous rename failed: %#v %v", renamed, err)
	}
	deleted, err := raw.(externalprovider.DeleteResource).Delete(context.Background(), externalprovider.DeleteRequest{Targets: []externalprovider.ResourceRef{renamed.Entries[0].Ref}, Recursive: true})
	if err != nil || deleted.OperationRef == nil || deleted.OperationRef.ID == "delete-task" {
		t.Fatalf("asynchronous delete failed: %#v %v", deleted, err)
	}
	status, err := provider.Operation(context.Background(), *deleted.OperationRef)
	if err != nil || status.State != externalprovider.OperationCompleted || status.Progress != 100 || fake.lastTask.ID != "delete-task" {
		t.Fatalf("task polling failed: %#v %v remote=%#v", status, err, fake.lastTask)
	}
	if _, err := sessionValue.OpenResource(context.Background(), externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: RootResourceID, Path: "../escape"}); !errors.Is(err, externalprovider.ErrInvalidRequest) {
		t.Fatalf("path traversal was not rejected: %v", err)
	}
	fake.outsideList = true
	if _, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 10}}); !errors.Is(err, externalprovider.ErrResponse) {
		t.Fatalf("out-of-root response was not rejected: %v", err)
	}
	if err := sessionValue.Close(); err != nil || !fake.loggedOut {
		t.Fatalf("logout failed: %v loggedOut=%v", err, fake.loggedOut)
	}
	if _, err := provider.Operation(context.Background(), *deleted.OperationRef); !errors.Is(err, externalprovider.ErrNotFound) {
		t.Fatalf("closed session retained operation: %v", err)
	}
}

func TestProviderReadOnlyBoundary(t *testing.T) {
	fake := newFakeClient()
	provider, err := NewProviderWithFactory(Config{Endpoint: "https://nas.example.test", RootPath: "/share", Credentials: Credentials{Account: "tester", Password: "secret"}}, func(*http.Client, string) (Client, error) {
		return fake, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	root := externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: RootResourceID}
	raw, err := sessionValue.OpenResource(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	_, err = raw.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "blocked.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("x"), Size: 1})
	if !errors.Is(err, externalprovider.ErrPermission) {
		t.Fatalf("read-only mutation was not rejected: %v", err)
	}
}

func TestProviderDiscoversAllVisibleSharesAsIndependentResources(t *testing.T) {
	fake := newFakeClient()
	provider, err := NewProviderWithFactory(Config{
		Endpoint:    "https://nas.example.test",
		Credentials: Credentials{Account: "tester", Password: "secret"},
	}, func(*http.Client, string) (Client, error) {
		return fake, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sessionValue.Close() })

	first, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if first.Total == nil || *first.Total != 2 || len(first.Resources) != 1 || !first.HasMore || first.NextCursor == "" {
		t.Fatalf("unexpected first share page: %#v", first)
	}
	second, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 1, Cursor: first.NextCursor})
	if err != nil {
		t.Fatal(err)
	}
	if second.Total == nil || *second.Total != 2 || len(second.Resources) != 1 || second.HasMore {
		t.Fatalf("unexpected second share page: %#v", second)
	}
	left, right := first.Resources[0], second.Resources[0]
	if left.ID == right.ID || left.ID == RootResourceID || right.ID == RootResourceID {
		t.Fatalf("share resources are not independently identified: %#v %#v", left, right)
	}
	if left.Ref.Path != "" || right.Ref.Path != "" || left.Ref.Resource != left.ID || right.Ref.Resource != right.ID {
		t.Fatalf("share roots leaked a path or have mismatched refs: %#v %#v", left, right)
	}
	if count := fake.shareListCount(); count != 1 {
		t.Fatalf("expected one list_share call, got %d", count)
	}
	if _, err := sessionValue.OpenResource(context.Background(), externalprovider.ResourceRef{
		Provider: provider.ID(), Session: sessionValue.ID(), Resource: "missing-share",
	}); !errors.Is(err, externalprovider.ErrNotFound) {
		t.Fatalf("unknown share resource was not rejected as not found: %v", err)
	}
	if _, err := sessionValue.OpenResource(context.Background(), externalprovider.ResourceRef{
		Provider: provider.ID(), Session: sessionValue.ID(), Resource: left.ID, Path: "../outside",
	}); !errors.Is(err, externalprovider.ErrInvalidRequest) {
		t.Fatalf("share-relative traversal was not rejected: %v", err)
	}
}

type malformedShareClient struct {
	*fakeClient
}

type emptyShareClient struct {
	*fakeClient
}

func (f *emptyShareClient) ListShares(context.Context, string) ([]ShareInfo, error) {
	return []ShareInfo{}, nil
}

func (f *malformedShareClient) ListShares(context.Context, string) ([]ShareInfo, error) {
	return []ShareInfo{{Name: "bad", Path: "../outside"}}, nil
}

func TestProviderRejectsMalformedDiscoveredShareAndLogsOut(t *testing.T) {
	fake := newFakeClient()
	provider, err := NewProviderWithFactory(Config{
		Endpoint:    "https://nas.example.test",
		Credentials: Credentials{Account: "tester", Password: "secret"},
	}, func(*http.Client, string) (Client, error) {
		return &malformedShareClient{fakeClient: fake}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{}); !errors.Is(err, externalprovider.ErrResponse) {
		t.Fatalf("malformed share was not rejected: %v", err)
	}
	if !fake.loggedOut {
		t.Fatal("failed share discovery did not close the authenticated DSM session")
	}
}

func TestProviderPreservesAnEmptyVisibleShareSet(t *testing.T) {
	fake := newFakeClient()
	provider, err := NewProviderWithFactory(Config{
		Endpoint:    "https://nas.example.test",
		Credentials: Credentials{Account: "tester", Password: "secret"},
	}, func(*http.Client, string) (Client, error) {
		return &emptyShareClient{fakeClient: fake}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{})
	if err != nil {
		t.Fatal(err)
	}
	defer sessionValue.Close()
	page, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total == nil || *page.Total != 0 || len(page.Resources) != 0 || page.HasMore {
		t.Fatalf("empty DSM share discovery was not preserved: %#v", page)
	}
}
