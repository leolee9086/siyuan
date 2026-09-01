// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package agent

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/mcp/tools"
)

func TestConvertSchemaZodOptionalFields(t *testing.T) {
	schema := tools.ToolSchema{
		Type: "object",
		Properties: map[string]tools.Property{
			"title": {Type: "string", Description: "task title"},
			"content": {
				AnyOf: []tools.Property{
					{Type: "string"},
					{Type: "null"},
				},
				Description: "optional content",
			},
		},
		Required: []string{"title"},
	}

	out := convertSchema(schema).(map[string]any)
	if out["type"] != "object" {
		t.Fatalf("expected root type object, got %#v", out["type"])
	}

	props := out["properties"].(map[string]any)
	content := props["content"].(map[string]any)
	if content["type"] != "string" {
		t.Fatalf("expected simplified content type string, got %#v", content)
	}
	if _, ok := content["type"]; ok {
		if content["type"] == "" {
			t.Fatal("content type must not be empty string")
		}
	}
	if _, ok := content["anyOf"]; ok {
		t.Fatalf("expected anyOf to be simplified away, got %#v", content)
	}

	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) == "" {
		t.Fatal("expected non-empty json")
	}
}

func TestConvertSchemaRootAnyOf(t *testing.T) {
	schema := tools.ToolSchema{
		AnyOf: []tools.ToolSchema{
			{
				Type: "object",
				Properties: map[string]tools.Property{
					"title": {Type: "string"},
				},
				Required: []string{"title"},
			},
		},
	}

	out := convertSchema(schema).(map[string]any)
	if out["type"] != "object" {
		t.Fatalf("expected root type object, got %#v", out["type"])
	}
	props := out["properties"].(map[string]any)
	if len(props) != 1 {
		t.Fatalf("expected 1 property, got %d", len(props))
	}
}

func TestNeedsConfirmScopesReadOnlyActionsByToolSource(t *testing.T) {
	const externalWrite = "test_external_write"
	const externalRead = "test_external_read"
	const nativeWrite = "test_native_write"
	const nativeExternalWrite = "test_native_external_write"
	registrations := map[string]*tools.Tool{
		externalWrite: {Name: externalWrite, Source: "mcp", InputSchema: tools.ToolSchema{Type: "object"}},
		externalRead:  {Name: externalRead, Source: "mcp", ReadOnlyHint: true, InputSchema: tools.ToolSchema{Type: "object"}},
		nativeWrite:   {Name: nativeWrite, Source: "native", InputSchema: tools.ToolSchema{Type: "object"}},
		nativeExternalWrite: {
			Name: nativeExternalWrite, Source: "native", EffectScope: tools.EffectScopeExternal,
			InputSchema: tools.ToolSchema{Type: "object"},
		},
	}
	for name, tool := range registrations {
		if err := tools.SetTool(name, tool); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		tools.RemoveTool(externalWrite)
		tools.RemoveTool(externalRead)
		tools.RemoveTool(nativeWrite)
		tools.RemoveTool(nativeExternalWrite)
	})

	if !needsConfirm(externalWrite, "", nil) {
		t.Fatal("external tool with unknown mutability must require confirmation")
	}
	if !needsConfirm(externalWrite, "close", nil) {
		t.Fatal("native safe action name must not bypass external tool confirmation")
	}
	if needsConfirm(externalRead, "query", nil) {
		t.Fatal("external tool explicitly declared read-only should not require confirmation")
	}
	if needsLocalSnapshot(externalWrite, "write") {
		t.Fatal("external write cannot be rolled back by a local repository snapshot")
	}
	if !needsLocalSnapshot(nativeWrite, "write") {
		t.Fatal("native write should create a local repository snapshot")
	}
	if needsLocalSnapshot(nativeExternalWrite, "write") {
		t.Fatal("native tool writing an external service cannot be rolled back by a local repository snapshot")
	}
	if !needsConfirm("import", "md", nil) || !needsLocalSnapshot("import", "md") {
		t.Fatal("markdown import must require confirmation and a snapshot despite export using the same safe action name")
	}
	if !needsConfirm("unzip", "", nil) || !needsLocalSnapshot("unzip", "") {
		t.Fatal("actionless write tool must require confirmation and create a local snapshot")
	}
	if needsConfirm("web_fetch", "", nil) || needsLocalSnapshot("web_fetch", "") {
		t.Fatal("actionless read-only tool must not require confirmation or create a snapshot")
	}
	if needsConfirm("todo_write", "", nil) || needsLocalSnapshot("todo_write", "") {
		t.Fatal("agent session todo updates must not require confirmation or create a repository snapshot")
	}
	if needsConfirm("http_request", "", nil) || needsLocalSnapshot("http_request", "") {
		t.Fatal("http_request without an action defaults to a read-only GET")
	}
}

