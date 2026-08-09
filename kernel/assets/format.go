// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package assets

import (
	"path/filepath"
	"strings"
)

// PreviewKind 是 assets 领域公开的主要预览表面。
type PreviewKind string

const (
	PreviewKindDirectory PreviewKind = "directory"
	PreviewKindImage     PreviewKind = "image"
	PreviewKindAudio     PreviewKind = "audio"
	PreviewKindVideo     PreviewKind = "video"
	PreviewKindPDF       PreviewKind = "pdf"
	PreviewKindText      PreviewKind = "text"
	PreviewKindD5A       PreviewKind = "d5a"
	PreviewKindBinary    PreviewKind = "binary"
)

// ThumbnailProvider 是文件格式和缩略图 Provider 的稳定连接点。
type ThumbnailProvider string

const (
	ThumbnailProviderSVG    ThumbnailProvider = "svg"
	ThumbnailProviderRaster ThumbnailProvider = "raster"
	ThumbnailProviderD5M    ThumbnailProvider = "d5m"
	ThumbnailProviderSY     ThumbnailProvider = "sy"
	ThumbnailProviderSystem ThumbnailProvider = "system"
	ThumbnailProviderNone   ThumbnailProvider = "none"
)

// Format 是文件卡片、主预览和后端缩略图服务共同消费的格式描述。
type Format struct {
	Extension         string
	PreviewKind       PreviewKind
	ThumbnailProvider ThumbnailProvider
}

var imageExtensions = map[string]struct{}{
	".apng": {}, ".avif": {}, ".bmp": {}, ".cur": {}, ".gif": {}, ".heic": {},
	".heif": {}, ".ico": {}, ".jfif": {}, ".jpe": {}, ".jpeg": {}, ".jpg": {},
	".pjp": {}, ".pjpeg": {}, ".png": {}, ".svg": {}, ".tif": {}, ".tiff": {},
	".webp": {},
}

var audioExtensions = map[string]struct{}{
	".aac": {}, ".flac": {}, ".m4a": {}, ".mp3": {}, ".ogg": {}, ".opus": {}, ".wav": {},
}

var videoExtensions = map[string]struct{}{
	".3gp": {}, ".avi": {}, ".flv": {}, ".m4v": {}, ".mkv": {}, ".mov": {},
	".mp4": {}, ".webm": {}, ".weba": {}, ".wmv": {},
}

var textExtensions = map[string]struct{}{
	".adoc": {}, ".bat": {}, ".c": {}, ".cc": {}, ".cmd": {}, ".config": {}, ".cpp": {},
	".css": {}, ".csv": {}, ".editorconfig": {}, ".env": {}, ".go": {}, ".h": {},
	".hpp": {}, ".htm": {}, ".html": {}, ".ini": {}, ".java": {}, ".js": {},
	".jsx": {}, ".json": {}, ".kt": {}, ".log": {}, ".markdown": {}, ".md": {},
	".mjs": {}, ".opml": {}, ".org": {}, ".php": {}, ".properties": {}, ".py": {},
	".rb": {}, ".rs": {}, ".rst": {}, ".scss": {}, ".sh": {}, ".sql": {}, ".swift": {},
	".textile": {}, ".toml": {}, ".ts": {}, ".tsx": {}, ".txt": {}, ".vue": {},
	".wiki": {}, ".xml": {}, ".yaml": {}, ".yml": {},
}

// Extension 返回带点的小写扩展名。传入扩展名本身时也保持兼容。
func Extension(path string) string {
	value := strings.TrimSpace(path)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, ".") && !strings.ContainsAny(value, `/\\`) {
		return strings.ToLower(value)
	}
	return strings.ToLower(filepath.Ext(value))
}

func hasExtension(extensions map[string]struct{}, value string) bool {
	_, ok := extensions[Extension(value)]
	return ok
}

// IsImageExtension 判断卡片是否应使用真实图片缩略图。
func IsImageExtension(value string) bool {
	return hasExtension(imageExtensions, value)
}

// IsAudioExtension 判断是否使用音频播放表面。
func IsAudioExtension(value string) bool {
	return hasExtension(audioExtensions, value)
}

// IsVideoExtension 判断是否使用视频播放表面。
func IsVideoExtension(value string) bool {
	return hasExtension(videoExtensions, value)
}

// IsTextExtension 判断是否使用有界文本表面。
func IsTextExtension(value string) bool {
	return hasExtension(textExtensions, value)
}

// Classify 根据扩展名和检测到的 MIME 类型返回统一格式策略。
func Classify(path, mediaType string) Format {
	extension := Extension(path)
	baseType := strings.ToLower(strings.TrimSpace(strings.Split(mediaType, ";")[0]))
	format := Format{Extension: extension, PreviewKind: PreviewKindBinary, ThumbnailProvider: ThumbnailProviderSystem}
	switch {
	case extension == ".pdf" || baseType == "application/pdf":
		format.PreviewKind = PreviewKindPDF
	case IsImageExtension(extension) || strings.HasPrefix(baseType, "image/"):
		format.PreviewKind = PreviewKindImage
	case IsAudioExtension(extension) || strings.HasPrefix(baseType, "audio/"):
		format.PreviewKind = PreviewKindAudio
	case IsVideoExtension(extension) || strings.HasPrefix(baseType, "video/"):
		format.PreviewKind = PreviewKindVideo
	case extension == ".d5a" || extension == ".d5mesh":
		format.PreviewKind = PreviewKindD5A
	case strings.HasPrefix(baseType, "text/") || IsTextExtension(extension):
		format.PreviewKind = PreviewKindText
	}

	switch extension {
	case ".svg":
		format.ThumbnailProvider = ThumbnailProviderSVG
	case ".d5m":
		format.ThumbnailProvider = ThumbnailProviderD5M
	case ".sy":
		format.ThumbnailProvider = ThumbnailProviderSY
	case ".apng", ".avif", ".bmp", ".cur", ".gif", ".heic", ".heif", ".ico", ".jfif", ".jpe", ".jpeg", ".jpg", ".pjp", ".pjpeg", ".png", ".tif", ".tiff", ".webp":
		format.ThumbnailProvider = ThumbnailProviderRaster
	case ".txt", ".md", ".markdown", ".json", ".log", ".sql", ".html", ".xml", ".go", ".py", ".js", ".css", ".ts", ".vue":
		format.ThumbnailProvider = ThumbnailProviderNone
	}
	return format
}
