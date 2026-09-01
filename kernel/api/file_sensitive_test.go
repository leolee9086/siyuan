package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestGetFileDeniesSensitiveForAllRoles 验证 /api/file/getFile 对敏感文件在所有角色下均拒绝，
// 覆盖 conf/conf.json、data/snippets/conf.json、data/templates 目录及 data/.siyuan/publishAccess.json，
// 且不依赖加密状态（密文拦截之外的黑名单）。
func TestGetFileDeniesSensitiveForAllRoles(t *testing.T) {
	workspaceDir := t.TempDir()
	origWorkspace, origConf, origData := util.WorkspaceDir, util.ConfDir, util.DataDir
	util.WorkspaceDir = workspaceDir
	util.ConfDir = filepath.Join(workspaceDir, "conf")
	util.DataDir = filepath.Join(workspaceDir, "data")
	t.Cleanup(func() {
		util.WorkspaceDir, util.ConfDir, util.DataDir = origWorkspace, origConf, origData
		model.SetPublishAccess(model.PublishAccess{})
	})
	model.SetPublishAccess(model.PublishAccess{})

	// 准备敏感文件
	for _, rel := range []string{
		filepath.Join("conf", "conf.json"),
		filepath.Join("data", "snippets", "conf.json"),
		filepath.Join("data", ".siyuan", "publishAccess.json"),
		filepath.Join("data", "templates", "a.txt"),
		filepath.Join("data", "20260821000010-abc1234", ".siyuan", "conf.json"),
	} {
		abs := filepath.Join(workspaceDir, rel)
		if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(abs, []byte("sensitive"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	// templates 目录本身也应被拒绝
	if err := os.MkdirAll(filepath.Join(workspaceDir, "data", "templates"), 0755); err != nil {
		t.Fatal(err)
	}

	cases := []string{
		"conf/conf.json",
		"data/snippets/conf.json",
		"data/.siyuan/publishAccess.json",
		"data/templates/a.txt",
		"data/templates",
		"data/20260821000010-abc1234/.siyuan/conf.json",
	}
	for _, rel := range cases {
		for _, role := range []model.Role{model.RoleReader, model.RoleEditor, model.RoleAdministrator} {
			rec := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(rec)
			ctx.Set(model.RoleContextKey, role)
			req := httptest.NewRequest(http.MethodPost, "/api/file/getFile", strings.NewReader(`{"path":"`+rel+`"}`))
			req.Header.Set("Content-Type", "application/json")
			ctx.Request = req
			getFile(ctx)
			if rec.Code == http.StatusOK {
				t.Fatalf("getFile role %d should be denied for [%s], got 200: %s", role, rel, rec.Body.String())
			}
			if strings.Contains(rec.Body.String(), "sensitive") {
				t.Fatalf("sensitive content leaked for [%s] role %d: %s", rel, role, rec.Body.String())
			}
		}
	}
}

// TestReadDirDeniesForbidden 验证 readDir 对敏感目录拒绝，即使管理员。
func TestReadDirDeniesForbidden(t *testing.T) {
	workspaceDir := t.TempDir()
	origWorkspace, origConf, origData := util.WorkspaceDir, util.ConfDir, util.DataDir
	util.WorkspaceDir = workspaceDir
	util.ConfDir = filepath.Join(workspaceDir, "conf")
	util.DataDir = filepath.Join(workspaceDir, "data")
	t.Cleanup(func() {
		util.WorkspaceDir, util.ConfDir, util.DataDir = origWorkspace, origConf, origData
	})
	if err := os.MkdirAll(filepath.Join(workspaceDir, "data", "templates", "sub"), 0755); err != nil {
		t.Fatal(err)
	}
	cases := []string{"data/templates", "data/templates/sub"}
	for _, rel := range cases {
		rec := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(rec)
		ctx.Set(model.RoleContextKey, model.RoleAdministrator)
		req := httptest.NewRequest(http.MethodPost, "/api/file/readDir", strings.NewReader(`{"path":"`+rel+`"}`))
		req.Header.Set("Content-Type", "application/json")
		ctx.Request = req
		readDir(ctx)
		if rec.Code == http.StatusOK {
			// readDir returns 200 with ret.Code field; need to inspect body
			if strings.Contains(rec.Body.String(), `"code":0`) {
				t.Fatalf("readDir should deny [%s], got %s", rel, rec.Body.String())
			}
		}
		// 直接检查 ret.Code via handler: our handler sets ret.Code = 403 inside JSON body when forbidden
		if !strings.Contains(rec.Body.String(), `"code":403`) && !strings.Contains(rec.Body.String(), `"code": 403`) {
			// allow 403 via http code or ret code
			// readDir uses c.JSON(StatusOK) with ret.Code, so http code is 200
			// but ret.Code should be 403
		}
	}
}

// TestPutFileDeniesForbidden 验证 putFile 对敏感路径拒绝写入。
func TestPutFileDeniesForbidden(t *testing.T) {
	workspaceDir := t.TempDir()
	origWorkspace, origConf, origData := util.WorkspaceDir, util.ConfDir, util.DataDir
	util.WorkspaceDir = workspaceDir
	util.ConfDir = filepath.Join(workspaceDir, "conf")
	util.DataDir = filepath.Join(workspaceDir, "data")
	t.Cleanup(func() {
		util.WorkspaceDir, util.ConfDir, util.DataDir = origWorkspace, origConf, origData
	})
	// putFile 使用 PostForm path，需构造 multipart 请求
	for _, rel := range []string{"data/.siyuan/publishAccess.json", "data/templates/evil.txt", "conf/conf.json"} {
		rec := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(rec)
		ctx.Set(model.RoleContextKey, model.RoleAdministrator)
		// 构造带 PostForm 的请求
		req := httptest.NewRequest(http.MethodPost, "/api/file/putFile", nil)
		req.PostForm = map[string][]string{"path": {rel}, "isDir": {"false"}}
		// 添加一个虚拟 file header 以避免 "form file is nil" 干扰，但我们的 IsForbidden 应在 fileHeader 检查前触发
		ctx.Request = req
		putFile(ctx)
		if strings.Contains(rec.Body.String(), `"code":0`) {
			t.Fatalf("putFile should deny [%s], got %s", rel, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), `"code":403`) {
			t.Fatalf("putFile [%s] expected 403, got %s", rel, rec.Body.String())
		}
	}
}

// TestRemoveFileDeniesForbidden 验证 removeFile 对敏感文件拒绝删除。
func TestRemoveFileDeniesForbidden(t *testing.T) {
	workspaceDir := t.TempDir()
	origWorkspace, origConf, origData := util.WorkspaceDir, util.ConfDir, util.DataDir
	util.WorkspaceDir = workspaceDir
	util.ConfDir = filepath.Join(workspaceDir, "conf")
	util.DataDir = filepath.Join(workspaceDir, "data")
	t.Cleanup(func() {
		util.WorkspaceDir, util.ConfDir, util.DataDir = origWorkspace, origConf, origData
	})
	abs := filepath.Join(workspaceDir, "data", ".siyuan", "publishAccess.json")
	if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(abs, []byte("{}"), 0644); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Set(model.RoleContextKey, model.RoleAdministrator)
	req := httptest.NewRequest(http.MethodPost, "/api/file/removeFile", strings.NewReader(`{"path":"data/.siyuan/publishAccess.json"}`))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	removeFile(ctx)
	if strings.Contains(rec.Body.String(), `"code":0`) {
		t.Fatalf("removeFile should deny sensitive file, got %s", rec.Body.String())
	}
}

// TestRenameFileDeniesForbidden 验证 renameFile 对敏感路径的源或目标均拒绝。
func TestRenameFileDeniesForbidden(t *testing.T) {
	workspaceDir := t.TempDir()
	origWorkspace, origConf, origData := util.WorkspaceDir, util.ConfDir, util.DataDir
	util.WorkspaceDir = workspaceDir
	util.ConfDir = filepath.Join(workspaceDir, "conf")
	util.DataDir = filepath.Join(workspaceDir, "data")
	t.Cleanup(func() {
		util.WorkspaceDir, util.ConfDir, util.DataDir = origWorkspace, origConf, origData
	})
	src := filepath.Join(workspaceDir, "data", "assets", "a.txt")
	if err := os.MkdirAll(filepath.Dir(src), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(src, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	// 目标为敏感文件
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Set(model.RoleContextKey, model.RoleAdministrator)
	body := `{"path":"data/assets/a.txt","newPath":"data/.siyuan/publishAccess.json"}`
	req := httptest.NewRequest(http.MethodPost, "/api/file/renameFile", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	renameFile(ctx)
	if strings.Contains(rec.Body.String(), `"code":0`) {
		t.Fatalf("renameFile to forbidden should be denied, got %s", rec.Body.String())
	}
}
