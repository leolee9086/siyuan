package synologyfilestation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	pathpkg "path"
	"strconv"
	"strings"
	"sync"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const fileMetadataFields = `["size","time","type"]`

const synologyDiscoveryQuery = "SYNO.API.Auth,SYNO.FileStation.List,SYNO.FileStation.Download,SYNO.FileStation.Upload,SYNO.FileStation.CreateFolder,SYNO.FileStation.Rename,SYNO.FileStation.CopyMove,SYNO.FileStation.Delete"

type httpClient struct {
	client   *http.Client
	endpoint *url.URL
	mu       sync.RWMutex
	apis     map[string]apiInfo
}

type APIError struct {
	Code    int
	Message string
}

func (e *APIError) Error() string {
	if e == nil {
		return "synology file station API error"
	}
	if e.Message == "" {
		return fmt.Sprintf("synology file station API error %d", e.Code)
	}
	return fmt.Sprintf("synology file station API error %d: %s", e.Code, e.Message)
}

type responseEnvelope struct {
	Success bool `json:"success"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
	Data json.RawMessage `json:"data,omitempty"`
}

type apiInfo struct {
	Path       string `json:"path"`
	MinVersion int    `json:"minVersion"`
	MaxVersion int    `json:"maxVersion"`
}

type loginData struct {
	SID string `json:"sid"`
}

type fileData struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	IsDir      bool   `json:"isdir"`
	Additional struct {
		Size int64  `json:"size"`
		Type string `json:"type"`
		Time struct {
			Modified int64 `json:"mtime"`
			Created  int64 `json:"crtime"`
		} `json:"time"`
	} `json:"additional"`
}

type listData struct {
	Files  []fileData `json:"files"`
	Offset int        `json:"offset"`
	Total  int        `json:"total"`
}

type shareListData struct {
	Shares []fileData `json:"shares"`
}

type createFolderData struct {
	Folders []fileData `json:"folders"`
}

type taskData struct {
	TaskID string `json:"taskid"`
}

type taskStatusData struct {
	Finished bool    `json:"finished"`
	Progress float64 `json:"progress"`
}

var _ Client = (*httpClient)(nil)

func newHTTPClient(client *http.Client, endpoint string) (Client, error) {
	parsed, err := validateEndpoint(endpoint, true)
	if err != nil {
		return nil, err
	}
	if client == nil {
		client = http.DefaultClient
	}
	copyClient := *client
	previous := copyClient.CheckRedirect
	copyClient.CheckRedirect = func(request *http.Request, via []*http.Request) error {
		if err := externalprovider.ValidateEndpointRedirect(request, via); err != nil {
			return errors.Join(ErrInvalidEndpoint, err)
		}
		if previous != nil {
			return previous(request, via)
		}
		return nil
	}
	return &httpClient{client: &copyClient, endpoint: parsed, apis: make(map[string]apiInfo)}, nil
}

func (c *httpClient) Login(ctx context.Context, credentials Credentials) (string, error) {
	if err := c.discover(ctx); err != nil {
		return "", err
	}
	values := url.Values{
		"account": {credentials.Account},
		"passwd":  {credentials.Password},
		"session": {"FileStation"},
		"format":  {"sid"},
	}
	var payload loginData
	if err := c.doAPIJSON(ctx, http.MethodPost, "SYNO.API.Auth", 2, "login", "", values, nil, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.SID) == "" {
		return "", externalprovider.ErrResponse
	}
	return payload.SID, nil
}

func (c *httpClient) Logout(ctx context.Context, sid string) error {
	values := url.Values{"session": {"FileStation"}}
	return c.doAPIJSON(ctx, http.MethodGet, "SYNO.API.Auth", 2, "logout", sid, values, nil, nil)
}

func (c *httpClient) List(ctx context.Context, sid, folder string, offset, limit int, sortTerms []externalprovider.SortTerm) (FilePage, error) {
	sortBy, descending, err := synologySort(sortTerms)
	if err != nil {
		return FilePage{}, err
	}
	values := url.Values{
		"folder_path":    {folder},
		"offset":         {strconv.Itoa(offset)},
		"limit":          {strconv.Itoa(limit)},
		"sort_by":        {sortBy},
		"sort_direction": {map[bool]string{true: "desc", false: "asc"}[descending]},
		"filetype":       {"all"},
		"additional":     {fileMetadataFields},
	}
	var payload listData
	if err := c.doAPIJSON(ctx, http.MethodGet, "SYNO.FileStation.List", 2, "list", sid, values, nil, &payload); err != nil {
		return FilePage{}, err
	}
	if payload.Offset != offset || payload.Total < 0 {
		return FilePage{}, externalprovider.ErrResponse
	}
	files := make([]FileInfo, 0, len(payload.Files))
	for _, file := range payload.Files {
		files = append(files, convertFile(file))
	}
	return FilePage{Files: files, Total: payload.Total, TotalKnown: true}, nil
}

func (c *httpClient) ListShares(ctx context.Context, sid string) ([]ShareInfo, error) {
	var payload shareListData
	if err := c.doAPIJSON(ctx, http.MethodGet, "SYNO.FileStation.List", 2, "list_share", sid, nil, nil, &payload); err != nil {
		return nil, err
	}
	shares := make([]ShareInfo, 0, len(payload.Shares))
	for _, share := range payload.Shares {
		if strings.TrimSpace(share.Path) == "" || strings.TrimSpace(share.Name) == "" {
			return nil, externalprovider.ErrResponse
		}
		shares = append(shares, ShareInfo{Name: share.Name, Path: share.Path})
	}
	return shares, nil
}

func (c *httpClient) Stat(ctx context.Context, sid, path string) (FileInfo, error) {
	values := url.Values{"path": {jsonArray(path)}, "additional": {fileMetadataFields}}
	var payload listData
	if err := c.doAPIJSON(ctx, http.MethodGet, "SYNO.FileStation.List", 2, "getinfo", sid, values, nil, &payload); err != nil {
		return FileInfo{}, err
	}
	if len(payload.Files) != 1 {
		if len(payload.Files) == 0 {
			return FileInfo{}, externalprovider.ErrNotFound
		}
		return FileInfo{}, externalprovider.ErrResponse
	}
	return convertFile(payload.Files[0]), nil
}

func (c *httpClient) Open(ctx context.Context, sid, path string, byteRange *externalprovider.ByteRange) (io.ReadCloser, FileInfo, error) {
	info, err := c.Stat(ctx, sid, path)
	if err != nil {
		return nil, FileInfo{}, err
	}
	if info.IsDir {
		return nil, FileInfo{}, externalprovider.ErrInvalidRequest
	}
	values := url.Values{"path": {jsonArray(path)}, "mode": {"open"}}
	request, err := c.newAPIRequest(ctx, http.MethodGet, "SYNO.FileStation.Download", 2, "download", sid, values, nil)
	if err != nil {
		return nil, FileInfo{}, err
	}
	if byteRange != nil {
		if err := externalprovider.ValidateByteRange(byteRange); err != nil {
			return nil, FileInfo{}, err
		}
		header := "bytes=" + strconv.FormatInt(byteRange.Start, 10) + "-"
		if byteRange.End > 0 {
			header += strconv.FormatInt(byteRange.End, 10)
		}
		request.Header.Set("Range", header)
	}
	response, err := c.client.Do(request)
	if err != nil {
		return nil, FileInfo{}, unavailable(err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_ = response.Body.Close()
		return nil, FileInfo{}, &APIError{Code: response.StatusCode}
	}
	if byteRange != nil && response.StatusCode != http.StatusPartialContent {
		_ = response.Body.Close()
		return nil, FileInfo{}, externalprovider.ErrResponse
	}
	return response.Body, info, nil
}

func (c *httpClient) CreateFolder(ctx context.Context, sid, parent, name string) (FileInfo, error) {
	values := url.Values{
		"folder_path":  {jsonArray(parent)},
		"name":         {jsonArray(name)},
		"force_parent": {"false"},
		"additional":   {fileMetadataFields},
	}
	var payload createFolderData
	if err := c.doAPIJSON(ctx, http.MethodGet, "SYNO.FileStation.CreateFolder", 2, "create", sid, values, nil, &payload); err != nil {
		return FileInfo{}, err
	}
	if len(payload.Folders) != 1 {
		return FileInfo{}, externalprovider.ErrResponse
	}
	return convertFile(payload.Folders[0]), nil
}

func (c *httpClient) Upload(ctx context.Context, sid, parent, name string, body io.Reader, size int64, mediaType string, overwrite bool) error {
	if body == nil || size < 0 {
		return externalprovider.ErrInvalidRequest
	}
	var prefix bytes.Buffer
	writer := multipart.NewWriter(&prefix)
	fields := [][2]string{
		{"api", "SYNO.FileStation.Upload"},
		{"version", "2"},
		{"method", "upload"},
		{"path", parent},
		{"create_parents", "false"},
		{"overwrite", strconv.FormatBool(overwrite)},
		{"_sid", sid},
	}
	for _, field := range fields {
		if err := writer.WriteField(field[0], field[1]); err != nil {
			return err
		}
	}
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, escapeMultipartFilename(name)))
	if mediaType == "" {
		mediaType = "application/octet-stream"
	}
	header.Set("Content-Type", mediaType)
	if _, err := writer.CreatePart(header); err != nil {
		return err
	}
	suffix := "\r\n--" + writer.Boundary() + "--\r\n"
	contentLength := int64(prefix.Len()) + size + int64(len(suffix))
	stream := io.MultiReader(bytes.NewReader(prefix.Bytes()), io.LimitReader(body, size), strings.NewReader(suffix))
	path, _, err := c.apiSpec("SYNO.FileStation.Upload", 2)
	if err != nil {
		return err
	}
	request, err := c.newRequest(ctx, http.MethodPost, path, nil, stream)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.ContentLength = contentLength
	return c.doRequestJSON(request, nil)
}

func (c *httpClient) Rename(ctx context.Context, sid, path, name string) (FileInfo, error) {
	values := url.Values{
		"path":       {jsonArray(path)},
		"name":       {jsonArray(name)},
		"additional": {fileMetadataFields},
	}
	var payload listData
	if err := c.doAPIJSON(ctx, http.MethodGet, "SYNO.FileStation.Rename", 2, "rename", sid, values, nil, &payload); err != nil {
		return FileInfo{}, err
	}
	if len(payload.Files) != 1 {
		return FileInfo{}, externalprovider.ErrResponse
	}
	return convertFile(payload.Files[0]), nil
}

func (c *httpClient) Delete(ctx context.Context, sid string, paths []string, recursive bool) (Operation, error) {
	values := url.Values{
		"path":              {jsonArray(paths...)},
		"recursive":         {strconv.FormatBool(recursive)},
		"accurate_progress": {"true"},
	}
	return c.taskRequest(ctx, "SYNO.FileStation.Delete", 2, sid, values)
}

func (c *httpClient) CopyMove(ctx context.Context, sid string, paths []string, destination string, move, overwrite bool) (Operation, error) {
	values := url.Values{
		"path":              {jsonArray(paths...)},
		"dest_folder_path":  {destination},
		"overwrite":         {strconv.FormatBool(overwrite)},
		"remove_src":        {strconv.FormatBool(move)},
		"accurate_progress": {"true"},
	}
	return c.taskRequest(ctx, "SYNO.FileStation.CopyMove", 3, sid, values)
}

func (c *httpClient) Task(ctx context.Context, sid string, operation Operation) (TaskStatus, error) {
	values := url.Values{"taskid": {operation.ID}}
	var payload taskStatusData
	if err := c.doAPIJSON(ctx, http.MethodGet, operation.API, operation.Version, "status", sid, values, nil, &payload); err != nil {
		return TaskStatus{}, err
	}
	if payload.Progress < 0 || payload.Progress > 1 {
		return TaskStatus{}, externalprovider.ErrResponse
	}
	state := externalprovider.OperationRunning
	if payload.Finished {
		state = externalprovider.OperationCompleted
	}
	return TaskStatus{ID: operation.ID, State: state, Progress: int(math.Round(payload.Progress * 100))}, nil
}

func (c *httpClient) taskRequest(ctx context.Context, api string, version int, sid string, values url.Values) (Operation, error) {
	var payload taskData
	if err := c.doAPIJSON(ctx, http.MethodGet, api, version, "start", sid, values, nil, &payload); err != nil {
		return Operation{}, err
	}
	if strings.TrimSpace(payload.TaskID) == "" {
		return Operation{}, externalprovider.ErrResponse
	}
	return Operation{ID: payload.TaskID, API: api, Version: version}, nil
}

func (c *httpClient) discover(ctx context.Context) error {
	values := url.Values{
		"api":     {"SYNO.API.Info"},
		"version": {"1"},
		"method":  {"query"},
		"query":   {synologyDiscoveryQuery},
	}
	var payload map[string]apiInfo
	if err := c.doJSON(ctx, http.MethodGet, "query.cgi", values, nil, &payload); err != nil {
		return err
	}
	required := map[string]int{
		"SYNO.API.Auth":                 2,
		"SYNO.FileStation.List":         2,
		"SYNO.FileStation.Download":     2,
		"SYNO.FileStation.Upload":       2,
		"SYNO.FileStation.CreateFolder": 2,
		"SYNO.FileStation.Rename":       2,
		"SYNO.FileStation.CopyMove":     3,
		"SYNO.FileStation.Delete":       2,
	}
	for api, version := range required {
		info, ok := payload[api]
		if !ok || strings.TrimSpace(info.Path) == "" || info.MinVersion > version || info.MaxVersion < version {
			return errors.Join(externalprovider.ErrCapability, fmt.Errorf("%s version %d", api, version))
		}
		if strings.Contains(info.Path, "..") || strings.HasPrefix(info.Path, "/") || strings.ContainsAny(info.Path, "?#\\") {
			return externalprovider.ErrResponse
		}
	}
	c.mu.Lock()
	c.apis = payload
	c.mu.Unlock()
	return nil
}

func (c *httpClient) apiSpec(api string, minimumVersion int) (string, int, error) {
	c.mu.RLock()
	info, ok := c.apis[api]
	c.mu.RUnlock()
	if !ok || strings.TrimSpace(info.Path) == "" || info.MaxVersion < minimumVersion {
		return "", 0, externalprovider.ErrCapability
	}
	version := minimumVersion
	if api == "SYNO.API.Auth" {
		version = info.MaxVersion
	}
	return info.Path, version, nil
}

func (c *httpClient) newAPIRequest(ctx context.Context, method, api string, minimumVersion int, apiMethod, sid string, values url.Values, body io.Reader) (*http.Request, error) {
	path, version, err := c.apiSpec(api, minimumVersion)
	if err != nil {
		return nil, err
	}
	if values == nil {
		values = make(url.Values)
	}
	values = cloneValues(values)
	values.Set("api", api)
	values.Set("version", strconv.Itoa(version))
	values.Set("method", apiMethod)
	if sid != "" {
		values.Set("_sid", sid)
	}
	return c.newRequest(ctx, method, path, values, body)
}

func (c *httpClient) doAPIJSON(ctx context.Context, method, api string, minimumVersion int, apiMethod, sid string, values url.Values, body io.Reader, output interface{}) error {
	request, err := c.newAPIRequest(ctx, method, api, minimumVersion, apiMethod, sid, values, body)
	if err != nil {
		return err
	}
	return c.doRequestJSON(request, output)
}

func (c *httpClient) doJSON(ctx context.Context, method, endpoint string, values url.Values, body io.Reader, output interface{}) error {
	request, err := c.newRequest(ctx, method, endpoint, values, body)
	if err != nil {
		return err
	}
	return c.doRequestJSON(request, output)
}

func (c *httpClient) doRequestJSON(request *http.Request, output interface{}) error {
	response, err := c.client.Do(request)
	if err != nil {
		return unavailable(err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return &APIError{Code: response.StatusCode}
	}
	var envelope responseEnvelope
	decoder := json.NewDecoder(io.LimitReader(response.Body, 16<<20))
	if err := decoder.Decode(&envelope); err != nil {
		return errors.Join(externalprovider.ErrResponse, err)
	}
	if !envelope.Success {
		code := 500
		message := ""
		if envelope.Error != nil {
			code = envelope.Error.Code
			message = envelope.Error.Message
		}
		return &APIError{Code: code, Message: message}
	}
	if output == nil || len(envelope.Data) == 0 {
		return nil
	}
	if err := json.Unmarshal(envelope.Data, output); err != nil {
		return errors.Join(externalprovider.ErrResponse, err)
	}
	return nil
}

func (c *httpClient) newRequest(ctx context.Context, method, endpoint string, values url.Values, body io.Reader) (*http.Request, error) {
	base := *c.endpoint
	base.Path = strings.TrimRight(base.Path, "/") + "/webapi/" + endpoint
	if method == http.MethodGet || method == http.MethodDelete {
		base.RawQuery = values.Encode()
		return http.NewRequestWithContext(ctx, method, base.String(), body)
	}
	if body == nil && len(values) > 0 {
		body = strings.NewReader(values.Encode())
	}
	request, err := http.NewRequestWithContext(ctx, method, base.String(), body)
	if err != nil {
		return nil, err
	}
	if body != nil && len(values) > 0 {
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	return request, nil
}

func validateEndpoint(value string, allowInsecure bool) (*url.URL, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, ErrInvalidEndpoint
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, ErrInvalidEndpoint
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return nil, ErrInvalidEndpoint
	}
	if err = externalprovider.ValidateEndpointTransport(parsed, allowInsecure); err != nil {
		return nil, errors.Join(ErrInvalidEndpoint, err)
	}
	return parsed, nil
}

func convertFile(file fileData) FileInfo {
	return FileInfo{
		Path:      file.Path,
		Name:      file.Name,
		Size:      maxInt64(file.Additional.Size),
		IsDir:     file.IsDir,
		Modified:  unixTimestamp(file.Additional.Time.Modified),
		Created:   unixTimestamp(file.Additional.Time.Created),
		MediaType: mediaTypeForName(file.Name),
	}
}

func unixTimestamp(value int64) time.Time {
	if value <= 0 {
		return time.Time{}
	}
	return time.Unix(value, 0)
}

func jsonArray(values ...string) string {
	encoded, _ := json.Marshal(values)
	return string(encoded)
}

func cloneValues(values url.Values) url.Values {
	clone := make(url.Values, len(values))
	for key, list := range values {
		clone[key] = append([]string(nil), list...)
	}
	return clone
}

func synologySort(terms []externalprovider.SortTerm) (string, bool, error) {
	if len(terms) == 0 {
		return "name", false, nil
	}
	field := strings.ToLower(strings.TrimSpace(terms[0].Field))
	switch field {
	case "name", "size", "mtime", "atime", "ctime", "crtime", "type":
	case "modified":
		field = "mtime"
	case "created":
		field = "crtime"
	case "kind":
		field = "type"
	default:
		return "", false, externalprovider.ErrInvalidRequest
	}
	return field, terms[0].Desc, nil
}

func escapeMultipartFilename(value string) string {
	return strings.NewReplacer("\\", "\\\\", `"`, `\"`, "\r", "", "\n", "").Replace(value)
}

func mediaTypeForName(name string) string {
	return mime.TypeByExtension(strings.ToLower(pathpkg.Ext(name)))
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
