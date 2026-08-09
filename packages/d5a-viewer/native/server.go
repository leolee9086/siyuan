package d5a

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const sceneFileAPIPath = "/api/scene-file"

type localWebServer struct {
	host     string
	port     int
	baseURL  string
	server   *http.Server
	listener net.Listener
}

type webSource struct {
	files fs.FS
	label string
}

func serveCommand(argv []string) error {
	args, errorValue := parseArguments(argv, []string{"host", "port", "root", "state"}, []string{"open", "json"})
	if errorValue != nil {
		return errorValue
	}
	if len(args.positionals) > 0 {
		return fmt.Errorf("serve 不接受位置参数")
	}
	host, port, errorValue := serverAddress(args)
	if errorValue != nil {
		return errorValue
	}
	source, errorValue := resolveWebSource(args.one("root"))
	if errorValue != nil {
		return errorValue
	}
	statePath := args.one("state")
	if statePath != "" {
		statePath, errorValue = filepath.Abs(statePath)
		if errorValue != nil {
			return errorValue
		}
	}
	handler := createWebHandler(source, statePath, "", "", "")
	server, errorValue := startLocalServer(host, port, 20, handler)
	if errorValue != nil {
		return errorValue
	}
	defer server.close()
	output := map[string]any{"schemaVersion": 1, "status": "ready", "host": server.host, "port": server.port, "url": server.baseURL, "root": source.label}
	if statePath != "" {
		output["state"] = statePath
	}
	if args.flags["json"] {
		if errorValue = printJSON(output); errorValue != nil {
			return errorValue
		}
	} else {
		fmt.Printf("D5 本地 WebUI 已启动: %s\n", server.baseURL)
		fmt.Printf("静态资源: %s\n", source.label)
		if statePath != "" {
			fmt.Printf("批处理状态: %s\n", statePath)
		}
	}
	if args.flags["open"] {
		_ = openBrowser(server.baseURL)
	}
	waitForTermination()
	return nil
}

func viewCommand(argv []string) error {
	args, errorValue := parseArguments(argv, []string{"input", "host", "port", "root"}, []string{"open", "json"})
	if errorValue != nil {
		return errorValue
	}
	input := args.one("input")
	if input == "" && len(args.positionals) > 0 {
		input = args.positionals[0]
	}
	if input == "" {
		return fmt.Errorf("请提供待查看的 .d5a 或 .glb 文件")
	}
	if len(args.positionals) > 1 {
		return fmt.Errorf("场景查看只接受一个输入文件")
	}
	input, errorValue = filepath.Abs(input)
	if errorValue != nil {
		return errorValue
	}
	format, errorValue := sceneFormat(input)
	if errorValue != nil {
		return errorValue
	}
	metadata, errorValue := os.Stat(input)
	if errorValue != nil {
		return errorValue
	}
	if !metadata.Mode().IsRegular() {
		return fmt.Errorf("%s 不是普通文件", input)
	}
	host, port, errorValue := serverAddress(args)
	if errorValue != nil {
		return errorValue
	}
	source, errorValue := resolveWebSource(args.one("root"))
	if errorValue != nil {
		return errorValue
	}
	token, errorValue := randomToken()
	if errorValue != nil {
		return errorValue
	}
	handler := createWebHandler(source, "", input, token, format)
	server, errorValue := startLocalServer(host, port, 20, handler)
	if errorValue != nil {
		return errorValue
	}
	defer server.close()
	query := url.Values{}
	query.Set("scene", sceneFileAPIPath+"?token="+url.QueryEscape(token))
	viewURL := server.baseURL + "?" + query.Encode()
	output := map[string]any{
		"schemaVersion": 1, "status": "ready", "operation": "view", "format": format, "input": input,
		"bytes": metadata.Size(), "host": server.host, "port": server.port, "url": viewURL,
	}
	if args.flags["json"] {
		if errorValue = printJSON(output); errorValue != nil {
			return errorValue
		}
	} else {
		fmt.Printf("D5 本地查看器已启动: %s\n", viewURL)
		fmt.Printf("%s / %s / %d 字节\n", filepath.Base(input), strings.ToUpper(format), metadata.Size())
	}
	if args.flags["open"] {
		_ = openBrowser(viewURL)
	}
	waitForTermination()
	return nil
}

