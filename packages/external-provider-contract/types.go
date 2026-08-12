// Package externalprovidercontract 定义外部文件资源 provider 的共享领域契约。
//
// 该包只描述连接、资源、游标、版本和操作语义，不包含 Kernel 的授权实现，
// 也不把某个 provider 的 HTTP/CSV 请求字段泄漏到共享层。
package externalprovidercontract

import (
	"context"
	"errors"
)

type ProviderID string
type SessionID string
type ResourceID string
type EntryID string

const (
	ProviderKindCatalog   = "catalog"
	ProviderKindObject    = "object-store"
	ProviderKindFileShare = "file-share"
	ProviderKindLocal     = "local"
)

const (
	SessionModeNone       = "none"
	SessionModeAutomatic  = "automatic"
	SessionModeConfigured = "configured"
)

const (
	CapabilitySearch     = "search"
	CapabilityList       = "list"
	CapabilityStat       = "stat"
	CapabilityOpen       = "open"
	CapabilityRead       = "read"
	CapabilityWrite      = "write"
	CapabilityCreate     = "create"
	CapabilityUpdate     = "update"
	CapabilityDelete     = "delete"
	CapabilityMove       = "move"
	CapabilityCopy       = "copy"
	CapabilityWatch      = "watch"
	CapabilityPaging     = "paging"
	CapabilityIssues     = "row-issues"
	CapabilityHealth     = "health"
	CapabilityOperations = "operations"
	CapabilityVersioning = "versioning"
)

var (
	ErrInvalidRequest                  = errors.New("external provider request is invalid")
	ErrUnavailable                     = errors.New("external provider is unavailable")
	ErrResponse                        = errors.New("external provider response is invalid")
	ErrInvalidFormat                   = errors.New("external provider format is invalid")
	ErrNotFound                        = errors.New("external provider resource was not found")
	ErrPermission                      = errors.New("external provider permission denied")
	ErrConflict                        = errors.New("external provider revision conflict")
	ErrCapability                      = errors.New("external provider capability is not implemented")
	ErrInsecureTransportNotConfirmed   = errors.New("external provider HTTP endpoint requires explicit insecure transport confirmation")
	ErrInsecureTransportHostNotPrivate = errors.New("external provider HTTP endpoint must use localhost or a loopback, private, or link-local IP address")
	ErrInsecureTransportRedirect       = errors.New("external provider credential transport redirect is not allowed")
)

// Descriptor 是注册表可安全展示的静态能力声明。
// Capabilities 使用字符串以保持 JSON 配置和现有 provider 描述兼容。
type Descriptor struct {
	ID            ProviderID     `json:"id"`
	DisplayName   string         `json:"displayName"`
	Kind          string         `json:"kind"`
	SessionMode   string         `json:"sessionMode"`
	SessionLabel  string         `json:"sessionLabel,omitempty"`
	SessionConfig *SessionConfig `json:"sessionConfig,omitempty"`
	Capabilities  []string       `json:"capabilities"`
}

// SourceDescriptor 是 provider 在当前 session 中返回的资源展示信息。
// 它不是可比较的设备身份，也不得用于跨 provider 或跨 session 归并资源。
type SourceDescriptor struct {
	Name     string            `json:"name"`
	Kind     string            `json:"kind"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// Provider 是最小注册边界。连接和资源能力通过下面的细粒度接口组合，
// 目录搜索 provider 不需要伪造文件写入能力。
type Provider interface {
	ID() ProviderID
	Descriptor() Descriptor
}

// SessionProvider 为需要登录、tree connect 或对象存储 client 生命周期的
// provider 提供会话工厂。Endpoint 与 CredentialRef 是连接引用，凭据本身
// 由 provider 或 Kernel 的凭据存储解析，不进入共享请求。
type SessionProvider interface {
	Provider
	ValidateSessionRequest(SessionRequest) error
	OpenSession(context.Context, SessionRequest) (Session, error)
}

// HealthProvider 是不依赖查询字段的 provider 健康探针。
type HealthProvider interface {
	Provider
	Health(context.Context) (HealthStatus, error)
}

// OperationProvider 用于 Synology task、multipart 等异步操作状态。
type OperationProvider interface {
	Provider
	Operation(context.Context, OperationRef) (OperationStatus, error)
}

// CatalogProvider 是 Everything/EFU 这类索引或导入目录，不把它们伪装成
// 可写的文件系统资源。
type CatalogProvider interface {
	Provider
	SearchCatalog(context.Context, CatalogSearchRequest) (Page, error)
}

// Resource 描述一个 provider-owned 资源根，例如 S3 bucket、DSM share 或
// SMB tree connect。物理路径、对象 key 和 share path 都由 provider 解释。
type Resource interface {
	Ref() ResourceRef
	Descriptor() ResourceDescriptor
}

type ListResource interface {
	Resource
	List(context.Context, ListRequest) (DirectoryPage, error)
}

type StatResource interface {
	Resource
	Stat(context.Context, StatRequest) (Entry, error)
}

type OpenResource interface {
	Resource
	Open(context.Context, OpenRequest) (OpenResult, error)
}

type CreateResource interface {
	Resource
	Create(context.Context, CreateRequest) (MutationResult, error)
}

type UpdateResource interface {
	Resource
	Update(context.Context, UpdateRequest) (MutationResult, error)
}

type DeleteResource interface {
	Resource
	Delete(context.Context, DeleteRequest) (MutationResult, error)
}

type CopyResource interface {
	Resource
	Copy(context.Context, CopyRequest) (MutationResult, error)
}

type MoveResource interface {
	Resource
	Move(context.Context, MoveRequest) (MutationResult, error)
}

type WatchResource interface {
	Resource
	Watch(context.Context, WatchRequest) (ChangeStream, error)
}

// Session 表示一次连接生命周期。Resources 返回 provider 的资源根，而不是
// 把所有资源压平为本地绝对路径。
type Session interface {
	ID() SessionID
	Resources(context.Context, PageRequest) (ResourcePage, error)
	OpenResource(context.Context, ResourceRef) (Resource, error)
	Close() error
}
