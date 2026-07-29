package api

import (
	"bytes"
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestForgeRuntimeWebUIStatusRequiresKernelDeviceAndForgeMode(t *testing.T) {
	previousMode := util.Mode
	previousCall := forgeRuntimeCallSupervisor
	t.Cleanup(func() {
		util.Mode = previousMode
		forgeRuntimeCallSupervisor = previousCall
	})
	util.Mode = util.ModeForge
	callCount := 0
	forgeRuntimeCallSupervisor = func(method, endpoint string, body any) (json.RawMessage, error) {
		callCount++
		if method != http.MethodGet || endpoint != "/status" || body != nil {
			t.Fatalf("unexpected Supervisor request: method=%s endpoint=%s body=%v", method, endpoint, body)
		}
		return json.RawMessage(`{"mode":"forge-source-supervisor"}`), nil
	}

	remoteRecorder := httptest.NewRecorder()
	remoteContext, _ := gin.CreateTestContext(remoteRecorder)
	remoteContext.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/status", "", "203.0.113.8:54321")
	forgeRuntimeStatus(remoteContext)
	remoteResult := decodeForgeRuntimeResult(t, remoteRecorder)
	if remoteResult.Code == 0 || callCount != 0 {
		t.Fatalf("remote request reached Supervisor: result=%+v calls=%d", remoteResult, callCount)
	}

	localRecorder := httptest.NewRecorder()
	localContext, _ := gin.CreateTestContext(localRecorder)
	localContext.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/status", "", "127.0.0.1:54321")
	forgeRuntimeStatus(localContext)
	localResult := decodeForgeRuntimeResult(t, localRecorder)
	if localResult.Code != 0 || callCount != 1 {
		t.Fatalf("local status failed: result=%+v calls=%d", localResult, callCount)
	}
	encodedData, err := json.Marshal(localResult.Data)
	if err != nil || !bytes.Contains(encodedData, []byte(`"available":true`)) ||
		!bytes.Contains(encodedData, []byte(`"forge-source-supervisor"`)) {
		t.Fatalf("unexpected local status data: %s, err=%v", encodedData, err)
	}

	util.Mode = util.ModeProd
	unavailableRecorder := httptest.NewRecorder()
	unavailableContext, _ := gin.CreateTestContext(unavailableRecorder)
	unavailableContext.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/status", "", "127.0.0.1:54321")
	forgeRuntimeStatus(unavailableContext)
	unavailableResult := decodeForgeRuntimeResult(t, unavailableRecorder)
	encodedData, err = json.Marshal(unavailableResult.Data)
	if err != nil || unavailableResult.Code != 0 || !bytes.Contains(encodedData, []byte(`"available":false`)) || callCount != 1 {
		t.Fatalf("non-Forge status is not a pure capability probe: result=%+v data=%s calls=%d", unavailableResult, encodedData, callCount)
	}
}

func TestForgeRuntimeWebUIMutationsForwardOnlyValidatedRequests(t *testing.T) {
	previousMode := util.Mode
	previousCall := forgeRuntimeCallSupervisor
	t.Cleanup(func() {
		util.Mode = previousMode
		forgeRuntimeCallSupervisor = previousCall
	})
	util.Mode = util.ModeForge
	type forwardedRequest struct {
		Endpoint string
		Body     map[string]string
	}
	forwarded := make([]forwardedRequest, 0, 3)
	forgeRuntimeCallSupervisor = func(method, endpoint string, body any) (json.RawMessage, error) {
		if method != http.MethodPost {
			t.Fatalf("unexpected method %s", method)
		}
		bodyMap, ok := body.(map[string]string)
		if !ok {
			t.Fatalf("unexpected body type %T", body)
		}
		forwarded = append(forwarded, forwardedRequest{Endpoint: endpoint, Body: bodyMap})
		return json.RawMessage(`{"accepted":true}`), nil
	}

	tests := []struct {
		name     string
		path     string
		body     string
		handler  gin.HandlerFunc
		endpoint string
	}{
		{name: "restart", path: "/api/s-forge/forge/runtime/restart", body: `{"reason":" verified source "}`, handler: forgeRuntimeRestart, endpoint: "/restart"},
		{name: "approve", path: "/api/s-forge/forge/runtime/approveProtectedTests", body: `{"jobId":"job-1","revision":"rev-1"}`, handler: forgeRuntimeApproveProtectedTests, endpoint: "/approve-protected-tests"},
		{name: "reject", path: "/api/s-forge/forge/runtime/rejectProtectedTests", body: `{"jobId":"job-1","revision":"rev-1"}`, handler: forgeRuntimeRejectProtectedTests, endpoint: "/reject-protected-tests"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = newForgeRuntimeWebUIRequest(http.MethodPost, test.path, test.body, "127.0.0.1:54321")
			test.handler(context)
			result := decodeForgeRuntimeResult(t, recorder)
			if result.Code != 0 {
				t.Fatalf("request failed: %+v", result)
			}
			if got := forwarded[len(forwarded)-1].Endpoint; got != test.endpoint {
				t.Fatalf("endpoint = %q, want %q", got, test.endpoint)
			}
		})
	}
	if forwarded[0].Body["reason"] != "verified source" {
		t.Fatalf("restart reason was not normalized: %#v", forwarded[0].Body)
	}
	remoteRecorder := httptest.NewRecorder()
	remoteContext, _ := gin.CreateTestContext(remoteRecorder)
	remoteContext.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/restart", `{"reason":"remote"}`, "203.0.113.8:54321")
	forgeRuntimeRestart(remoteContext)
	if result := decodeForgeRuntimeResult(t, remoteRecorder); result.Code == 0 || len(forwarded) != 3 {
		t.Fatalf("remote restart was forwarded: result=%+v requests=%+v", result, forwarded)
	}

	invalidRecorder := httptest.NewRecorder()
	invalidContext, _ := gin.CreateTestContext(invalidRecorder)
	invalidContext.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/approveProtectedTests", `{"jobId":"job-1"}`, "127.0.0.1:54321")
	forgeRuntimeApproveProtectedTests(invalidContext)
	if result := decodeForgeRuntimeResult(t, invalidRecorder); result.Code == 0 || len(forwarded) != 3 {
		t.Fatalf("incomplete approval was forwarded: result=%+v requests=%+v", result, forwarded)
	}
}