func serverAddress(args arguments) (string, int, error) {
	host := args.one("host")
	if host == "" {
		host = "127.0.0.1"
	}
	if host != "127.0.0.1" && host != "localhost" && host != "::1" {
		return "", 0, fmt.Errorf("--host 只接受 127.0.0.1、localhost 或 ::1")
	}
	portText := args.one("port")
	if portText == "" {
		portText = "5329"
	}
	port, errorValue := parsePort(portText)
	return host, port, errorValue
}

func resolveWebSource(root string) (webSource, error) {
	if root == "" {
		files, errorValue := embeddedWebFS()
		if errorValue != nil {
			return webSource{}, errorValue
		}
		if _, errorValue = fs.Stat(files, "index.html"); errorValue != nil {
			return webSource{}, fmt.Errorf("内嵌 WebUI 缺少 index.html；请通过 build:native 构建: %w", errorValue)
		}
		return webSource{files: files, label: "embedded://web"}, nil
	}
	absolute, errorValue := filepath.Abs(root)
	if errorValue != nil {
		return webSource{}, errorValue
	}
	files := os.DirFS(absolute)
	if _, errorValue = fs.Stat(files, "index.html"); errorValue != nil {
		return webSource{}, fmt.Errorf("WebUI 根目录缺少 index.html: %w", errorValue)
	}
	return webSource{files: files, label: absolute}, nil
}

func startLocalServer(host string, preferredPort, attempts int, handler http.Handler) (*localWebServer, error) {
	var lastError error
	for offset := 0; offset < attempts; offset++ {
		portValue := preferredPort + offset
		if portValue > 65535 {
			break
		}
		listener, errorValue := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(portValue)))
		if errorValue != nil {
			lastError = errorValue
			continue
		}
		actualPort := listener.Addr().(*net.TCPAddr).Port
		displayHost := host
		if strings.Contains(displayHost, ":") {
			displayHost = "[" + displayHost + "]"
		}
		server := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
		result := &localWebServer{host: host, port: actualPort, baseURL: fmt.Sprintf("http://%s:%d/", displayHost, actualPort), server: server, listener: listener}
		go func() { _ = server.Serve(listener) }()
		return result, nil
	}
	if lastError == nil {
		lastError = fmt.Errorf("没有可用的本地 WebUI 端口")
	}
	return nil, lastError
}

func (server *localWebServer) close() error {
	contextValue, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return server.server.Shutdown(contextValue)
}

func createWebHandler(source webSource, statePath, scenePath, sceneToken, sceneFormatValue string) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/api/d5m-batch/state" && statePath != "" {
			serveBatchState(response, request, statePath)
			return
		}
		if request.URL.Path == sceneFileAPIPath && scenePath != "" {
			serveSceneFile(response, request, scenePath, sceneToken, sceneFormatValue)
			return
		}
		serveWebAsset(response, request, source.files)
	})
}

func serveBatchState(response http.ResponseWriter, request *http.Request, statePath string) {
	if request.Method != http.MethodGet {
		response.Header().Set("Allow", "GET")
		writeAPIError(response, http.StatusMethodNotAllowed, "method-not-allowed")
		return
	}
	state, errorValue := readJSONFile(statePath)
	if os.IsNotExist(errorValue) {
		writeAPIError(response, http.StatusNotFound, "state-not-found")
		return
	}
	if errorValue != nil {
		writeAPIError(response, http.StatusInternalServerError, errorValue.Error())
		return
	}
	writeJSONResponse(response, http.StatusOK, map[string]any{"schemaVersion": 1, "state": state})
}

