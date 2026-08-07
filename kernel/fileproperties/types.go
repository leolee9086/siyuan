package fileproperties

import (
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
)

// InspectItem 把授权物理属性和工作空间元数据组合为一个 Dock 记录。
type InspectItem struct {
	Request           filebrowser.FileRequest      `json:"request"`
	Properties        *filebrowser.ItemProperties  `json:"properties,omitempty"`
	Metadata          *assetmeta.AssetMeta         `json:"metadata,omitempty"`
	MetadataPersisted bool                         `json:"metadataPersisted"`
	MetadataWritable  bool                         `json:"metadataWritable"`
	Error             *filebrowser.PropertyFailure `json:"error,omitempty"`
	MetadataError     *filebrowser.PropertyFailure `json:"metadataError,omitempty"`
}

// InspectResult 保持文件浏览批量顺序，并单独统计物理与元数据失败。
type InspectResult struct {
	Items                []InspectItem `json:"items"`
	SuccessCount         int           `json:"successCount"`
	FailureCount         int           `json:"failureCount"`
	MetadataFailureCount int           `json:"metadataFailureCount"`
}

// MetadataPatch 只包含属性 Dock 可以修改的私有元数据字段。
type MetadataPatch struct {
	Tags         *[]string `json:"tags,omitempty"`
	Star         *int      `json:"star,omitempty"`
	Annotation   *string   `json:"annotation,omitempty"`
	BoundBlockID *string   `json:"boundBlockID,omitempty"`
	Source       *string   `json:"source,omitempty"`
	SourceID     *string   `json:"sourceID,omitempty"`
}

// UpdateItem 使用文件 revision 作为可选的乐观并发前置条件。
type UpdateItem struct {
	Request  filebrowser.FileRequest `json:"request"`
	Revision string                  `json:"revision,omitempty"`
	Patch    MetadataPatch           `json:"patch"`
}

// BatchUpdateRequest 是有界的元数据修改请求。
type BatchUpdateRequest struct {
	Items []UpdateItem `json:"items"`
}

// UpdateItemResult 保持每一项的更新结果和稳定错误。
type UpdateItemResult struct {
	Request    filebrowser.FileRequest      `json:"request"`
	Properties *filebrowser.ItemProperties  `json:"properties,omitempty"`
	Metadata   *assetmeta.AssetMeta         `json:"metadata,omitempty"`
	Error      *filebrowser.PropertyFailure `json:"error,omitempty"`
}

// BatchUpdateResult 汇总一次部分成功的元数据更新。
type BatchUpdateResult struct {
	Items        []UpdateItemResult `json:"items"`
	SuccessCount int                `json:"successCount"`
	FailureCount int                `json:"failureCount"`
}
