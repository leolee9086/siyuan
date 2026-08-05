// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type agentControlTestResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func setupAgentControlAPITest(t *testing.T) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	originalDataDir := util.DataDir
	originalConf := model.Conf
	util.DataDir = t.TempDir()
	model.Conf = model.NewAppConf()
	model.Conf.AI = conf.NewAI()
	model.Conf.AI.MCP = nil
	model.Conf.Variables = conf.NewVariables()
	model.Conf.AI.Providers = []*conf.Provider{{
		ID: "provider-1", Enabled: true, APIKey: "test-key", BaseURL: "http://127.0.0.1",
		Models: []*conf.Model{{ID: "model-1", Name: "test-model", Enabled: true}},
	}}
	model.Conf.AI.Agent.ModelID = "provider-1:model-1"

	sessionID := ast.NewNodeID()
	session := map[string]any{
		"id": sessionID, "title": "queue api", "createdAt": int64(1), "updatedAt": int64(1),
		"entries": []any{map[string]any{"id": "user-root", "type": "user", "content": "hello"}},
		"future":  map[string]any{"upstream": true},
	}
	encoded, err := json.Marshal(session)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = agent.SaveSession(encoded); err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		stopAgentExecutor(sessionID)
		util.DataDir = originalDataDir
		model.Conf = originalConf
	})
	return sessionID
}

func callAgentControlAPI(t *testing.T, handler gin.HandlerFunc, method, path string, payload any) (*httptest.ResponseRecorder, agentControlTestResponse) {
	t.Helper()
	var body []byte
	var err error
	if payload != nil {
		body, err = json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.RemoteAddr = "127.0.0.1:6806"
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	handler(context)
	response := agentControlTestResponse{}
	if recorder.Body.Len() > 0 {
		if err = json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("decode response status=%d body=%s: %v", recorder.Code, recorder.Body.String(), err)
		}
	}
	return recorder, response
}

func decodeAgentControlData(t *testing.T, response agentControlTestResponse) map[string]any {
	t.Helper()
	data := map[string]any{}
	if err := json.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("decode response data %s: %v", response.Data, err)
	}
	return data
}

func TestAgentQueueAPIIdempotencyAndConflict(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	payload := map[string]any{
		"inputID": "queue-idempotent", "sessionID": sessionID, "userEntryID": "user-queue-1",
		"message": "later", "language": "English",
	}
	firstRecorder, first := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", payload)
	if firstRecorder.Code != http.StatusAccepted {
		t.Fatalf("first queue admission: status=%d body=%s", firstRecorder.Code, firstRecorder.Body.String())
	}
	firstData := decodeAgentControlData(t, first)
	if firstData["duplicated"] != false || firstData["userEntryID"] != "user-queue-1" {
		t.Fatalf("first queue response: %+v", firstData)
	}

	retryRecorder, retry := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", payload)
	if retryRecorder.Code != http.StatusAccepted {
		t.Fatalf("idempotent retry: status=%d body=%s", retryRecorder.Code, retryRecorder.Body.String())
	}
	retryData := decodeAgentControlData(t, retry)
	if retryData["duplicated"] != true || retryData["admittedSeq"] != firstData["admittedSeq"] || retryData["queueVersion"] != firstData["queueVersion"] {
		t.Fatalf("idempotent response drift: first=%+v retry=%+v", firstData, retryData)
	}

	conflict := map[string]any{}
	for key, value := range payload {
		conflict[key] = value
	}
	conflict["message"] = "different"
	conflictRecorder, conflictResponse := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", conflict)
	if conflictRecorder.Code != http.StatusConflict || decodeAgentControlData(t, conflictResponse)["reason"] != "input_id_conflict" {
		t.Fatalf("input id conflict: status=%d body=%s", conflictRecorder.Code, conflictRecorder.Body.String())
	}
}