func TestImageToolActionEffects(t *testing.T) {
	if needsConfirm("image", "list", nil) || needsLocalSnapshot("image", "list") {
		t.Fatal("listing document images must be a confirmation-free local read")
	}
	if !needsConfirm("image", "analyze", nil) || needsLocalSnapshot("image", "analyze") {
		t.Fatal("image analysis must confirm data egress without creating a local snapshot")
	}
	if !needsConfirm("image", "generate", nil) || !needsLocalSnapshot("image", "generate") {
		t.Fatal("image generation must confirm external cost and snapshot the local write")
	}
	if needsConfirm("image", "analyze", map[string]bool{"image::analyze": true}) {
		t.Fatal("an explicitly allowed image action should not ask again")
	}
}

func TestSkillToolActionEffects(t *testing.T) {
	for _, action := range []string{"", "load", "list"} {
		if needsConfirm("skill", action, nil) || needsLocalSnapshot("skill", action) {
			t.Errorf("read-only skill action %q must not require confirmation or create a snapshot", action)
		}
	}
	for _, action := range []string{"save", "install", "remove", "rename"} {
		if !needsConfirm("skill", action, nil) || !needsLocalSnapshot("skill", action) {
			t.Errorf("write skill action %q must require confirmation and create a snapshot", action)
		}
	}
}

func TestQueryToolActionEffects(t *testing.T) {
	tests := []struct {
		toolName     string
		action       string
		needsConfirm bool
	}{
		{toolName: "sql", action: "query"},
		{toolName: "sql", action: ""},
		{toolName: "sql", action: "select"},
		{toolName: "search", action: "fulltext"},
		{toolName: "search", action: "semantic", needsConfirm: true},
		{toolName: "search", action: "asset"},
		{toolName: "search", action: "getasset"},
		{toolName: "search", action: "unknown"},
	}
	for _, test := range tests {
		if actual := needsConfirm(test.toolName, test.action, nil); actual != test.needsConfirm {
			t.Errorf("unexpected confirmation decision for %s::%s: got %t, want %t",
				test.toolName, test.action, actual, test.needsConfirm)
		}
		if needsLocalSnapshot(test.toolName, test.action) {
			t.Errorf("read-only action %s::%s must not create a local snapshot", test.toolName, test.action)
		}
	}
}

func TestConfirmSessionAcceptsResponseOnce(t *testing.T) {
	const sessionID = "test-confirm-session"
	const confirmID = "test-confirm"
	ch := make(chan confirmResult, 1)
	confirmChannelsMu.Lock()
	confirmChannels[sessionID+"\x00"+confirmID] = ch
	confirmChannelsMu.Unlock()
	t.Cleanup(func() {
		confirmChannelsMu.Lock()
		delete(confirmChannels, sessionID+"\x00"+confirmID)
		confirmChannelsMu.Unlock()
	})

	if !ConfirmSession(sessionID, confirmID, true, false) {
		t.Fatal("registered confirmation was rejected")
	}
	if ConfirmSession(sessionID, confirmID, false, false) {
		t.Fatal("duplicate confirmation was accepted")
	}
	result, accepted := finishConfirmWait(sessionID, confirmID, ch)
	if !accepted || !result.approved || result.always {
		t.Fatalf("unexpected confirmation result: %#v, accepted=%v", result, accepted)
	}
}

func TestQuestionAndFrontendResultsAreAcceptedOnce(t *testing.T) {
	const sessionID = "test-results-session"
	const questionID = "test-question"
	questionCh := make(chan QuestionAnswer, 1)
	questionChannelsMu.Lock()
	questionChannels[sessionID+"\x00"+questionID] = questionCh
	questionChannelsMu.Unlock()
	if !AnswerQuestion(sessionID, questionID, []string{"answer"}) || AnswerQuestion(sessionID, questionID, []string{"duplicate"}) {
		t.Fatal("question answer was not accepted exactly once")
	}
	if answer := <-questionCh; len(answer.Answers) != 1 || answer.Answers[0] != "answer" {
		t.Fatalf("unexpected question answer: %#v", answer)
	}

	const callID = "test-frontend-call"
	frontendCh := make(chan frontendCallResult, 1)
	frontendCallChannelsMu.Lock()
	frontendCallChannels[sessionID+"\x00"+callID] = frontendCh
	frontendCallChannelsMu.Unlock()
	if !FrontendToolResult(sessionID, callID, "result", false) || FrontendToolResult(sessionID, callID, "duplicate", false) {
		t.Fatal("frontend result was not accepted exactly once")
	}
	if result := <-frontendCh; result.result != "result" || result.isError {
		t.Fatalf("unexpected frontend result: %#v", result)
	}
}

