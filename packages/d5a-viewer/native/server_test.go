package d5a

import (
	"bytes"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func TestWebHandlerServesAssetsStateAndSPA(t *testing.T) {
	files := fstest.MapFS{
		"index.html":    &fstest.MapFile{Data: []byte("<html>viewer</html>")},
		"assets/app.js": &fstest.MapFile{Data: []byte("console.log('viewer')")},
	}
	statePath := filepath.Join(t.TempDir(), "state.json")
	if errorValue := os.WriteFile(statePath, []byte(`{"schemaVersion":1,"jobs":[]}`), 0o644); errorValue != nil {
		t.Fatal(errorValue)
	}
	handler := createWebHandler(webSource{files: files, label: "test"}, statePath, "", "", "")

	for _, requestPath := range []string{"/", "/models/fixture"} {
		request := httptest.NewRequest(http.MethodGet, requestPath, nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "viewer") {
			t.Fatalf("unexpected response for %s: %d %q", requestPath, response.Code, response.Body.String())
		}
	}

	stateRequest := httptest.NewRequest(http.MethodGet, "/api/d5m-batch/state", nil)
	stateResponse := httptest.NewRecorder()
	handler.ServeHTTP(stateResponse, stateRequest)
	if stateResponse.Code != http.StatusOK || !strings.Contains(stateResponse.Body.String(), `"jobs":[]`) {
		t.Fatalf("unexpected state response: %d %s", stateResponse.Code, stateResponse.Body.String())
	}

	postRequest := httptest.NewRequest(http.MethodPost, "/assets/app.js", nil)
	postResponse := httptest.NewRecorder()
	handler.ServeHTTP(postResponse, postRequest)
	if postResponse.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected method guard, got %d", postResponse.Code)
	}
}

func TestSceneFileEndpointRequiresTokenAndStreamsBytes(t *testing.T) {
	scenePath := filepath.Join(t.TempDir(), "fixture.d5a")
	sceneBytes := []byte("scene-bytes")
	if errorValue := os.WriteFile(scenePath, sceneBytes, 0o644); errorValue != nil {
		t.Fatal(errorValue)
	}
	handler := createWebHandler(webSource{files: fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("viewer")}}}, "", scenePath, "TOKEN", "d5a")

	wrongToken := httptest.NewRecorder()
	handler.ServeHTTP(wrongToken, httptest.NewRequest(http.MethodGet, sceneFileAPIPath+"?token=WRONG", nil))
	if wrongToken.Code != http.StatusNotFound {
		t.Fatalf("expected hidden endpoint for wrong token, got %d", wrongToken.Code)
	}

	post := httptest.NewRecorder()
	handler.ServeHTTP(post, httptest.NewRequest(http.MethodPost, sceneFileAPIPath+"?token=TOKEN", nil))
	if post.Code != http.StatusMethodNotAllowed || post.Header().Get("Allow") != "GET, HEAD" {
		t.Fatalf("unexpected method response: %d %q", post.Code, post.Header().Get("Allow"))
	}

	head := httptest.NewRecorder()
	handler.ServeHTTP(head, httptest.NewRequest(http.MethodHead, sceneFileAPIPath+"?token=TOKEN", nil))
	if head.Code != http.StatusOK || head.Body.Len() != 0 || head.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("unexpected HEAD response: %d %d %q", head.Code, head.Body.Len(), head.Header().Get("Content-Type"))
	}

	get := httptest.NewRecorder()
	handler.ServeHTTP(get, httptest.NewRequest(http.MethodGet, sceneFileAPIPath+"?token=TOKEN", nil))
	if get.Code != http.StatusOK || !bytes.Equal(get.Body.Bytes(), sceneBytes) {
		t.Fatalf("unexpected GET response: %d %q", get.Code, get.Body.Bytes())
	}
}

func TestStartLocalServerFallsBackFromOccupiedPort(t *testing.T) {
	occupied, errorValue := net.Listen("tcp", "127.0.0.1:0")
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	defer occupied.Close()
	preferredPort := occupied.Addr().(*net.TCPAddr).Port
	handler := http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(response, "ready")
	})
	server, errorValue := startLocalServer("127.0.0.1", preferredPort, 20, handler)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	defer server.close()
	if server.port == preferredPort {
		t.Fatalf("server reused occupied port %d", preferredPort)
	}
	response, errorValue := http.Get(server.baseURL)
	if errorValue != nil {
		t.Fatal(errorValue)
	}
	defer response.Body.Close()
	content, errorValue := io.ReadAll(response.Body)
	if errorValue != nil || response.StatusCode != http.StatusOK || string(content) != "ready" {
		t.Fatalf("unexpected live response: %d %q %v", response.StatusCode, content, errorValue)
	}
}

func TestServerAddressRejectsNonLoopbackHost(t *testing.T) {
	args := arguments{values: map[string][]string{"host": {"0.0.0.0"}}, flags: map[string]bool{}}
	_, _, errorValue := serverAddress(args)
	if errorValue == nil {
		t.Fatal("expected non-loopback host rejection")
	}
}
