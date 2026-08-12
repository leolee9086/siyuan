package externalprovidercontract

import (
	"encoding/json"
	"io"
	"time"
)

type SessionRequest struct {
	Endpoint              string          `json:"endpoint"`
	CredentialRef         string          `json:"credentialRef,omitempty"`
	Options               json.RawMessage `json:"options,omitempty"`
	ReadOnly              bool            `json:"readOnly,omitempty"`
	InsecureHTTPConfirmed bool            `json:"insecureHTTPConfirmed,omitempty"`
}

// ResourceRef 是 provider 内部地址，不是本地文件路径。
// Path 对 MinIO 表示 object key，对 DSM/SMB 表示 share 内相对路径。
type ResourceRef struct {
	Provider ProviderID `json:"provider"`
	Session  SessionID  `json:"session"`
	Resource ResourceID `json:"resource"`
	Path     string     `json:"path,omitempty"`
}

type ResourceDescriptor struct {
	ID           ResourceID       `json:"id"`
	Name         string           `json:"name"`
	Kind         string           `json:"kind"`
	ReadOnly     bool             `json:"readOnly"`
	Capabilities []string         `json:"capabilities"`
	Source       SourceDescriptor `json:"source"`
	Aliases      []ResourceAlias  `json:"aliases,omitempty"`
	// Ref is the provider-owned address required by OpenResource. Keeping it
	// in the descriptor prevents callers from reconstructing a resource path
	// from display names or endpoint strings.
	Ref ResourceRef `json:"ref"`
}

// PublicResourceDescriptor 是浏览器可见的 provider 资源根。
// Source 只承载当前 session 内的展示信息，不提供跨 provider 设备身份。
type PublicResourceDescriptor struct {
	Provider     ProviderID       `json:"provider"`
	Session      SessionID        `json:"session"`
	ID           ResourceID       `json:"id"`
	Name         string           `json:"name"`
	Kind         string           `json:"kind"`
	ReadOnly     bool             `json:"readOnly"`
	Capabilities []string         `json:"capabilities"`
	Source       SourceDescriptor `json:"source"`
	Aliases      []ResourceAlias  `json:"aliases,omitempty"`
}

// ResourceAlias is a session-local display locator such as a mapped drive.
// It is never accepted as an operation address; Ref remains authoritative.
type ResourceAlias struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
}

type ResourcePage struct {
	Resources  []ResourceDescriptor `json:"resources"`
	Total      *int                 `json:"total,omitempty"`
	Limit      int                  `json:"limit"`
	NextCursor string               `json:"nextCursor,omitempty"`
	HasMore    bool                 `json:"hasMore"`
}

type PublicResourcePage struct {
	Resources  []PublicResourceDescriptor `json:"resources"`
	Total      *int                       `json:"total,omitempty"`
	Limit      int                        `json:"limit"`
	NextCursor string                     `json:"nextCursor,omitempty"`
	HasMore    bool                       `json:"hasMore"`
}

// PageRequest 的 Cursor 原样交给 provider。Kernel 不解析、重编码或拼接
// MinIO continuation token、Synology offset 状态和 SMB directory handle。
type PageRequest struct {
	Cursor string `json:"cursor,omitempty"`
	Limit  int    `json:"limit"`
}

type SortTerm struct {
	Field string `json:"field"`
	Desc  bool   `json:"desc,omitempty"`
}

type ListRequest struct {
	Parent           ResourceRef `json:"parent"`
	Page             PageRequest `json:"page"`
	Recursive        bool        `json:"recursive,omitempty"`
	Sort             []SortTerm  `json:"sort,omitempty"`
	IncludeMetadata  bool        `json:"includeMetadata,omitempty"`
	DirectoriesFirst bool        `json:"directoriesFirst,omitempty"`
}

type StatRequest struct {
	Target          ResourceRef   `json:"target"`
	IncludeMetadata bool          `json:"includeMetadata,omitempty"`
	Preconditions   Preconditions `json:"preconditions,omitempty"`
}

type EntryKind string

const (
	EntryKindFile      EntryKind = "file"
	EntryKindDirectory EntryKind = "directory"
	EntryKindObject    EntryKind = "object"
	EntryKindBucket    EntryKind = "bucket"
)

type Revision struct {
	ETag       string    `json:"etag,omitempty"`
	VersionID  string    `json:"versionID,omitempty"`
	ModifiedAt time.Time `json:"modifiedAt,omitempty"`
	Size       int64     `json:"size,omitempty"`
}