func TestWaitCompletionKeepsConcurrentlyAcceptedResults(t *testing.T) {
	const sessionID = "test-race-session"
	const questionID = "test-question-timeout-race"
	questionCh := make(chan QuestionAnswer, 1)
	questionChannelsMu.Lock()
	questionChannels[sessionID+"\x00"+questionID] = questionCh
	questionChannelsMu.Unlock()
	if !AnswerQuestion(sessionID, questionID, []string{"accepted"}) {
		t.Fatal("question answer was rejected")
	}
	answer, accepted := finishQuestionWait(sessionID, questionID, questionCh)
	if !accepted || len(answer.Answers) != 1 || answer.Answers[0] != "accepted" {
		t.Fatalf("accepted question answer was lost: %#v, accepted=%v", answer, accepted)
	}

	const callID = "test-frontend-timeout-race"
	frontendCh := make(chan frontendCallResult, 1)
	frontendCallChannelsMu.Lock()
	frontendCallChannels[sessionID+"\x00"+callID] = frontendCh
	frontendCallChannelsMu.Unlock()
	if !FrontendToolResult(sessionID, callID, "accepted", false) {
		t.Fatal("frontend result was rejected")
	}
	result, accepted := finishFrontendWait(sessionID, callID, frontendCh)
	if !accepted || result.result != "accepted" || result.isError {
		t.Fatalf("accepted frontend result was lost: %#v, accepted=%v", result, accepted)
	}
}

func TestBrowserCapabilityResultsAreAcceptedOnce(t *testing.T) {
	const callID = "test-browser-capability-call"
	capabilityCh := make(chan browserCapabilityResult, 1)
	browserCapabilityChannelsMu.Lock()
	browserCapabilityChannels[callID] = capabilityCh
	browserCapabilityChannelsMu.Unlock()
	if !BrowserCapabilityResult(callID, "result", nil, false, false) ||
		BrowserCapabilityResult(callID, "duplicate", nil, false, false) {
		t.Fatal("browser capability result was not accepted exactly once")
	}
	result, accepted := finishBrowserCapabilityWait(callID, capabilityCh)
	if !accepted || result.result != "result" || result.isError {
		t.Fatalf("unexpected browser capability result: %#v, accepted=%v", result, accepted)
	}
}

func TestBrowserCapabilityValidatesStructuredOutput(t *testing.T) {
	validationTool := &tools.Tool{
		Name: "test_browser_capability_output", Description: "Test browser capability output",
		InputSchema: tools.ToolSchema{Type: "object"},
		OutputSchema: &tools.ToolSchema{
			Type: "object",
			Properties: map[string]tools.Property{
				"value": {Type: "string"},
			},
			Required: []string{"value"},
		},
	}
	validator, err := tools.CompileToolValidator(validationTool)
	if err != nil {
		t.Fatal(err)
	}
	registration := &capabilityRegistration{
		ID: "native/frontend/test_output", ModelName: validationTool.Name,
		Runtime: "browser", Validator: validator,
	}
	events := make(chan AgentEvent, 1)
	resultCh := make(chan executedToolResult, 1)
	go func() {
		resultCh <- handleBrowserCapability(context.Background(), openai.ToolCall{
			Function: openai.FunctionCall{Name: validationTool.Name, Arguments: `{}`},
		}, registration, map[string]any{}, events, time.Second)
	}()
	event := <-events
	if event.Type != "browser_capability_call" {
		t.Fatalf("unexpected event: %#v", event)
	}
	if !BrowserCapabilityResult(event.CallID, "", map[string]any{"value": 1}, true, false) {
		t.Fatal("browser capability result was rejected")
	}
	result := <-resultCh
	if !result.IsError || !result.ExecutionUnknown {
		t.Fatalf("invalid structured output was accepted: %#v", result)
	}
}

func TestInteractiveResultsAreIsolatedBySession(t *testing.T) {
	const (
		ownerSession = "test-owner-session"
		otherSession = "test-other-session"
		confirmID    = "shared-confirm-id"
	)
	ch := make(chan confirmResult, 1)
	confirmChannelsMu.Lock()
	confirmChannels[ownerSession+"\x00"+confirmID] = ch
	confirmChannelsMu.Unlock()
	t.Cleanup(func() {
		confirmChannelsMu.Lock()
		delete(confirmChannels, ownerSession+"\x00"+confirmID)
		confirmChannelsMu.Unlock()
	})

	if ConfirmSession(otherSession, confirmID, true, false) {
		t.Fatal("another session accepted the confirmation")
	}
	if !ConfirmSession(ownerSession, confirmID, true, false) {
		t.Fatal("owning session did not accept the confirmation")
	}
}

