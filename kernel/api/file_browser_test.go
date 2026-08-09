package api

import (
	archivezip "archive/zip"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"

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

type fileBrowserThumbnailStub struct {
	data        []byte
	contentType string
}

func (s fileBrowserThumbnailStub) GetWithSize(string, int, int) ([]byte, string, error) {
	return s.data, s.contentType, nil
}

func (s fileBrowserThumbnailStub) Refresh(string, int, int) ([]byte, string, error) {
	return s.data, s.contentType, nil
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

func TestFileBrowserEditorReadWriteHandlersUseRevisionAndEncodingContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	path := filepath.Join(workspace, "notes", "guide.md")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("# guide\n"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
			return nil, nil
		})
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	readResponse := callFileBrowserHandler(t, readSForgeFileBrowserEditor, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"notes/guide.md"}`)
	if readResponse.Code != 0 {
		t.Fatalf("editor read failed: %+v", readResponse)
	}
	var document filebrowser.EditorDocument
	if err := json.Unmarshal(readResponse.Data, &document); err != nil {
		t.Fatal(err)
	}
	if document.Text != "# guide\n" || document.Encoding != "utf-8" || document.Language != "markdown" || document.Revision == "" {
		t.Fatalf("unexpected editor document: %+v", document)
	}

	body := `{"rootID":"workspace","path":"notes/guide.md","text":"# changed\n","encoding":"utf-8","revision":"` + document.Revision + `"}`
	writeResponse := callFileBrowserHandler(t, writeSForgeFileBrowserEditor, "127.0.0.1:6806", body)
	if writeResponse.Code != 0 || !strings.Contains(string(writeResponse.Data), `"revision"`) {
		t.Fatalf("editor write failed: %+v", writeResponse)
	}
	if content, err := os.ReadFile(path); err != nil || string(content) != "# changed\n" {
		t.Fatalf("editor content mismatch: %q err=%v", content, err)
	}
	conflict := callFileBrowserHandler(t, writeSForgeFileBrowserEditor, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"notes/guide.md","text":"stale","encoding":"utf-8","revision":"`+document.Revision+`"}`)
	if conflict.Code != http.StatusConflict {
		t.Fatalf("stale editor write status: %+v", conflict)
	}
	missingRevision := callFileBrowserHandler(t, writeSForgeFileBrowserEditor, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"notes/guide.md","text":"missing","encoding":"utf-8"}`)
	if missingRevision.Code != http.StatusPreconditionRequired {
		t.Fatalf("missing revision status: %+v", missingRevision)
	}
}

func TestFileBrowserEditorHandlersRejectBinaryAndRemoteRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	remote := callFileBrowserHandler(t, readSForgeFileBrowserEditor, "203.0.113.10:6806",
		`{"rootID":"workspace","path":"notes/guide.md"}`)
	if remote.Code != http.StatusForbidden {
		t.Fatalf("remote editor read must be rejected: %+v", remote)
	}
}

func TestFileBrowserMutationOperationsUseRootRelativeContracts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	if err := os.Mkdir(filepath.Join(workspace, "source"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "source", "old name.txt"), []byte("payload"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	create := callFileBrowserHandler(t, createSForgeFileBrowserDirectory, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"source/新目录"}`)
	if create.Code != 0 || !strings.Contains(string(create.Data), `"operation":"create-directory"`) {
		t.Fatalf("unexpected create response: %+v", create)
	}
	rename := callFileBrowserHandler(t, renameSForgeFileBrowserEntry, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"source/old name.txt","newName":"new name.txt"}`)
	if rename.Code != 0 || !strings.Contains(string(rename.Data), `"path":"source/new name.txt"`) {
		t.Fatalf("unexpected rename response: %+v", rename)
	}
	copyResponse := callFileBrowserHandler(t, copySForgeFileBrowserEntry, "127.0.0.1:6806",
		`{"sourceRootID":"workspace","sourcePath":"source/new name.txt","destinationRootID":"workspace","destinationPath":"copied/new name.txt"}`)
	if copyResponse.Code != 0 || !strings.Contains(string(copyResponse.Data), `"copiedFileCount":1`) {
		t.Fatalf("unexpected copy response: %+v", copyResponse)
	}
	if data, err := os.ReadFile(filepath.Join(workspace, "copied", "new name.txt")); err != nil || string(data) != "payload" {
		t.Fatalf("copied content mismatch: %q err=%v", data, err)
	}
	moveResponse := callFileBrowserHandler(t, moveSForgeFileBrowserEntry, "127.0.0.1:6806",
		`{"sourceRootID":"workspace","sourcePath":"copied/new name.txt","destinationRootID":"workspace","destinationPath":"moved/new name.txt"}`)
	if moveResponse.Code != 0 || !strings.Contains(string(moveResponse.Data), `"operation":"move"`) ||
		!strings.Contains(string(moveResponse.Data), `"destinationPath":"moved/new name.txt"`) {
		t.Fatalf("unexpected move response: %+v", moveResponse)
	}
	if data, err := os.ReadFile(filepath.Join(workspace, "moved", "new name.txt")); err != nil || string(data) != "payload" {
		t.Fatalf("moved content mismatch: %q err=%v", data, err)
	}
	conflict := callFileBrowserHandler(t, createSForgeFileBrowserDirectory, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"source/新目录"}`)
	if conflict.Code != http.StatusConflict {
		t.Fatalf("expected create conflict, got %+v", conflict)
	}
	deleteResponse := callFileBrowserHandler(t, deleteSForgeFileBrowserEntry, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"moved/new name.txt"}`)
	if deleteResponse.Code != 0 || !strings.Contains(string(deleteResponse.Data), `"operation":"delete"`) ||
		!strings.Contains(string(deleteResponse.Data), `"removedFileCount":1`) {
		t.Fatalf("unexpected delete response: %+v", deleteResponse)
	}
	if _, err := os.Stat(filepath.Join(workspace, "moved", "new name.txt")); !os.IsNotExist(err) {
		t.Fatalf("deleted file remained: %v", err)
	}
	rootDelete := callFileBrowserHandler(t, deleteSForgeFileBrowserEntry, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"."}`)
	if rootDelete.Code != http.StatusBadRequest {
		t.Fatalf("root deletion status: %+v", rootDelete)
	}
}