func TestForgeRuntimeWebUIRejectsNonUIAuthenticationAndCrossOriginRequests(t *testing.T) {
	previousMode := util.Mode
	previousCall := forgeRuntimeCallSupervisor
	t.Cleanup(func() {
		util.Mode = previousMode
		forgeRuntimeCallSupervisor = previousCall
	})
	util.Mode = util.ModeForge
	callCount := 0
	forgeRuntimeCallSupervisor = func(method, endpoint string, body any) (json.RawMessage, error) {
		callCount++
		return json.RawMessage(`{"accepted":true}`), nil
	}

	tests := []struct {
		name   string
		mutate func(*http.Request)
	}{
		{name: "workspace API token", mutate: func(request *http.Request) {
			request.Header.Set("Authorization", "Token workspace-token")
		}},
		{name: "plugin JWT", mutate: func(request *http.Request) {
			request.Header.Set(model.XAuthTokenKey, "plugin-token")
		}},
		{name: "query token", mutate: func(request *http.Request) {
			query := request.URL.Query()
			query.Set("token", "workspace-token")
			request.URL.RawQuery = query.Encode()
		}},
		{name: "cross origin", mutate: func(request *http.Request) {
			request.Header.Set("Origin", "http://localhost:6807")
		}},
		{name: "cross scheme origin", mutate: func(request *http.Request) {
			request.Header.Set("Origin", "https://localhost:6806")
		}},
		{name: "missing origin", mutate: func(request *http.Request) {
			request.Header.Del("Origin")
		}},
		{name: "non JSON", mutate: func(request *http.Request) {
			request.Header.Set("Content-Type", "text/plain")
		}},
		{name: "JSON prefix spoof", mutate: func(request *http.Request) {
			request.Header.Set("Content-Type", "application/jsonp")
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = newForgeRuntimeWebUIRequest(http.MethodPost, "/api/s-forge/forge/runtime/restart", `{"reason":"reviewed"}`, "127.0.0.1:54321")
			test.mutate(context.Request)
			forgeRuntimeRestart(context)
			if result := decodeForgeRuntimeResult(t, recorder); result.Code == 0 {
				t.Fatalf("non-UI request was accepted: %+v", result)
			}
		})
	}
	if callCount != 0 {
		t.Fatalf("non-UI requests reached Supervisor %d time(s)", callCount)
	}
}

