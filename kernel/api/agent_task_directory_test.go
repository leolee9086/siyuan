package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func newAgentTaskDirectoryTestContext(remoteAddr, host string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "http://"+host+"/api/ai/agent/bindTaskDirectory", strings.NewReader(`{"sessionID":"session-1","path":"C:\\task"}`))
	request.RemoteAddr = remoteAddr
	request.Host = host
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	return context, recorder
}

func TestAgentTaskDirectoryEndpointsDoNotTreatRemoteTransportAsAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name    string
		handler gin.HandlerFunc
	}{
		{name: "bind", handler: bindAgentTaskDirectory},
		{name: "unbind", handler: unbindAgentTaskDirectory},
	} {
		t.Run(test.name, func(t *testing.T) {
			context, recorder := newAgentTaskDirectoryTestContext("192.0.2.10:6806", "localhost:6806")
			test.handler(context)
			if test.name == "bind" {
				if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), "guardian") {
					t.Fatalf("remote bind without guardian must be rejected by authorization: status=%d body=%s", recorder.Code, recorder.Body.String())
				}
				return
			}
			if recorder.Code != http.StatusBadRequest || strings.Contains(recorder.Body.String(), "local device") {
				t.Fatalf("remote unbind should fail for missing binding, not transport: status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestSanitizeSessionForResponseRedactsNestedTaskDirectoryFields(t *testing.T) {
	session := map[string]interface{}{
		"id": "session-1",
		"taskDirectory": map[string]interface{}{
			"main": map[string]interface{}{
				"path":            `C:\\private\\main`,
				"ownerIdentityId": "owner-a",
				"name":            "main",
			},
			"directories": []interface{}{
				map[string]interface{}{
					"path":            `C:\\private\\read`,
					"ownerIdentityId": "owner-a",
					"permission":      "read-only",
				},
			},
		},
	}

	sanitized := sanitizeSessionForResponse(session)
	encoded, err := json.Marshal(sanitized)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "private") || strings.Contains(string(encoded), "owner-a") {
		t.Fatalf("nested task-directory secrets leaked: %s", encoded)
	}
	if !strings.Contains(string(encoded), "read-only") {
		t.Fatalf("non-sensitive directory metadata should remain visible: %s", encoded)
	}
}

func TestAgentTaskDirectoryBindingRequiresGuardianOnLocalTransport(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, recorder := newAgentTaskDirectoryTestContext("127.0.0.1:6806", "localhost:6806")
	bindAgentTaskDirectory(context)
	if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), "guardian") {
		t.Fatalf("local binding without guardian must be rejected: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAgentTaskDirectoryRemoteGuardianCanBindMultipleDirectories(t *testing.T) {
	gin.SetMode(gin.TestMode)
	baseDir := t.TempDir()
	originalWorkspaceDir, originalDataDir, originalConfDir, originalStore, originalModelConf := util.WorkspaceDir, util.DataDir, util.ConfDir, globalMagiIdentityStore, model.Conf
	t.Cleanup(func() {
		util.WorkspaceDir, util.DataDir, util.ConfDir = originalWorkspaceDir, originalDataDir, originalConfDir
		globalMagiIdentityStore, model.Conf = originalStore, originalModelConf
	})
	util.WorkspaceDir = filepath.Join(baseDir, "workspace")
	util.DataDir = filepath.Join(util.WorkspaceDir, "data")
	util.ConfDir = filepath.Join(baseDir, "conf")
	sessionID := ast.NewNodeID()
	if err := os.MkdirAll(filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions", sessionID), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions", sessionID, "session.json"), []byte(`{"id":"`+sessionID+`"}`), 0600); err != nil {
		t.Fatal(err)
	}
	mainDir := filepath.Join(baseDir, "main")
	readDir := filepath.Join(baseDir, "read")
	if err := os.MkdirAll(mainDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(readDir, 0700); err != nil {
		t.Fatal(err)
	}
	globalMagiIdentityStore = &magiIdentityStore{}
	model.Conf = &model.AppConf{Api: &conf.API{Token: "remote-test-workspace-token"}}
	token := issueTestArmorToken(t, "remote-owner", magiRouteClassGuardian, magiRequestChannelMainUI)
	callJSON := func(handler gin.HandlerFunc, body []byte, authToken string, secure bool) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		scheme := "https"
		if !secure {
			scheme = "http"
		}
		request := httptest.NewRequest(http.MethodPost, scheme+"://remote.example/api/ai/agent/bindTaskDirectory", strings.NewReader(string(body)))
		request.RemoteAddr = "203.0.113.10:6806"
		request.Header.Set(agentOwnerTokenHeader, authToken)
		context, _ := gin.CreateTestContext(recorder)
		context.Request = request
		handler(context)
		return recorder
	}
	call := func(handler gin.HandlerFunc, payload map[string]string, authToken string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(payload)
		return callJSON(handler, body, authToken, true)
	}
	mainResult := call(bindAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": mainDir}, token)
	if mainResult.Code != http.StatusOK || strings.Contains(mainResult.Body.String(), mainDir) {
		t.Fatalf("remote guardian main bind failed or leaked path: status=%d body=%s", mainResult.Code, mainResult.Body.String())
	}
	addResult := call(addAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": readDir, "permission": "read-only"}, token)
	if addResult.Code != http.StatusOK || strings.Contains(addResult.Body.String(), readDir) {
		t.Fatalf("remote guardian additional bind failed or leaked path: status=%d body=%s", addResult.Code, addResult.Body.String())
	}
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil || binding == nil || binding.Main == nil || len(binding.Directories) != 1 {
		t.Fatalf("remote binds not persisted: binding=%+v err=%v", binding, err)
	}
	listResult := call(listAgentTaskDirectories, map[string]string{"id": sessionID}, token)
	if listResult.Code != http.StatusOK || strings.Contains(listResult.Body.String(), mainDir) || strings.Contains(listResult.Body.String(), readDir) {
		t.Fatalf("owner directory listing failed or leaked path: status=%d body=%s", listResult.Code, listResult.Body.String())
	}
	getResult := call(getSession, map[string]string{"id": sessionID}, token)
	if getResult.Code != http.StatusOK {
		t.Fatalf("remote guardian should read bound session: status=%d body=%s", getResult.Code, getResult.Body.String())
	}
	wrongToken := issueTestArmorToken(t, "remote-other-owner", magiRouteClassGuardian, magiRequestChannelMainUI)
	wrongResult := call(listAgentTaskDirectories, map[string]string{"id": sessionID}, wrongToken)
	if wrongResult.Code != http.StatusForbidden {
		t.Fatalf("cross-owner directory listing must be rejected: status=%d body=%s", wrongResult.Code, wrongResult.Body.String())
	}
	wrongGetResult := call(getSession, map[string]string{"id": sessionID}, wrongToken)
	if wrongGetResult.Code != http.StatusForbidden {
		t.Fatalf("cross-owner session read must be rejected: status=%d body=%s", wrongGetResult.Code, wrongGetResult.Body.String())
	}
	model.Conf.AI = &conf.AI{Providers: []*conf.Provider{{
		Enabled: true,
		APIKey:  "test-key",
		Models:  []*conf.Model{{Name: "test-model", Enabled: true}},
	}}}
	chatPayload, _ := json.Marshal(map[string]interface{}{"sessionID": sessionID, "message": "protected task"})
	if result := callJSON(agentChat, chatPayload, wrongToken, true); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner chat must be rejected before model execution: status=%d body=%s", result.Code, result.Body.String())
	}
	ownerSaveResult := call(saveSession, map[string]string{"id": sessionID, "title": "remote-updated"}, token)
	if ownerSaveResult.Code != http.StatusOK {
		t.Fatalf("remote guardian should save bound session: status=%d body=%s", ownerSaveResult.Code, ownerSaveResult.Body.String())
	}
	wrongSaveResult := call(saveSession, map[string]string{"id": sessionID, "title": "forbidden"}, wrongToken)
	if wrongSaveResult.Code != http.StatusForbidden {
		t.Fatalf("cross-owner session save must be rejected: status=%d body=%s", wrongSaveResult.Code, wrongSaveResult.Body.String())
	}
	wrongChannelToken := issueTestArmorToken(t, "remote-wrong-channel", magiRouteClassGuardian, magiRequestChannelToolCustom)
	wrongChannelResult := call(listAgentTaskDirectories, map[string]string{"id": sessionID}, wrongChannelToken)
	if wrongChannelResult.Code != http.StatusForbidden {
		t.Fatalf("guardian token from a non-main-ui channel must be rejected: status=%d body=%s", wrongChannelResult.Code, wrongChannelResult.Body.String())
	}
	avatarOnlyToken := issueTestArmorToken(t, "remote-avatar-only", magiRouteClassAvatarOnly, magiRequestChannelMainUI)
	avatarOnlyResult := call(listAgentTaskDirectories, map[string]string{"id": sessionID}, avatarOnlyToken)
	if avatarOnlyResult.Code != http.StatusForbidden {
		t.Fatalf("avatar-only token must not control protected agent sessions: status=%d body=%s", avatarOnlyResult.Code, avatarOnlyResult.Body.String())
	}
	now := time.Now().Unix()
	expiredToken, err := signMagiArmorToken(magiArmorClaimsV1{
		Sub: "remote-owner", Chn: magiRequestChannelMainUI, Ws: magiWorkspaceBinding(), Rtc: magiRouteClassGuardian,
		Nck: "remote-owner", Iat: now - 120, Exp: now - 1, Jti: "expired-remote-owner",
	})
	if err != nil {
		t.Fatal(err)
	}
	expiredResult := call(listAgentTaskDirectories, map[string]string{"id": sessionID}, expiredToken)
	if expiredResult.Code != http.StatusUnauthorized {
		t.Fatalf("expired guardian token must be rejected: status=%d body=%s", expiredResult.Code, expiredResult.Body.String())
	}
	insecureBody, _ := json.Marshal(map[string]string{"id": sessionID})
	insecureRecorder := callJSON(listAgentTaskDirectories, insecureBody, token, false)
	if insecureRecorder.Code != http.StatusForbidden || !strings.Contains(insecureRecorder.Body.String(), "HTTPS") {
		t.Fatalf("remote HTTP owner token must be rejected: status=%d body=%s", insecureRecorder.Code, insecureRecorder.Body.String())
	}
	sessionsMu.Lock()
	runningSessions[sessionID] = &runningSession{ownerIdentityID: "remote-owner"}
	sessionsMu.Unlock()
	controlPayload := func(payload map[string]interface{}) []byte {
		body, _ := json.Marshal(payload)
		return body
	}
	confirmPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "confirmID": "confirm-1", "approved": true, "always": false})
	if result := callJSON(agentChatConfirm, confirmPayload, token, true); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "confirmation expired") {
		t.Fatalf("owner confirm should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatConfirm, confirmPayload, wrongToken, true); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner confirm must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	questionPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "questionID": "question-1", "answers": []string{"yes"}})
	if result := callJSON(agentChatQuestion, questionPayload, token, true); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "question expired") {
		t.Fatalf("owner question should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatQuestion, questionPayload, wrongToken, true); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner question answer must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	frontendPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "callID": "call-1", "result": "ok", "isError": false})
	if result := callJSON(agentChatFrontendResult, frontendPayload, token, true); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "frontend tool call expired") {
		t.Fatalf("owner frontend result should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatFrontendResult, frontendPayload, wrongToken, true); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner frontend result must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	sessionsMu.Lock()
	delete(runningSessions, sessionID)
	sessionsMu.Unlock()
	mainRemovalResult := call(unbindAgentTaskDirectory, map[string]string{"sessionID": sessionID, "directoryID": "main"}, token)
	if mainRemovalResult.Code != http.StatusBadRequest {
		t.Fatalf("main directory removal must require removing additional grants first: status=%d body=%s", mainRemovalResult.Code, mainRemovalResult.Body.String())
	}
	removeResult := call(unbindAgentTaskDirectory, map[string]string{"sessionID": sessionID, "directoryID": binding.Directories[0].ID}, token)
	if removeResult.Code != http.StatusOK {
		t.Fatalf("remote guardian should remove additional grant: status=%d body=%s", removeResult.Code, removeResult.Body.String())
	}
	if _, err := os.Stat(filepath.Join(util.DataDir, ".siyuan", "agent-task-directories.json")); err != nil {
		t.Fatalf("workspace capability store missing: %v", err)
	}
	wrongRemoveResult := call(removeSession, map[string]string{"id": sessionID}, wrongToken)
	if wrongRemoveResult.Code != http.StatusForbidden {
		t.Fatalf("cross-owner session removal must be rejected: status=%d body=%s", wrongRemoveResult.Code, wrongRemoveResult.Body.String())
	}
	ownerRemoveResult := call(removeSession, map[string]string{"id": sessionID}, token)
	if ownerRemoveResult.Code != http.StatusOK {
		t.Fatalf("remote guardian should remove bound session: status=%d body=%s", ownerRemoveResult.Code, ownerRemoveResult.Body.String())
	}
	if removedBinding, err := agent.GetTaskDirectoryBinding(sessionID); err != nil || removedBinding != nil {
		t.Fatalf("session removal must clear capability: binding=%+v err=%v", removedBinding, err)
	}
}