func serveSceneFile(response http.ResponseWriter, request *http.Request, scenePath, token, format string) {
	if request.URL.Query().Get("token") != token {
		writeAPIError(response, http.StatusNotFound, "scene-not-found")
		return
	}
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		writeAPIError(response, http.StatusMethodNotAllowed, "method-not-allowed")
		return
	}
	metadata, errorValue := os.Stat(scenePath)
	if errorValue != nil || !metadata.Mode().IsRegular() {
		writeAPIError(response, http.StatusNotFound, "scene-not-found")
		return
	}
	contentType := "application/octet-stream"
	if format == "d5a" {
		contentType = "application/zip"
	} else if format == "glb" {
		contentType = "model/gltf-binary"
	}
	response.Header().Set("Content-Type", contentType)
	response.Header().Set("Content-Length", strconv.FormatInt(metadata.Size(), 10))
	response.Header().Set("Cache-Control", "no-store")
	response.Header().Set("X-Content-Type-Options", "nosniff")
	response.Header().Set("X-D5-Scene-Filename", url.PathEscape(filepath.Base(scenePath)))
	response.Header().Set("X-D5-Scene-Last-Modified", strconv.FormatInt(metadata.ModTime().UnixMilli(), 10))
	response.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	file, errorValue := os.Open(scenePath)
	if errorValue != nil {
		return
	}
	defer file.Close()
	_, _ = io.CopyBuffer(response, file, make([]byte, 256*1024))
}

func serveWebAsset(response http.ResponseWriter, request *http.Request, files fs.FS) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		http.Error(response, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	requested, errorValue := url.PathUnescape(request.URL.EscapedPath())
	if errorValue != nil || strings.Contains(requested, "\\") {
		http.Error(response, "Bad Request", http.StatusBadRequest)
		return
	}
	requested = strings.TrimPrefix(requested, "/")
	if requested == "" {
		requested = "index.html"
	}
	cleaned := path.Clean(requested)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || path.IsAbs(cleaned) {
		http.Error(response, "Forbidden", http.StatusForbidden)
		return
	}
	content, readError := fs.ReadFile(files, cleaned)
	if readError != nil && path.Ext(cleaned) == "" {
		cleaned = "index.html"
		content, readError = fs.ReadFile(files, cleaned)
	}
	if readError != nil {
		http.Error(response, "Not Found", http.StatusNotFound)
		return
	}
	etag := fmt.Sprintf("W/\"%x\"", len(content))
	response.Header().Set("ETag", etag)
	response.Header().Set("X-Content-Type-Options", "nosniff")
	response.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	if cleaned == "index.html" {
		response.Header().Set("Cache-Control", "no-cache")
	} else {
		response.Header().Set("Cache-Control", "public, max-age=3600")
	}
	contentType := mime.TypeByExtension(strings.ToLower(path.Ext(cleaned)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	response.Header().Set("Content-Type", contentType)
	response.Header().Set("Content-Length", strconv.Itoa(len(content)))
	if request.Header.Get("If-None-Match") == etag {
		response.WriteHeader(http.StatusNotModified)
		return
	}
	response.WriteHeader(http.StatusOK)
	if request.Method == http.MethodGet {
		_, _ = response.Write(content)
	}
}

func writeAPIError(response http.ResponseWriter, status int, code string) {
	writeJSONResponse(response, status, map[string]any{"schemaVersion": 1, "error": code})
}

func writeJSONResponse(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.Header().Set("Cache-Control", "no-store")
	response.Header().Set("X-Content-Type-Options", "nosniff")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

func randomToken() (string, error) {
	buffer := make([]byte, 24)
	if _, errorValue := rand.Read(buffer); errorValue != nil {
		return "", errorValue
	}
	return hex.EncodeToString(buffer), nil
}

func waitForTermination() {
	contextValue, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-contextValue.Done()
}

func openBrowser(target string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	case "darwin":
		command = exec.Command("open", target)
	default:
		command = exec.Command("xdg-open", target)
	}
	return command.Start()
}
