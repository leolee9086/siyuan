package model

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/cache"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestUploadToNotebookWritesDuplicateContentIntoTargetNotebook(t *testing.T) {
	gin.SetMode(gin.TestMode)
	baseDir := t.TempDir()
	originalWorkspaceDir, originalDataDir, originalTempDir, originalConf := util.WorkspaceDir, util.DataDir, util.TempDir, Conf
	t.Cleanup(func() {
		util.WorkspaceDir, util.DataDir, util.TempDir, Conf = originalWorkspaceDir, originalDataDir, originalTempDir, originalConf
	})
	util.WorkspaceDir = filepath.Join(baseDir, "workspace")
	util.DataDir = filepath.Join(util.WorkspaceDir, "data")
	util.TempDir = filepath.Join(util.WorkspaceDir, "temp")
	Conf = NewAppConf()
	Conf.Sync = conf.NewSync()

	content := []byte("same-content-in-another-notebook")
	globalAssetPath := filepath.Join(util.DataDir, "assets", "existing.txt")
	if err := os.MkdirAll(filepath.Dir(globalAssetPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(globalAssetPath, content, 0600); err != nil {
		t.Fatal(err)
	}
	hash, err := util.GetEtag(globalAssetPath)
	if err != nil {
		t.Fatal(err)
	}
	cache.SetAssetHash(hash, "assets/existing.txt")
	t.Cleanup(func() { cache.RemoveAssetHash(hash) })

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	fileWriter, err := writer.CreateFormFile("file[]", "report.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = fileWriter.Write(content); err != nil {
		t.Fatal(err)
	}
	if err = writer.WriteField("assetsDirPath", "assets/redirected"); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/ai/agent/uploadFiles", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	boxID := ast.NewNodeID()

	UploadToNotebook(context, boxID)

	var response struct {
		Code int `json:"code"`
		Data struct {
			ErrFiles []string          `json:"errFiles"`
			SuccMap  map[string]string `json:"succMap"`
		} `json:"data"`
	}
	if err = json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Code != 0 || len(response.Data.ErrFiles) != 0 {
		t.Fatalf("upload failed: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	uploadedPath := response.Data.SuccMap["report.txt"]
	querySuffix := "?box=" + boxID
	if !strings.HasPrefix(uploadedPath, "assets/") || !strings.HasSuffix(uploadedPath, querySuffix) {
		t.Fatalf("unexpected notebook asset path: %q", uploadedPath)
	}
	relativePath := strings.TrimSuffix(uploadedPath, querySuffix)
	targetPath := filepath.Join(util.DataDir, boxID, filepath.FromSlash(relativePath))
	uploadedContent, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("target notebook asset missing: %v", err)
	}
	if !bytes.Equal(uploadedContent, content) {
		t.Fatalf("target notebook asset content mismatch: %q", uploadedContent)
	}
	if _, err = os.Stat(filepath.Join(util.DataDir, "assets", "redirected")); !os.IsNotExist(err) {
		t.Fatalf("caller supplied assetsDirPath must be ignored: %v", err)
	}
}
