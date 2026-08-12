package synologyfilestation

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type synologyFixture struct {
	t            *testing.T
	mu           sync.Mutex
	files        map[string][]byte
	discoveries  int
	loginQueries int
}

func newSynologyFixture(t *testing.T) *synologyFixture {
	return &synologyFixture{t: t, files: map[string][]byte{"/share/a.txt": []byte("abcdef")}}
}

func (f *synologyFixture) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	switch request.URL.Path {
	case "/webapi/query.cgi":
		f.discoveries++
		if request.URL.Query().Get("query") != synologyDiscoveryQuery {
			f.t.Errorf("unexpected API discovery query: %s", request.URL.RawQuery)
		}
		apis := map[string]apiInfo{
			"SYNO.API.Auth":                 {Path: "auth.cgi", MinVersion: 2, MaxVersion: 6},
			"SYNO.FileStation.List":         {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
			"SYNO.FileStation.Download":     {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
			"SYNO.FileStation.Upload":       {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
			"SYNO.FileStation.CreateFolder": {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
			"SYNO.FileStation.Rename":       {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
			"SYNO.FileStation.CopyMove":     {Path: "entry.cgi", MinVersion: 3, MaxVersion: 3},
			"SYNO.FileStation.Delete":       {Path: "entry.cgi", MinVersion: 2, MaxVersion: 2},
		}
		writeSuccess(writer, apis)
	case "/webapi/auth.cgi":
		f.handleAuth(writer, request)
	case "/webapi/entry.cgi":
		f.handleEntry(writer, request)
	default:
		http.NotFound(writer, request)
	}
}

func (f *synologyFixture) handleAuth(writer http.ResponseWriter, request *http.Request) {
	method := request.URL.Query().Get("method")
	if request.Method == http.MethodPost {
		if request.URL.Query().Get("account") != "" || request.URL.Query().Get("passwd") != "" {
			f.loginQueries++
			f.t.Errorf("credentials leaked into URL: %s", request.URL.RawQuery)
		}
		if err := request.ParseForm(); err != nil {
			f.t.Error(err)
		}
		method = request.Form.Get("method")
		if request.Form.Get("account") != "tester" || request.Form.Get("passwd") != "secret" {
			f.t.Errorf("login form mismatch: %#v", request.Form)
		}
	}
	switch method {
	case "login":
		writeSuccess(writer, map[string]string{"sid": "fixture-sid"})
	case "logout":
		writeSuccess(writer, nil)
	default:
		writeFailure(writer, 103)
	}
}

func (f *synologyFixture) handleEntry(writer http.ResponseWriter, request *http.Request) {
	if strings.HasPrefix(request.Header.Get("Content-Type"), "multipart/form-data") {
		f.handleUpload(writer, request)
		return
	}
	if err := request.ParseForm(); err != nil {
		f.t.Error(err)
	}
	api, method := request.Form.Get("api"), request.Form.Get("method")
	switch api + "/" + method {
	case "SYNO.FileStation.List/list_share":
		if request.Form.Get("folder_path") != "" {
			f.t.Errorf("list_share unexpectedly received a folder path: %#v", request.Form)
		}
		writeSuccess(writer, map[string]any{"shares": []any{
			f.fileData("/video-assets", true),
			f.fileData("/work-files", true),
		}})
	case "SYNO.FileStation.List/list":
		if request.Form.Get("folder_path") != "/share" || request.Form.Get("additional") != fileMetadataFields {
			f.t.Errorf("list request mismatch: %#v", request.Form)
		}
		writeSuccess(writer, map[string]any{"offset": 0, "total": 1, "files": []any{f.fileData("/share/a.txt", false)}})
	case "SYNO.FileStation.List/getinfo":
		paths := parseJSONArray(f.t, request.Form.Get("path"))
		if len(paths) != 1 {
			f.t.Errorf("getinfo path mismatch: %#v", paths)
			writeFailure(writer, 400)
			return
		}
		f.mu.Lock()
		_, exists := f.files[paths[0]]
		f.mu.Unlock()
		if !exists && paths[0] != "/share/new-folder" && paths[0] != "/share/renamed.txt" {
			writeSuccess(writer, map[string]any{"files": []any{}})
			return
		}
		writeSuccess(writer, map[string]any{"files": []any{f.fileData(paths[0], paths[0] == "/share/new-folder")}})
	case "SYNO.FileStation.Download/download":
		if request.Header.Get("Range") != "bytes=1-3" || len(parseJSONArray(f.t, request.Form.Get("path"))) != 1 {
			f.t.Errorf("download range mismatch: range=%q form=%#v", request.Header.Get("Range"), request.Form)
		}
		writer.Header().Set("Content-Range", "bytes 1-3/6")
		writer.WriteHeader(http.StatusPartialContent)
		_, _ = writer.Write([]byte("bcd"))
	case "SYNO.FileStation.CreateFolder/create":
		parents := parseJSONArray(f.t, request.Form.Get("folder_path"))
		names := parseJSONArray(f.t, request.Form.Get("name"))
		if len(parents) != 1 || parents[0] != "/share" || len(names) != 1 || names[0] != "new-folder" || request.Form.Get("force_parent") != "false" {
			f.t.Errorf("create-folder encoding mismatch: %#v", request.Form)
		}
		writeSuccess(writer, map[string]any{"folders": []any{f.fileData("/share/new-folder", true)}})
	case "SYNO.FileStation.Rename/rename":
		paths := parseJSONArray(f.t, request.Form.Get("path"))
		names := parseJSONArray(f.t, request.Form.Get("name"))
		if len(paths) != 1 || paths[0] != "/share/new.txt" || len(names) != 1 || names[0] != "renamed.txt" {
			f.t.Errorf("rename encoding mismatch: %#v", request.Form)
		}
		f.mu.Lock()
		f.files["/share/renamed.txt"] = f.files["/share/new.txt"]
		delete(f.files, "/share/new.txt")
		f.mu.Unlock()
		writeSuccess(writer, map[string]any{"files": []any{f.fileData("/share/renamed.txt", false)}})
	case "SYNO.FileStation.Delete/start":
		paths := parseJSONArray(f.t, request.Form.Get("path"))
		if len(paths) != 1 || paths[0] != "/share/renamed.txt" || request.Form.Get("accurate_progress") != "true" {
			f.t.Errorf("delete encoding mismatch: %#v", request.Form)
		}
		writeSuccess(writer, map[string]string{"taskid": "remote-delete"})
	case "SYNO.FileStation.Delete/status":
		if request.Form.Get("taskid") != "remote-delete" {
			f.t.Errorf("task id mismatch: %#v", request.Form)
		}
		writeSuccess(writer, map[string]any{"finished": false, "progress": 0.5})
	default:
		f.t.Errorf("unexpected API call %s/%s: %#v", api, method, request.Form)
		writeFailure(writer, 103)
	}
}

func (f *synologyFixture) handleUpload(writer http.ResponseWriter, request *http.Request) {
	if request.ContentLength <= 3 {
		f.t.Errorf("multipart Content-Length is missing: %d", request.ContentLength)
	}
	if err := request.ParseMultipartForm(1 << 20); err != nil {
		f.t.Error(err)
		writeFailure(writer, 1800)
		return
	}
	defer request.MultipartForm.RemoveAll()
	if request.FormValue("api") != "SYNO.FileStation.Upload" || request.FormValue("path") != "/share" || request.FormValue("overwrite") != "false" {
		f.t.Errorf("upload fields mismatch: %#v", request.MultipartForm.Value)
	}
	file, header, err := request.FormFile("file")
	if err != nil {
		f.t.Error(err)
		writeFailure(writer, 1802)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		f.t.Error(err)
	}
	if header.Filename != "new.txt" || string(data) != "new" {
		f.t.Errorf("upload body mismatch: filename=%q data=%q", header.Filename, data)
	}
	f.mu.Lock()
	f.files["/share/new.txt"] = append([]byte(nil), data...)
	f.mu.Unlock()
	writeSuccess(writer, nil)
}

func (f *synologyFixture) fileData(filePath string, directory bool) map[string]any {
	f.mu.Lock()
	size := len(f.files[filePath])
	f.mu.Unlock()
	name := filePath[strings.LastIndex(filePath, "/")+1:]
	return map[string]any{
		"path":  filePath,
		"name":  name,
		"isdir": directory,
		"additional": map[string]any{
			"size": size,
			"type": strings.TrimPrefix(strings.ToUpper(pathExt(name)), "."),
			"time": map[string]int64{"mtime": 100, "crtime": 90},
		},
	}
}

func TestHTTPClientUsesDiscoveredAPIsAndProtocolEncoding(t *testing.T) {
	fixture := newSynologyFixture(t)
	server := httptest.NewServer(fixture)
	defer server.Close()
	provider, err := NewProvider(Config{
		Endpoint:          server.URL,
		RootPath:          "/share",
		HTTPClient:        server.Client(),
		AllowInsecureHTTP: true,
		Credentials:       Credentials{Account: "tester", Password: "secret"},
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionValue, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{})
	if err != nil {
		t.Fatal(err)
	}
	root := externalprovider.ResourceRef{Provider: provider.ID(), Session: sessionValue.ID(), Resource: RootResourceID}
	raw, err := sessionValue.OpenResource(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	page, err := raw.(externalprovider.ListResource).List(context.Background(), externalprovider.ListRequest{Parent: root, Page: externalprovider.PageRequest{Limit: 10}})
	if err != nil || len(page.Entries) != 1 || page.Entries[0].Path != "a.txt" {
		t.Fatalf("HTTP list failed: %#v %v", page, err)
	}
	opened, err := raw.(externalprovider.OpenResource).Open(context.Background(), externalprovider.OpenRequest{Target: page.Entries[0].Ref, Range: &externalprovider.ByteRange{Start: 1, End: 3}})
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(opened.Reader)
	_ = opened.Reader.Close()
	if string(data) != "bcd" || opened.Size != 3 {
		t.Fatalf("HTTP range open failed: %q size=%d", data, opened.Size)
	}
	folder, err := raw.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "new-folder", Kind: externalprovider.EntryKindDirectory, Size: 0})
	if err != nil || len(folder.Entries) != 1 || !folder.Entries[0].IsDir {
		t.Fatalf("HTTP create folder failed: %#v %v", folder, err)
	}
	created, err := raw.(externalprovider.CreateResource).Create(context.Background(), externalprovider.CreateRequest{Parent: root, Name: "new.txt", Kind: externalprovider.EntryKindFile, Content: strings.NewReader("new"), Size: 3, MediaType: "text/plain"})
	if err != nil || len(created.Entries) != 1 {
		t.Fatalf("HTTP upload failed: %#v %v", created, err)
	}
	renamed, err := raw.(externalprovider.UpdateResource).Update(context.Background(), externalprovider.UpdateRequest{Target: created.Entries[0].Ref, NewName: "renamed.txt", Size: -1})
	if err != nil || renamed.Target != "renamed.txt" {
		t.Fatalf("HTTP rename failed: %#v %v", renamed, err)
	}
	deleted, err := raw.(externalprovider.DeleteResource).Delete(context.Background(), externalprovider.DeleteRequest{Targets: []externalprovider.ResourceRef{renamed.Entries[0].Ref}, Recursive: true})
	if err != nil || deleted.OperationRef == nil {
		t.Fatalf("HTTP delete start failed: %#v %v", deleted, err)
	}
	status, err := provider.Operation(context.Background(), *deleted.OperationRef)
	if err != nil || status.Progress != 50 || status.State != externalprovider.OperationRunning {
		t.Fatalf("HTTP task status failed: %#v %v", status, err)
	}
	if fixture.discoveries != 1 || fixture.loginQueries != 0 {
		t.Fatalf("unexpected discovery/login behavior: discoveries=%d credentialQueries=%d", fixture.discoveries, fixture.loginQueries)
	}
}

func TestHTTPClientListsAllDSMSharedFoldersWhenRootIsUnconfigured(t *testing.T) {
	fixture := newSynologyFixture(t)
	server := httptest.NewServer(fixture)
	defer server.Close()
	provider, err := NewProvider(Config{
		Endpoint:          server.URL,
		HTTPClient:        server.Client(),
		AllowInsecureHTTP: true,
		Credentials:       Credentials{Account: "tester", Password: "secret"},
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
	if page.Total == nil || *page.Total != 2 || len(page.Resources) != 2 || page.HasMore {
		t.Fatalf("DSM shared-folder discovery returned the wrong resource page: %#v", page)
	}
	for _, resource := range page.Resources {
		if resource.Ref.Path != "" || resource.Ref.Resource != resource.ID || resource.Name == "" {
			t.Fatalf("shared-folder resource leaked an absolute path or has an invalid ref: %#v", resource)
		}
	}
	if fixture.discoveries != 1 {
		t.Fatalf("expected one API discovery request, got %d", fixture.discoveries)
	}
}

func parseJSONArray(t *testing.T, value string) []string {
	t.Helper()
	var result []string
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		t.Fatalf("invalid JSON array %q: %v", value, err)
	}
	return result
}

func writeSuccess(writer http.ResponseWriter, data interface{}) {
	writer.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(writer).Encode(map[string]interface{}{"success": true, "data": data})
}

func writeFailure(writer http.ResponseWriter, code int) {
	writer.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(writer).Encode(map[string]interface{}{"success": false, "error": map[string]int{"code": code}})
}

func pathExt(name string) string {
	index := strings.LastIndex(name, ".")
	if index < 0 {
		return ""
	}
	return name[index:]
}