func TestForgeRuntimeWebUIRoutesKeepRequiredAuthorizationChain(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("test source location is unavailable")
	}
	routerPath := filepath.Join(filepath.Dir(sourceFile), "router.go")
	parsed, err := parser.ParseFile(token.NewFileSet(), routerPath, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	expected := map[string][]string{
		"/api/s-forge/forge/runtime/status":                {"model.CheckAuth", "model.CheckAdminRole", "model.CheckReadonly", "forgeRuntimeStatus"},
		"/api/s-forge/forge/runtime/restart":               {"model.CheckAuth", "model.CheckAdminRole", "model.CheckReadonly", "forgeRuntimeRestart"},
		"/api/s-forge/forge/runtime/approveProtectedTests": {"model.CheckAuth", "model.CheckAdminRole", "model.CheckReadonly", "forgeRuntimeApproveProtectedTests"},
		"/api/s-forge/forge/runtime/rejectProtectedTests":  {"model.CheckAuth", "model.CheckAdminRole", "model.CheckReadonly", "forgeRuntimeRejectProtectedTests"},
	}
	found := map[string][]string{}
	ast.Inspect(parsed, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok || len(call.Args) < 3 {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "Handle" {
			return true
		}
		pathLiteral, ok := call.Args[1].(*ast.BasicLit)
		if !ok || pathLiteral.Kind != token.STRING {
			return true
		}
		pathValue, err := strconv.Unquote(pathLiteral.Value)
		if err != nil || expected[pathValue] == nil {
			return true
		}
		for _, expression := range call.Args[2:] {
			found[pathValue] = append(found[pathValue], forgeRuntimeHandlerName(expression))
		}
		return true
	})
	for path, wanted := range expected {
		got := found[path]
		if len(got) != len(wanted) {
			t.Fatalf("%s handlers = %v, want %v", path, got, wanted)
		}
		for index := range wanted {
			if got[index] != wanted[index] {
				t.Fatalf("%s handlers = %v, want %v", path, got, wanted)
			}
		}
	}
}

func forgeRuntimeHandlerName(expression ast.Expr) string {
	switch value := expression.(type) {
	case *ast.Ident:
		return value.Name
	case *ast.SelectorExpr:
		if qualifier, ok := value.X.(*ast.Ident); ok {
			return qualifier.Name + "." + value.Sel.Name
		}
	}
	return ""
}

func decodeForgeRuntimeResult(t *testing.T, recorder *httptest.ResponseRecorder) *util.Result {
	t.Helper()
	var result util.Result
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response failed: %v; body=%s", err, recorder.Body.String())
	}
	return &result
}

func newForgeRuntimeWebUIRequest(method, path, body, remoteAddr string) *http.Request {
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	request.Host = "localhost:6806"
	request.RemoteAddr = remoteAddr
	request.Header.Set("Origin", "http://localhost:6806")
	request.Header.Set("Content-Type", "application/json")
	return request
}

func TestForgeRuntimeShutdownRequiresAuthenticatedLoopbackSupervisor(t *testing.T) {
	previousMode := util.Mode
	previousToken := os.Getenv(util.ForgeSupervisorTokenEnv)
	previousClose := forgeRuntimeClose
	t.Cleanup(func() {
		util.Mode = previousMode
		_ = os.Setenv(util.ForgeSupervisorTokenEnv, previousToken)
		forgeRuntimeClose = previousClose
	})
	util.Mode = util.ModeForge
	_ = os.Setenv(util.ForgeSupervisorTokenEnv, "shutdown-token")

	called := make(chan struct{}, 1)
	forgeRuntimeClose = func(force, setCurrentWorkspace bool, execInstallPkg int) (int, string) {
		if force || setCurrentWorkspace || execInstallPkg != 1 {
			t.Errorf("unexpected close arguments: force=%v setCurrentWorkspace=%v execInstallPkg=%d", force, setCurrentWorkspace, execInstallPkg)
		}
		called <- struct{}{}
		return 0, ""
	}

	invalidRequest := httptest.NewRequest(http.MethodPost, "/api/s-forge/forge/runtime/shutdown", nil)
	invalidRequest.RemoteAddr = "127.0.0.1:1234"
	invalidRecorder := httptest.NewRecorder()
	invalidContext, _ := gin.CreateTestContext(invalidRecorder)
	invalidContext.Request = invalidRequest
	forgeRuntimeShutdown(invalidContext)
	if invalidRecorder.Code != http.StatusForbidden {
		t.Fatalf("invalid request status = %d", invalidRecorder.Code)
	}

	validRequest := httptest.NewRequest(http.MethodPost, "/api/s-forge/forge/runtime/shutdown", nil)
	validRequest.RemoteAddr = "127.0.0.1:1234"
	validRequest.Header.Set(util.ForgeSupervisorTokenHeader, "shutdown-token")
	validRecorder := httptest.NewRecorder()
	validContext, _ := gin.CreateTestContext(validRecorder)
	validContext.Request = validRequest
	forgeRuntimeShutdown(validContext)
	if validRecorder.Code != http.StatusAccepted {
		t.Fatalf("valid request status = %d", validRecorder.Code)
	}

	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("valid supervisor request did not schedule graceful close")
	}
}
