package externalprovidercontract

import (
	"context"
	"encoding/json"
)

// 以下接口只用于 HTTP API 的 envelope 边界。请求 JSON 在这里被 provider
// 自己解码，Kernel 不维护跨 provider 的万能字段结构；新的资源 provider
// 应优先实现 SessionProvider 与各 Resource capability 接口。
type TransportSearchProvider interface {
	Provider
	SearchPayload(context.Context, json.RawMessage) (Page, error)
}

type TransportListProvider interface {
	Provider
	ListPayload(context.Context, json.RawMessage) (DirectoryPage, error)
}

type TransportStatProvider interface {
	Provider
	StatPayload(context.Context, json.RawMessage) (Entry, error)
}

type TransportOpenProvider interface {
	Provider
	OpenPayload(context.Context, json.RawMessage) (OpenResult, error)
}

type TransportHealthProvider interface {
	Provider
	HealthPayload(context.Context, json.RawMessage) (HealthStatus, error)
}

type TransportCreateProvider interface {
	Provider
	CreatePayload(context.Context, json.RawMessage) (MutationResult, error)
}

type TransportUpdateProvider interface {
	Provider
	UpdatePayload(context.Context, json.RawMessage) (MutationResult, error)
}

type TransportDeleteProvider interface {
	Provider
	DeletePayload(context.Context, json.RawMessage) (MutationResult, error)
}

type TransportMoveProvider interface {
	Provider
	MovePayload(context.Context, json.RawMessage) (MutationResult, error)
}

type TransportCopyProvider interface {
	Provider
	CopyPayload(context.Context, json.RawMessage) (MutationResult, error)
}

type TransportIssue struct {
	Line    int    `json:"line"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type AssetIssue = TransportIssue

// Asset 是 Everything/EFU 等目录型 provider 的结果投影。
// 文件资源 provider 应返回 Entry，并保留 ResourceRef 与 Revision。
type Asset struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Path      string        `json:"path,omitempty"`
	Extension string        `json:"extension,omitempty"`
	Size      int64         `json:"size"`
	Modified  int64         `json:"modified"`
	Created   int64         `json:"created"`
	Address   *AssetAddress `json:"address,omitempty"`
	Issues    []AssetIssue  `json:"issues,omitempty"`
}

type AssetAddress struct {
	Provider ProviderID `json:"provider"`
	Token    string     `json:"token"`
	Name     string     `json:"name"`
}

type Page struct {
	Provider   ProviderID   `json:"provider"`
	Assets     []Asset      `json:"assets"`
	Issues     []AssetIssue `json:"issues,omitempty"`
	TotalCount int          `json:"totalCount"`
	Offset     int          `json:"offset"`
	Limit      int          `json:"limit"`
	Cursor     string       `json:"cursor,omitempty"`
	NextCursor string       `json:"nextCursor,omitempty"`
	HasMore    bool         `json:"hasMore"`
}
