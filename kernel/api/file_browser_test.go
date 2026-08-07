package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

type fileBrowserTagDefinitionsStub struct {
	snapshot assetmeta.TagDefinitionsSnapshot
	update   assetmeta.TagDefinitionsUpdate
	err      error
}

func (s *fileBrowserTagDefinitionsStub) GetTagDefinitions() assetmeta.TagDefinitionsSnapshot {
	return s.snapshot
}

func (s *fileBrowserTagDefinitionsStub) UpdateTagDefinitions(update assetmeta.TagDefinitionsUpdate) (assetmeta.TagDefinitionsSnapshot, error) {
	s.update = update
	return s.snapshot, s.err
}

type fileBrowserTestEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func callFileBrowserHandler(t *testing.T, handler gin.HandlerFunc, remoteAddr, body string) fileBrowserTestEnvelope {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "http://localhost/api/s-forge/file-browser", strings.NewReader(body))
	request.RemoteAddr = remoteAddr
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	handler(context)
	var response fileBrowserTestEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v body=%s", err, recorder.Body.String())
	}
	return response
}

func callFileBrowserContentHandler(t *testing.T, remoteAddr, rootID, path, byteRange string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://localhost/api/s-forge/file-browser/content", nil)
	request.RemoteAddr = remoteAddr
	if byteRange != "" {
		request.Header.Set("Range", byteRange)
	}
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	context.Params = gin.Params{{Key: "rootID", Value: rootID}, {Key: "path", Value: "/" + path}}
	serveSForgeFileBrowserContent(context)
	return recorder
}

func TestFileBrowserRootsRequireKernelDevice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	response := callFileBrowserHandler(t, getSForgeFileBrowserRoots, "203.0.113.10:6806", `{}`)
	if response.Code != http.StatusForbidden {
		t.Fatalf("remote roots must be rejected: %+v", response)
	}
}

func TestFileBrowserRootsAndListUseRootRelativePaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	if err := os.WriteFile(filepath.Join(workspace, "note.txt"), []byte("content"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
			return nil, nil
		})
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	rootsResponse := callFileBrowserHandler(t, getSForgeFileBrowserRoots, "127.0.0.1:6806", `{}`)
	if rootsResponse.Code != 0 || !strings.Contains(string(rootsResponse.Data), `"id":"workspace"`) {
		t.Fatalf("unexpected roots response: %+v", rootsResponse)
	}
	listResponse := callFileBrowserHandler(t, listSForgeFileBrowserDirectory, "127.0.0.1:6806", `{"rootID":"workspace"}`)
	if listResponse.Code != 0 || !strings.Contains(string(listResponse.Data), `"name":"note.txt"`) {
		t.Fatalf("unexpected list response: %+v", listResponse)
	}
	traversalResponse := callFileBrowserHandler(t, listSForgeFileBrowserDirectory, "127.0.0.1:6806", `{"rootID":"workspace","path":"../"}`)
	if traversalResponse.Code != http.StatusForbidden {
		t.Fatalf("traversal must be rejected: %+v", traversalResponse)
	}
}

func TestFileBrowserWalkUsesRecursiveRootRelativeContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "notes", "drafts"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "notes", "drafts", "one.md"), []byte("draft"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	response := callFileBrowserHandler(t, walkSForgeFileBrowserDirectory, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"notes","maxDepth":8,"maxEntries":100}`)
	if response.Code != 0 || !strings.Contains(string(response.Data), `"path":"notes/drafts/one.md"`) ||
		!strings.Contains(string(response.Data), `"scannedDirectoryCount":2`) {
		t.Fatalf("unexpected walk response: %+v", response)
	}
	traversal := callFileBrowserHandler(t, walkSForgeFileBrowserDirectory, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"../"}`)
	if traversal.Code != http.StatusForbidden {
		t.Fatalf("recursive traversal must retain root boundary: %+v", traversal)
	}
}

func TestFileBrowserStatPreviewAndContentRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	if err := os.Mkdir(filepath.Join(workspace, "notes"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "notes", "hello world.txt"), []byte("content"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	statResponse := callFileBrowserHandler(t, statSForgeFileBrowserFile, "127.0.0.1:6806", `{"rootID":"workspace","path":"notes/hello world.txt"}`)
	if statResponse.Code != 0 || !strings.Contains(string(statResponse.Data), `"previewKind":"text"`) {
		t.Fatalf("unexpected stat response: %+v", statResponse)
	}
	previewResponse := callFileBrowserHandler(t, previewSForgeFileBrowserFile, "127.0.0.1:6806", `{"rootID":"workspace","path":"notes/hello world.txt","maxBytes":4}`)
	if previewResponse.Code != 0 || !strings.Contains(string(previewResponse.Data), `"text":"cont"`) || !strings.Contains(string(previewResponse.Data), `"truncated":true`) {
		t.Fatalf("unexpected preview response: %+v", previewResponse)
	}
	contentResponse := callFileBrowserContentHandler(t, "127.0.0.1:6806", "workspace", "notes/hello world.txt", "bytes=1-3")
	if contentResponse.Code != http.StatusPartialContent || contentResponse.Body.String() != "ont" {
		t.Fatalf("unexpected range response: status=%d body=%q", contentResponse.Code, contentResponse.Body.String())
	}
	if disposition := contentResponse.Header().Get("Content-Disposition"); !strings.HasPrefix(disposition, "attachment") {
		t.Fatalf("text content must download instead of execute: %q", disposition)
	}
}

func TestFileBrowserTagDefinitionsRequireKernelDeviceAndPreserveRevision(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fileBrowserTagDefinitionsStub{snapshot: assetmeta.TagDefinitionsSnapshot{
		Revision: "revision-1",
		Items:    []assetmeta.TagInfo{{Name: "Review", Color: "#123456"}},
	}}
	originalFactory := newFileBrowserTagDefinitionsService
	newFileBrowserTagDefinitionsService = func() fileBrowserTagDefinitionsService { return stub }
	t.Cleanup(func() { newFileBrowserTagDefinitionsService = originalFactory })

	remote := callFileBrowserHandler(t, getSForgeFileBrowserTagDefinitions, "203.0.113.10:6806", `{}`)
	if remote.Code != http.StatusForbidden {
		t.Fatalf("remote tag definitions must be rejected: %+v", remote)
	}
	read := callFileBrowserHandler(t, getSForgeFileBrowserTagDefinitions, "127.0.0.1:6806", `{}`)
	if read.Code != 0 || !strings.Contains(string(read.Data), `"revision":"revision-1"`) ||
		!strings.Contains(string(read.Data), `"color":"#123456"`) {
		t.Fatalf("unexpected tag definitions response: %+v", read)
	}
	write := callFileBrowserHandler(t, setSForgeFileBrowserTagDefinitions, "127.0.0.1:6806",
		`{"expectedRevision":"revision-1","items":[{"name":"Review","color":"#654321"}]}`)
	if write.Code != 0 || stub.update.ExpectedRevision != "revision-1" || len(stub.update.Items) != 1 ||
		stub.update.Items[0].Color != "#654321" {
		t.Fatalf("tag definitions update changed contract: response=%+v update=%+v", write, stub.update)
	}
}

func TestFileBrowserTagDefinitionsMapValidationAndConflictErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fileBrowserTagDefinitionsStub{snapshot: assetmeta.TagDefinitionsSnapshot{Revision: "current"}}
	originalFactory := newFileBrowserTagDefinitionsService
	newFileBrowserTagDefinitionsService = func() fileBrowserTagDefinitionsService { return stub }
	t.Cleanup(func() { newFileBrowserTagDefinitionsService = originalFactory })

	tests := []struct {
		name string
		err  error
		code int
	}{
		{name: "invalid", err: assetmeta.ErrTagDefinitionInvalid, code: http.StatusBadRequest},
		{name: "conflict", err: assetmeta.ErrTagDefinitionsConflict, code: http.StatusConflict},
		{name: "unavailable", err: assetmeta.ErrTagDefinitionsUnavailable, code: http.StatusServiceUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stub.err = errors.Join(test.err, errors.New("detail"))
			response := callFileBrowserHandler(t, setSForgeFileBrowserTagDefinitions, "127.0.0.1:6806", `{"items":[]}`)
			if response.Code != test.code {
				t.Fatalf("unexpected error mapping: got=%+v want=%d", response, test.code)
			}
		})
	}
}