type Entry struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Path      string            `json:"path"`
	Ref       ResourceRef       `json:"ref"`
	Address   *AssetAddress     `json:"address,omitempty"`
	Kind      EntryKind         `json:"kind"`
	IsDir     bool              `json:"isDir"`
	Size      int64             `json:"size"`
	Modified  int64             `json:"modified"`
	Created   int64             `json:"created"`
	Extension string            `json:"extension,omitempty"`
	MediaType string            `json:"mediaType,omitempty"`
	Revision  Revision          `json:"revision,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type DirectoryPage struct {
	Entries    []Entry     `json:"entries"`
	Total      int         `json:"total,omitempty"`
	TotalKnown bool        `json:"totalKnown"`
	Limit      int         `json:"limit"`
	NextCursor string      `json:"nextCursor,omitempty"`
	HasMore    bool        `json:"hasMore"`
	Parent     ResourceRef `json:"parent"`
}

type ByteRange struct {
	Start int64 `json:"start"`
	End   int64 `json:"end,omitempty"`
}

type Preconditions struct {
	IfMatch     string `json:"ifMatch,omitempty"`
	IfNoneMatch string `json:"ifNoneMatch,omitempty"`
	VersionID   string `json:"versionID,omitempty"`
}

type OpenRequest struct {
	Target        ResourceRef   `json:"target"`
	Range         *ByteRange    `json:"range,omitempty"`
	Preconditions Preconditions `json:"preconditions,omitempty"`
}

type OpenResult struct {
	Entry     Entry         `json:"entry"`
	Reader    io.ReadCloser `json:"-"`
	Size      int64         `json:"size"`
	MediaType string        `json:"mediaType,omitempty"`
	Revision  Revision      `json:"revision"`
}

type CreateRequest struct {
	Parent        ResourceRef       `json:"parent"`
	Name          string            `json:"name"`
	Kind          EntryKind         `json:"kind"`
	Content       io.Reader         `json:"-"`
	Size          int64             `json:"size"`
	MediaType     string            `json:"mediaType,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	Preconditions Preconditions     `json:"preconditions,omitempty"`
}

type UpdateRequest struct {
	Target        ResourceRef       `json:"target"`
	NewName       string            `json:"newName,omitempty"`
	Content       io.Reader         `json:"-"`
	Size          int64             `json:"size"`
	MediaType     string            `json:"mediaType,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	Preconditions Preconditions     `json:"preconditions,omitempty"`
}

type DeleteRequest struct {
	Targets       []ResourceRef `json:"targets"`
	Recursive     bool          `json:"recursive,omitempty"`
	Preconditions Preconditions `json:"preconditions,omitempty"`
}

type CopyRequest struct {
	Source        ResourceRef   `json:"source"`
	Destination   ResourceRef   `json:"destination"`
	Overwrite     bool          `json:"overwrite,omitempty"`
	Preconditions Preconditions `json:"preconditions,omitempty"`
}

type MoveRequest struct {
	Source        ResourceRef   `json:"source"`
	Destination   ResourceRef   `json:"destination"`
	Overwrite     bool          `json:"overwrite,omitempty"`
	Preconditions Preconditions `json:"preconditions,omitempty"`
}

type OperationRef struct {
	ID string `json:"id"`
}

type OperationState string

const (
	OperationPending   OperationState = "pending"
	OperationRunning   OperationState = "running"
	OperationCompleted OperationState = "completed"
	OperationFailed    OperationState = "failed"
)

type OperationStatus struct {
	Ref      OperationRef      `json:"ref"`
	State    OperationState    `json:"state"`
	Progress int               `json:"progress,omitempty"`
	Message  string            `json:"message,omitempty"`
	Failures []MutationFailure `json:"failures,omitempty"`
}

type MutationFailure struct {
	Target  ResourceRef `json:"target"`
	Code    string      `json:"code"`
	Message string      `json:"message"`
}

type MutationResult struct {
	Operation    string            `json:"operation"`
	Source       string            `json:"source,omitempty"`
	Target       string            `json:"target,omitempty"`
	Count        int               `json:"count,omitempty"`
	Entries      []Entry           `json:"entries,omitempty"`
	OperationRef *OperationRef     `json:"operationRef,omitempty"`
	Failures     []MutationFailure `json:"failures,omitempty"`
	Revision     Revision          `json:"revision,omitempty"`
}

type ChangeKind string

const (
	ChangeCreated ChangeKind = "created"
	ChangeUpdated ChangeKind = "updated"
	ChangeDeleted ChangeKind = "deleted"
	ChangeMoved   ChangeKind = "moved"
)

type WatchRequest struct {
	Root       ResourceRef `json:"root"`
	Recursive  bool        `json:"recursive,omitempty"`
	ResumeFrom string      `json:"resumeFrom,omitempty"`
}

type Change struct {
	Kind     ChangeKind  `json:"kind"`
	Target   ResourceRef `json:"target"`
	Previous ResourceRef `json:"previous,omitempty"`
	Revision Revision    `json:"revision,omitempty"`
	Cursor   string      `json:"cursor,omitempty"`
}

type ChangeStream interface {
	Events() <-chan Change
	Close() error
}

type HealthStatus struct {
	Available bool   `json:"available"`
	Message   string `json:"message,omitempty"`
	LatencyMS int64  `json:"latencyMS,omitempty"`
}

type CatalogSearchRequest struct {
	Query  string      `json:"query"`
	Prefix string      `json:"prefix,omitempty"`
	Page   PageRequest `json:"page"`
	Sort   []SortTerm  `json:"sort,omitempty"`
}
