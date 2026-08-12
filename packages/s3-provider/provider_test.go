package s3provider

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type fakeStore struct {
	objects map[string][]byte
}

func newFakeStore() *fakeStore {
	return &fakeStore{objects: map[string][]byte{
		"a.txt":       []byte("abcdef"),
		"b.txt":       []byte("xy"),
		"folder/c.md": []byte("nested"),
	}}
}

func (f *fakeStore) ListBuckets(context.Context, string, int) (BucketPage, error) {
	return BucketPage{Buckets: []BucketInfo{{Name: "bkt"}}}, nil
}

func (f *fakeStore) ListObjects(_ context.Context, _ string, prefix, delimiter, _ string, _ int) (ObjectPage, error) {
	page := ObjectPage{}
	seen := map[string]struct{}{}
	for key, value := range f.objects {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		rest := strings.TrimPrefix(key, prefix)
		if delimiter != "" {
			if slash := strings.IndexByte(rest, '/'); slash >= 0 {
				common := prefix + rest[:slash+1]
				if _, ok := seen[common]; !ok {
					seen[common] = struct{}{}
					page.Prefixes = append(page.Prefixes, common)
				}
				continue
			}
		}
		page.Objects = append(page.Objects, ObjectInfo{Key: key, Size: int64(len(value)), Modified: time.Unix(100, 0), ETag: "etag-" + key})
	}
	return page, nil
}

func (f *fakeStore) StatObject(_ context.Context, _ string, key string, _ externalprovider.Preconditions) (ObjectInfo, error) {
	value, ok := f.objects[key]
	if !ok {
		return ObjectInfo{}, externalprovider.ErrNotFound
	}
	return ObjectInfo{Key: key, Size: int64(len(value)), Modified: time.Unix(100, 0), ETag: "etag-" + key}, nil
}

func (f *fakeStore) OpenObject(_ context.Context, _ string, key string, value *externalprovider.ByteRange, _ externalprovider.Preconditions) (io.ReadCloser, ObjectInfo, error) {
	info, err := f.StatObject(context.Background(), "", key, externalprovider.Preconditions{})
	if err != nil {
		return nil, ObjectInfo{}, err
	}
	data := f.objects[key]
	start, end := int64(0), int64(len(data))
	if value != nil {
		start = value.Start
		end = int64(len(data))
		if value.End > 0 {
			end = value.End + 1
		}
		if start < 0 || start > end || end > int64(len(data)) {
			return nil, ObjectInfo{}, externalprovider.ErrInvalidRequest
		}
	}
	info.Size = end - start
	return io.NopCloser(bytes.NewReader(data[start:end])), info, nil
}

func (f *fakeStore) PutObject(_ context.Context, _ string, key string, body io.Reader, size int64, mediaType string, metadata map[string]string, _ externalprovider.Preconditions) (ObjectInfo, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return ObjectInfo{}, err
	}
	if size >= 0 && int64(len(data)) != size {
		return ObjectInfo{}, externalprovider.ErrInvalidRequest
	}
	f.objects[key] = data
	return ObjectInfo{Key: key, Size: int64(len(data)), MediaType: mediaType, Metadata: metadata, ETag: "etag-" + key}, nil
}

func (f *fakeStore) DeleteObject(_ context.Context, _ string, key string, recursive bool, _ externalprovider.Preconditions) error {
	if recursive {
		for name := range f.objects {
			if name == key || strings.HasPrefix(name, key) {
				delete(f.objects, name)
			}
		}
		return nil
	}
	if _, ok := f.objects[key]; !ok {
		return externalprovider.ErrNotFound
	}
	delete(f.objects, key)
	return nil
}

func (f *fakeStore) CopyObject(_ context.Context, _, sourceKey, _, destinationKey string, overwrite bool, _ externalprovider.Preconditions) (ObjectInfo, error) {
	data, ok := f.objects[sourceKey]
	if !ok {
		return ObjectInfo{}, externalprovider.ErrNotFound
	}
	if _, exists := f.objects[destinationKey]; exists && !overwrite {
		return ObjectInfo{}, externalprovider.ErrConflict
	}
	f.objects[destinationKey] = append([]byte(nil), data...)
	return ObjectInfo{Key: destinationKey, Size: int64(len(data)), ETag: "etag-" + destinationKey}, nil
}

func TestProviderObjectStoreContract(t *testing.T) {
	store := newFakeStore()
	provider, err := NewProviderWithFactory(Config{Endpoint: "http://127.0.0.1:9000", Bucket: "bkt", AllowInsecureHTTP: true}, func(context.Context, string, Credentials, Config) (ObjectStore, error) { return store, nil })
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{Endpoint: "http://127.0.0.1:9000"})
	if err != nil {
		t.Fatal(err)
	}
	resources, err := sessionValue.Resources(context.Background(), externalprovider.PageRequest{})
	if err != nil || len(resources.Resources) != 1 {
		t.Fatalf("bucket resource enumeration failed: %#v %v", resources, err)
	}
	root := resources.Resources[0].Ref
	raw, err := sessionValue.OpenResource(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	list, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 10}, DirectoriesFirst: true})
	if err != nil || len(list.Entries) != 3 || !list.Entries[0].IsDir {
		t.Fatalf("prefix/object listing failed: %#v %v", list, err)
	}
	opened, err := raw.(externalprovider.OpenResource).Open(context.Background(), externalprovider.OpenRequest{Target: externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: "bkt", Path: "a.txt"}, Range: &externalprovider.ByteRange{Start: 1, End: 3}})
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(opened.Reader)
	_ = opened.Reader.Close()
	if string(data) != "bcd" || opened.Size != 3 {
		t.Fatalf("object range failed: %q size=%d", data, opened.Size)
	}
	created, err := raw.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "new.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("new"), Size: 3})
	if err != nil || created.Count != 1 {
		t.Fatalf("object create failed: %#v %v", created, err)
	}
	_, err = raw.(externalprovider.MoveResource).Move(context.Background(), externalprovider.MoveRequest{Source: created.Entries[0].Ref, Destination: externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: "bkt", Path: "moved.txt"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := store.objects["moved.txt"]; !ok {
		t.Fatal("move did not delete/copy object")
	}
}

func TestProviderRejectsUnsafeEndpointAndKey(t *testing.T) {
	if _, err := NewProvider(Config{Endpoint: "http://127.0.0.1:9000", Bucket: "bkt"}); err == nil {
		t.Fatal("insecure endpoint accepted without explicit opt-in")
	}
	provider, err := NewProviderWithFactory(Config{Endpoint: "https://s3.example.com", Bucket: "bkt"}, func(context.Context, string, Credentials, Config) (ObjectStore, error) { return newFakeStore(), nil })
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{Endpoint: "https://s3.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	root := externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: "bkt"}
	resourceValue, _ := sessionValue.OpenResource(context.Background(), root)
	if _, err := resourceValue.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: "bkt", Path: "../escape"}}); err == nil {
		t.Fatal("unsafe object key accepted")
	}
}