func TestFileBrowserBatchDeleteReturnsPerItemResults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	if err := os.MkdirAll(filepath.Join(workspace, "tree", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "tree", "nested", "child.txt"), []byte("child"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	response := callFileBrowserHandler(t, deleteBatchSForgeFileBrowserEntries, "127.0.0.1:6806",
		`{"items":[{"rootID":"workspace","path":"tree"},{"rootID":"workspace","path":"tree/nested/child.txt"},{"rootID":"workspace","path":"missing.txt"}]}`)
	if response.Code != 0 {
		t.Fatalf("batch delete failed: %+v", response)
	}
	var result filebrowser.BatchDeleteResult
	if err := json.Unmarshal(response.Data, &result); err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 2 || result.FailureCount != 1 || len(result.Items) != 3 ||
		result.Items[2].Error == nil || result.Items[2].Error.Code != "path-not-found" {
		t.Fatalf("unexpected batch result: %+v", result)
	}
	if _, err := os.Stat(filepath.Join(workspace, "tree")); !os.IsNotExist(err) {
		t.Fatalf("batch delete left selected tree: %v", err)
	}

	duplicate := callFileBrowserHandler(t, deleteBatchSForgeFileBrowserEntries, "127.0.0.1:6806",
		`{"items":[{"rootID":"workspace","path":"./same.txt"},{"rootID":"workspace","path":"same.txt"}]}`)
	if duplicate.Code != http.StatusBadRequest {
		t.Fatalf("duplicate batch should be rejected: %+v", duplicate)
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

func TestFileBrowserD5AInspectionUsesMigratedDomainPackage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	modelPath := filepath.Join(workspace, "models", "fixture.d5a")
	if err := os.MkdirAll(filepath.Dir(modelPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := writeFileBrowserD5AFixture(modelPath); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	response := callFileBrowserHandler(t, inspectSForgeFileBrowserD5A, "127.0.0.1:6806",
		`{"rootID":"workspace","path":"models/fixture.d5a"}`)
	if response.Code != 0 {
		t.Fatalf("D5A inspection failed: %+v", response)
	}
	var payload struct {
		RootID string `json:"rootID"`
		Path   string `json:"path"`
		Report struct {
			Format string `json:"format"`
			D5A    struct {
				Variant string `json:"variant"`
				Bundles []struct {
					Mesh *struct {
						Version         uint32 `json:"version"`
						TriangleCount   int64  `json:"triangleCount"`
						VertexCount     int64  `json:"vertexCount"`
						DescriptorCount int    `json:"descriptorCount"`
					} `json:"mesh"`
				} `json:"bundles"`
			} `json:"d5a"`
		} `json:"report"`
	}
	if err := json.Unmarshal(response.Data, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.RootID != "workspace" || payload.Path != "models/fixture.d5a" ||
		payload.Report.Format != "d5a" || payload.Report.D5A.Variant != "d5mesh" ||
		len(payload.Report.D5A.Bundles) != 1 || payload.Report.D5A.Bundles[0].Mesh == nil ||
		payload.Report.D5A.Bundles[0].Mesh.Version != 11 ||
		payload.Report.D5A.Bundles[0].Mesh.TriangleCount != 1 ||
		payload.Report.D5A.Bundles[0].Mesh.VertexCount != 3 {
		t.Fatalf("unexpected migrated D5A report: %+v", payload)
	}
}

func writeFileBrowserD5AFixture(path string) error {
	var mesh bytes.Buffer
	writeUint32 := func(value uint32) {
		var encoded [4]byte
		binary.LittleEndian.PutUint32(encoded[:], value)
		_, _ = mesh.Write(encoded[:])
	}
	writeFloat32 := func(value float32) { writeUint32(math.Float32bits(value)) }
	writeUTF16 := func(value string) {
		units := utf16.Encode([]rune(value))
		writeUint32(uint32(len(units)))
		for _, unit := range units {
			var encoded [2]byte
			binary.LittleEndian.PutUint16(encoded[:], unit)
			_, _ = mesh.Write(encoded[:])
		}
	}
	writeUint32(11)
	writeUTF16(`{"triangleCount":1}`)
	writeUint32(0)
	writeUint32(1)
	writeUTF16("group")
	writeUTF16("material")
	for _, value := range []float32{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1} {
		writeFloat32(value)
	}
	writeUint32(1)
	writeUTF16("group")
	writeUint32(9)
	for _, value := range []float32{0, 0, 0, 1, 0, 0, 0, 1, 0} {
		writeFloat32(value)
	}
	writeUint32(9)
	for range 9 {
		writeFloat32(0)
	}
	writeUint32(6)
	for _, value := range []float32{0, 0, 1, 0, 0, 1} {
		writeFloat32(value)
	}
	writeUint32(0)
	writeUint32(3)
	writeUint32(0)
	writeUint32(1)
	writeUint32(2)

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	archive := archivezip.NewWriter(file)
	entry, err := archive.Create("1.d5mesh")
	if err == nil {
		_, err = entry.Write(mesh.Bytes())
	}
	if closeErr := archive.Close(); err == nil {
		err = closeErr
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	return err
}

func TestFileBrowserImageContentPreservesImageMimeAndBytes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	imagePath := filepath.Join(workspace, "nested", "中文 folder", "page-2.png")
	if err := os.MkdirAll(filepath.Dir(imagePath), 0755); err != nil {
		t.Fatal(err)
	}
	source := image.NewRGBA(image.Rect(0, 0, 2, 1))
	source.Pix[0], source.Pix[1], source.Pix[2], source.Pix[3] = 255, 0, 0, 255
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(imagePath, encoded.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	t.Cleanup(func() { newFileBrowserService = originalFactory })

	contentResponse := callFileBrowserContentHandler(t, "127.0.0.1:6806", "workspace",
		"nested/中文 folder/page-2.png", "")
	if contentResponse.Code != http.StatusOK {
		t.Fatalf("unexpected image response status: %d", contentResponse.Code)
	}
	if contentType := contentResponse.Header().Get("Content-Type"); contentType != "image/png" {
		t.Fatalf("image content must preserve image/png MIME, got %q", contentType)
	}
	if !bytes.Equal(contentResponse.Body.Bytes(), encoded.Bytes()) {
		t.Fatalf("image content bytes changed: got=%d want=%d", contentResponse.Body.Len(), encoded.Len())
	}
}

func TestFileBrowserThumbnailResponsePreservesProviderMime(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	imagePath := filepath.Join(workspace, "中文 folder", "page-2.png")
	if err := os.MkdirAll(filepath.Dir(imagePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(imagePath, []byte("fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	originalFactory := newFileBrowserService
	originalThumbnailFactory := newFileBrowserThumbnailService
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	newFileBrowserThumbnailService = func() fileBrowserThumbnailService {
		return fileBrowserThumbnailStub{data: []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}, contentType: "image/png"}
	}
	t.Cleanup(func() {
		newFileBrowserService = originalFactory
		newFileBrowserThumbnailService = originalThumbnailFactory
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet,
		"http://localhost/api/s-forge/file-browser/thumbnail?rootID=workspace&path="+
			url.QueryEscape("中文 folder/page-2.png")+"&size=360", nil)
	request.RemoteAddr = "127.0.0.1:6806"
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	getSForgeFileBrowserThumbnail(context)
	if recorder.Code != http.StatusOK || recorder.Header().Get("Content-Type") != "image/png" ||
		!bytes.Equal(recorder.Body.Bytes(), []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}) {
		t.Fatalf("unexpected thumbnail response: status=%d type=%q bytes=%x", recorder.Code,
			recorder.Header().Get("Content-Type"), recorder.Body.Bytes())
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
