package api

import (
	"encoding/json"
	"net"
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
				if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), "same device") {
					t.Fatalf("remote bind must be rejected by the device boundary: status=%d body=%s", recorder.Code, recorder.Body.String())
				}
				return
			}
			if recorder.Code != http.StatusBadRequest || strings.Contains(recorder.Body.String(), "local device") {
				t.Fatalf("remote unbind should fail for missing binding, not transport: status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestAgentKernelDeviceRequestUsesConnectionSourceOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDeviceIPs := getAgentKernelDeviceIPs
	getAgentKernelDeviceIPs = func() []net.IP {
		return []net.IP{net.ParseIP("192.168.50.8"), net.ParseIP("fd00::8")}
	}
	t.Cleanup(func() { getAgentKernelDeviceIPs = originalDeviceIPs })

	for _, test := range []struct {
		name       string
		remoteAddr string
		forwarded  bool
		want       bool
	}{
		{name: "ipv4 loopback", remoteAddr: "127.0.0.1:6806", want: true},
		{name: "ipv6 loopback", remoteAddr: "[::1]:6806", want: true},
		{name: "kernel ipv4", remoteAddr: "192.168.50.8:6806", want: true},
		{name: "kernel ipv6", remoteAddr: "[fd00::8]:6806", want: true},
		{name: "remote", remoteAddr: "203.0.113.10:6806", want: false},
		{name: "remote with loopback metadata", remoteAddr: "203.0.113.10:6806", forwarded: true, want: false},
		{name: "loopback with forwarded metadata", remoteAddr: "127.0.0.1:6806", forwarded: true, want: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "http://localhost/api/ai/agent/taskDirectoryCapabilities", nil)
			request.RemoteAddr = test.remoteAddr
			request.Header.Set("Origin", "http://localhost:6806")
			request.Header.Set("X-Forwarded-Host", "localhost:6806")
			if test.forwarded {
				request.Header.Set("X-Forwarded-For", "203.0.113.10")
			}
			context, _ := gin.CreateTestContext(recorder)
			context.Request = request

			if got := isAgentKernelDeviceRequest(context); got != test.want {
				t.Fatalf("unexpected device result: remote=%s got=%t want=%t", test.remoteAddr, got, test.want)
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

func TestAgentTaskDirectoryRemoteGuardianManagesExistingDirectories(t *testing.T) {
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
	callJSON := func(handler gin.HandlerFunc, body []byte, authToken string, secure bool, remoteAddr string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		scheme := "https"
		if !secure {
			scheme = "http"
		}
		request := httptest.NewRequest(http.MethodPost, scheme+"://remote.example/api/ai/agent/bindTaskDirectory", strings.NewReader(string(body)))
		request.RemoteAddr = remoteAddr
		request.Header.Set(agentOwnerTokenHeader, authToken)
		context, _ := gin.CreateTestContext(recorder)
		context.Request = request
		handler(context)
		return recorder
	}
	call := func(handler gin.HandlerFunc, payload map[string]string, authToken string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(payload)
		return callJSON(handler, body, authToken, true, "203.0.113.10:6806")
	}
	callLocal := func(handler gin.HandlerFunc, payload map[string]string, authToken string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(payload)
		return callJSON(handler, body, authToken, false, "127.0.0.1:6806")
	}
	callEvents := func(authToken string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "https://remote.example/api/ai/agent/events?sessionID="+sessionID, nil)
		request.RemoteAddr = "203.0.113.10:6806"
		if authToken != "" {
			request.Header.Set(agentOwnerTokenHeader, authToken)
		}
		context, _ := gin.CreateTestContext(recorder)
		context.Request = request
		agentEvents(context)
		return recorder
	}
	mainResult := callLocal(bindAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": mainDir}, token)
	if mainResult.Code != http.StatusOK || strings.Contains(mainResult.Body.String(), mainDir) {
		t.Fatalf("local guardian main bind failed or leaked path: status=%d body=%s", mainResult.Code, mainResult.Body.String())
	}
	addResult := callLocal(addAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": readDir, "permission": "read-only"}, token)
	if addResult.Code != http.StatusOK || strings.Contains(addResult.Body.String(), readDir) {
		t.Fatalf("local guardian additional bind failed or leaked path: status=%d body=%s", addResult.Code, addResult.Body.String())
	}
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil || binding == nil || binding.Main == nil || len(binding.Directories) != 1 {
		t.Fatalf("local binds not persisted: binding=%+v err=%v", binding, err)
	}
	originalBroadcast := broadcastAgentSessionEvent
	broadcastCalls := 0
	broadcastAgentSessionEvent = func(_ string, _ string, _ string, _ int, _ string, _ any) {
		broadcastCalls++
	}
	t.Cleanup(func() { broadcastAgentSessionEvent = originalBroadcast })
	broadcastAgentSessionChanged("external-app", sessionID, "update")
	if broadcastCalls != 0 {
		t.Fatalf("bound session entered the global agent WebSocket: calls=%d", broadcastCalls)
	}
	broadcastAgentSessionChanged("local-app", ast.NewNodeID(), "update")
	if broadcastCalls != 1 {
		t.Fatalf("ordinary session broadcast port was not invoked: calls=%d", broadcastCalls)
	}
	remoteBindResult := call(bindAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": mainDir}, token)
	if remoteBindResult.Code != http.StatusForbidden || !strings.Contains(remoteBindResult.Body.String(), "same device") {
		t.Fatalf("remote guardian must not replace the main binding: status=%d body=%s", remoteBindResult.Code, remoteBindResult.Body.String())
	}
	remoteAddResult := call(addAgentTaskDirectory, map[string]string{"sessionID": sessionID, "path": readDir, "permission": "read-only"}, token)
	if remoteAddResult.Code != http.StatusForbidden || !strings.Contains(remoteAddResult.Body.String(), "same device") {
		t.Fatalf("remote guardian must not add a binding: status=%d body=%s", remoteAddResult.Code, remoteAddResult.Body.String())
	}
	localCapabilities := callLocal(getAgentTaskDirectoryCapabilities, map[string]string{}, token)
	if localCapabilities.Code != http.StatusOK || !strings.Contains(localCapabilities.Body.String(), `"canBindTaskDirectories":true`) {
		t.Fatalf("local guardian should receive bind capability: status=%d body=%s", localCapabilities.Code, localCapabilities.Body.String())
	}
	remoteCapabilities := call(getAgentTaskDirectoryCapabilities, map[string]string{}, token)
	if remoteCapabilities.Code != http.StatusOK || !strings.Contains(remoteCapabilities.Body.String(), `"canBindTaskDirectories":false`) {
		t.Fatalf("remote guardian should not receive bind capability: status=%d body=%s", remoteCapabilities.Code, remoteCapabilities.Body.String())
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
	missingEventsResult := callEvents("")
	if missingEventsResult.Code != http.StatusForbidden {
		t.Fatalf("event stream without owner capability must be rejected: status=%d body=%s", missingEventsResult.Code, missingEventsResult.Body.String())
	}
	wrongEventsResult := callEvents(wrongToken)
	if wrongEventsResult.Code != http.StatusForbidden {
		t.Fatalf("cross-owner event stream must be rejected: status=%d body=%s", wrongEventsResult.Code, wrongEventsResult.Body.String())
	}
	model.Conf.AI = &conf.AI{Providers: []*conf.Provider{{
		Enabled: true,
		APIKey:  "test-key",
		ID:      "provider-1",
		Models:  []*conf.Model{{ID: "model-1", Name: "test-model", Enabled: true}},
	}}}
	model.Conf.AI.Agent = &conf.Agent{ModelID: "provider-1:model-1"}
	chatPayload, _ := json.Marshal(map[string]interface{}{"sessionID": sessionID, "message": "protected task"})
	if result := callJSON(agentChat, chatPayload, wrongToken, true, "203.0.113.10:6806"); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner chat must be rejected before model execution: status=%d body=%s", result.Code, result.Body.String())
	}
	queuePayload, _ := json.Marshal(map[string]interface{}{
		"inputID": "protected-queue-1", "sessionID": sessionID, "userEntryID": "protected-entry-1",
		"message": "protected queued task", "language": "English",
	})
	if result := callJSON(agentQueue, queuePayload, wrongToken, true, "203.0.113.10:6806"); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner queue must be rejected before admission: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentQueue, queuePayload, token, true, "203.0.113.10:6806"); result.Code != http.StatusAccepted {
		t.Fatalf("owner queue admission failed: status=%d body=%s", result.Code, result.Body.String())
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
	insecureRecorder := callJSON(listAgentTaskDirectories, insecureBody, token, false, "203.0.113.10:6806")
	if insecureRecorder.Code != http.StatusForbidden || !strings.Contains(insecureRecorder.Body.String(), "HTTPS") {
		t.Fatalf("remote HTTP owner token must be rejected: status=%d body=%s", insecureRecorder.Code, insecureRecorder.Body.String())
	}
	executor := getAgentExecutor(sessionID)
	executor.admissionMu.Lock()
	executor.turn.TurnStarted("protected-control-turn")
	executor.turn.SetPhase("protected-control-turn", agent.AgentTurnToolRunning)
	executor.mu.Lock()
	executor.activeOwnerID = "remote-owner"
	executor.mu.Unlock()
	executor.admissionMu.Unlock()
	controlPayload := func(payload map[string]interface{}) []byte {
		body, _ := json.Marshal(payload)
		return body
	}
	confirmPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "confirmID": "confirm-1", "approved": true, "always": false})
	if result := callJSON(agentChatConfirm, confirmPayload, token, true, "203.0.113.10:6806"); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "confirmation expired") {
		t.Fatalf("owner confirm should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatConfirm, confirmPayload, wrongToken, true, "203.0.113.10:6806"); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner confirm must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	questionPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "questionID": "question-1", "answers": []string{"yes"}})
	if result := callJSON(agentChatQuestion, questionPayload, token, true, "203.0.113.10:6806"); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "question expired") {
		t.Fatalf("owner question should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatQuestion, questionPayload, wrongToken, true, "203.0.113.10:6806"); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner question answer must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	frontendPayload := controlPayload(map[string]interface{}{"sessionID": sessionID, "callID": "call-1", "result": "ok", "isError": false})
	if result := callJSON(agentChatFrontendResult, frontendPayload, token, true, "203.0.113.10:6806"); result.Code != http.StatusConflict || !strings.Contains(result.Body.String(), "frontend tool call expired") {
		t.Fatalf("owner frontend result should pass authorization and report the missing waiter: status=%d body=%s", result.Code, result.Body.String())
	}
	if result := callJSON(agentChatFrontendResult, frontendPayload, wrongToken, true, "203.0.113.10:6806"); result.Code != http.StatusForbidden {
		t.Fatalf("cross-owner frontend result must be rejected: status=%d body=%s", result.Code, result.Body.String())
	}
	if _, err = executor.turn.Commit("protected-control-turn"); err != nil {
		t.Fatal(err)
	}
	executor.clearActiveInput("")
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