func TestExecuteToolPropagatesUnknownExecution(t *testing.T) {
	const toolName = "test_unknown_execution"
	if err := tools.SetTool(toolName, &tools.Tool{
		Name:        toolName,
		Source:      "mcp",
		InputSchema: tools.ToolSchema{Type: "object"},
		Handler: func(args map[string]any) (tools.CallToolResult, error) {
			return tools.CallToolResult{
				Content:          []tools.ContentItem{{Type: "text", Text: "result unknown"}},
				IsError:          true,
				ExecutionUnknown: true,
			}, nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tools.RemoveTool(toolName) })

	result, isErr, executionUnknown := executeTool(context.Background(), openai.ToolCall{
		Function: openai.FunctionCall{Name: toolName, Arguments: `{}`},
	}, "", nil, "", 0, false, nil)
	if result != "result unknown" || !isErr || !executionUnknown {
		t.Fatalf("unexpected tool result: result=%q, isErr=%v, executionUnknown=%v", result, isErr, executionUnknown)
	}
}

func TestExecuteToolCancellationMarksExecutionUnknown(t *testing.T) {
	const toolName = "test_cancelled_execution"
	started := make(chan struct{})
	release := make(chan struct{})
	if err := tools.SetTool(toolName, &tools.Tool{
		Name:        toolName,
		InputSchema: tools.ToolSchema{Type: "object"},
		Handler: func(args map[string]any) (tools.CallToolResult, error) {
			close(started)
			<-release
			return tools.CallToolResult{Content: []tools.ContentItem{{Type: "text", Text: "late result"}}}, nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		close(release)
		tools.RemoveTool(toolName)
	})

	ctx, cancel := context.WithCancel(context.Background())
	resultCh := make(chan struct {
		text    string
		isErr   bool
		unknown bool
	}, 1)
	go func() {
		text, isErr, unknown := executeTool(ctx, openai.ToolCall{
			Function: openai.FunctionCall{Name: toolName, Arguments: `{}`},
		}, "", nil, "", 0, false, nil)
		resultCh <- struct {
			text    string
			isErr   bool
			unknown bool
		}{text: text, isErr: isErr, unknown: unknown}
	}()
	<-started
	cancel()
	result := <-resultCh
	if !result.isErr || !result.unknown || result.text == "" {
		t.Fatalf("cancelled tool result was not marked unknown: %#v", result)
	}
}

func TestExecuteToolDoesNotStartAfterCancellation(t *testing.T) {
	const toolName = "test_pre_cancelled_execution"
	invoked := false
	if err := tools.SetTool(toolName, &tools.Tool{
		Name:        toolName,
		InputSchema: tools.ToolSchema{Type: "object"},
		Handler: func(args map[string]any) (tools.CallToolResult, error) {
			invoked = true
			return tools.CallToolResult{}, nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tools.RemoveTool(toolName) })

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result, isErr, executionUnknown := executeTool(ctx, openai.ToolCall{
		Function: openai.FunctionCall{Name: toolName, Arguments: `{}`},
	}, "", nil, "", 0, false, nil)
	if invoked || result == "" || !isErr || executionUnknown {
		t.Fatalf("pre-cancelled tool was handled incorrectly: invoked=%v, result=%q, isErr=%v, executionUnknown=%v",
			invoked, result, isErr, executionUnknown)
	}
}

func TestExecuteToolCombinesProgressAndIdempotencyContext(t *testing.T) {
	const toolName = "test_progress_execution"
	var receivedArgs map[string]any
	var emitted tools.ToolProgress
	if err := tools.SetTool(toolName, &tools.Tool{
		Name:        toolName,
		Source:      "native",
		InputSchema: tools.ToolSchema{Type: "object"},
		Handler: func(args map[string]any) (tools.CallToolResult, error) {
			t.Fatal("plain handler called despite progress callback")
			return tools.CallToolResult{}, nil
		},
		ProgressHandler: func(args map[string]any, emit tools.ToolProgressCallback) (tools.CallToolResult, error) {
			receivedArgs = args
			emit(tools.ToolProgress{Phase: "done", Done: 1, Total: 1})
			return tools.CallToolResult{Content: []tools.ContentItem{{Type: "text", Text: "complete"}}}, nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tools.RemoveTool(toolName) })

	result, isErr, executionUnknown := executeTool(context.Background(), openai.ToolCall{
		ID:       "call-1",
		Function: openai.FunctionCall{Name: toolName, Arguments: `{}`},
	}, "session-1", nil, "", 0, false, func(progress tools.ToolProgress) {
		emitted = progress
	})
	if result != "complete" || isErr || executionUnknown {
		t.Fatalf("unexpected progress tool result: result=%q isErr=%v unknown=%v", result, isErr, executionUnknown)
	}
	if receivedArgs["_sessionID"] != "session-1" || receivedArgs["_toolCallID"] != "call-1" {
		t.Fatalf("native execution context missing: %#v", receivedArgs)
	}
	if emitted.Phase != "done" || emitted.Done != 1 || emitted.Total != 1 {
		t.Fatalf("progress callback not forwarded: %#v", emitted)
	}
}
