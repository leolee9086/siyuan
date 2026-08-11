package fileprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	fileTimeEpochMilliseconds = int64(11644473600000)
	fileTimeThreshold         = int64(100000000000000)
)

type everythingResponse struct {
	Results          []everythingResult `json:"results"`
	TotalResults     int                `json:"totalResults"`
	TotalFileResults int                `json:"totalFileResults"`
}

type everythingResult struct {
	Type         string          `json:"type"`
	Name         string          `json:"name"`
	Path         string          `json:"path"`
	Size         json.RawMessage `json:"size"`
	DateModified json.RawMessage `json:"date_modified"`
	DateCreated  json.RawMessage `json:"date_created"`
}

// ValidateLoopbackEndpoint prevents the browser from turning the kernel into
// a proxy for arbitrary remote hosts.
func ValidateLoopbackEndpoint(host string, port int) error {
	host = strings.TrimSpace(strings.Trim(host, "[]"))
	if port < 1 || port > 65535 || host == "" {
		return ErrInvalidProviderRequest
	}
	if strings.EqualFold(host, "localhost") {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return ErrInvalidProviderRequest
	}
	return nil
}

func BuildEverythingURL(host string, port int, request SearchRequest) (string, error) {
	if err := ValidateLoopbackEndpoint(host, port); err != nil {
		return "", err
	}
	offset, limit, err := NormalizePage(request.Offset, request.Limit)
	if err != nil {
		return "", err
	}
	values := url.Values{}
	values.Set("search", request.Search)
	values.Set("json", "1")
	values.Set("path_column", "1")
	values.Set("size_column", "1")
	values.Set("date_modified_column", "1")
	values.Set("date_created_column", "1")
	values.Set("count", strconv.Itoa(limit))
	if offset > 0 {
		values.Set("o", strconv.Itoa(offset))
	}
	if request.Sort != "" {
		values.Set("sort", request.Sort)
	}
	return fmt.Sprintf("http://%s:%d/?%s", host, port, values.Encode()), nil
}

func SearchEverything(ctx context.Context, request SearchRequest, client *http.Client) (Page, error) {
	if request.Provider != "" && request.Provider != ProviderEverythingHTTP {
		return Page{}, ErrInvalidProviderRequest
	}
	endpoint, err := BuildEverythingURL(request.Host, request.Port, request)
	if err != nil {
		return Page{}, err
	}
	if client == nil {
		client = http.DefaultClient
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Page{}, err
	}
	response, err := client.Do(httpRequest)
	if err != nil {
		if ctx.Err() != nil {
			return Page{}, ctx.Err()
		}
		return Page{}, fmt.Errorf("%w: %v", ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return Page{}, fmt.Errorf("%w: HTTP %d", ErrProviderUnavailable, response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 32<<20))
	if err != nil {
		return Page{}, fmt.Errorf("%w: %v", ErrProviderUnavailable, err)
	}
	var payload everythingResponse
	if err = json.Unmarshal(body, &payload); err != nil || payload.Results == nil {
		return Page{}, fmt.Errorf("%w: %v", ErrProviderResponse, err)
	}
	offset, limit, err := NormalizePage(request.Offset, request.Limit)
	if err != nil {
		return Page{}, err
	}
	assets := make([]Asset, 0, len(payload.Results))
	issues := make([]AssetIssue, 0)
	for index, item := range payload.Results {
		if !strings.EqualFold(strings.TrimSpace(item.Type), "file") {
			continue
		}
		path := joinExternalPath(item.Path, item.Name)
		if path == "" {
			issues = append(issues, AssetIssue{Line: index + 1, Code: "missing-path", Message: "Everything file result has no path"})
			continue
		}
		size, sizeIssue := parseNumber(item.Size)
		modified, modifiedIssue := parseTimestamp(item.DateModified)
		created, createdIssue := parseTimestamp(item.DateCreated)
		asset := Asset{
			ID:        "everything:" + path,
			Name:      item.Name,
			Path:      path,
			Extension: extension(path),
			Size:      size,
			Modified:  modified,
			Created:   created,
		}
		for _, issue := range []struct {
			code string
			text string
		}{
			{"invalid-size", sizeIssue},
			{"invalid-date-modified", modifiedIssue},
			{"invalid-date-created", createdIssue},
		} {
			if issue.text != "" {
				asset.Issues = append(asset.Issues, AssetIssue{Line: index + 1, Code: issue.code, Message: issue.text})
			}
		}
		assets = append(assets, asset)
	}
	total := payload.TotalFileResults
	if total <= 0 {
		total = payload.TotalResults
	}
	if total <= 0 {
		total = offset + len(assets)
	}
	return Page{
		Provider: ProviderEverythingHTTP, Assets: assets, Issues: issues,
		TotalCount: total, Offset: offset, Limit: limit,
		HasMore: offset+len(payload.Results) < total || len(payload.Results) >= limit,
	}, nil
}

func parseNumber(raw json.RawMessage) (int64, string) {
	if len(raw) == 0 || string(raw) == "null" {
		return 0, ""
	}
	var text string
	if raw[0] == '"' {
		if err := json.Unmarshal(raw, &text); err != nil {
			return 0, err.Error()
		}
	} else {
		text = string(raw)
	}
	value, err := strconv.ParseInt(strings.TrimSpace(text), 10, 64)
	if err != nil {
		return 0, err.Error()
	}
	return value, ""
}

func parseTimestamp(raw json.RawMessage) (int64, string) {
	value, issue := parseNumber(raw)
	if issue != "" || value == 0 {
		return value, issue
	}
	if value >= fileTimeThreshold {
		return value/10000 - fileTimeEpochMilliseconds, ""
	}
	return value, ""
}

func joinExternalPath(directory, name string) string {
	directory = strings.TrimRight(strings.TrimSpace(strings.ReplaceAll(directory, "\\", "/")), "/")
	name = strings.TrimSpace(strings.ReplaceAll(name, "\\", "/"))
	if directory == "" {
		return name
	}
	if name == "" {
		return directory
	}
	return directory + "/" + strings.TrimLeft(name, "/")
}

func extension(path string) string {
	name := path
	if slash := strings.LastIndex(name, "/"); slash >= 0 {
		name = name[slash+1:]
	}
	if dot := strings.LastIndex(name, "."); dot >= 0 {
		return strings.ToLower(name[dot:])
	}
	return ""
}
