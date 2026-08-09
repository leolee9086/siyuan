package filebrowser

import (
	"encoding/binary"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/siyuan-note/siyuan/kernel/assets"
)

const (
	defaultPreviewBytes = 64 * 1024
	maxPreviewBytes     = 1024 * 1024
)

type resolvedFile struct {
	root     Root
	absolute string
	relative string
	info     os.FileInfo
}

func (s *Service) resolveFile(request FileRequest) (resolvedFile, error) {
	root, absolute, relative, info, err := s.ValidateFilePath(request.RootID, request.Path)
	if err != nil {
		return resolvedFile{}, err
	}
	return resolvedFile{root: root, absolute: absolute, relative: relative, info: info}, nil
}

func contentURL(rootID, relative string) string {
	segments := strings.Split(relative, "/")
	for index := range segments {
		segments[index] = url.PathEscape(segments[index])
	}
	return "/api/s-forge/file-browser/content/" + url.PathEscape(rootID) + "/" + strings.Join(segments, "/")
}

func detectMediaType(path string) string {
	extensionType := mime.TypeByExtension(strings.ToLower(filepath.Ext(path)))
	if extensionType != "" {
		return extensionType
	}
	file, err := os.Open(path)
	if err != nil {
		return "application/octet-stream"
	}
	defer file.Close()
	buffer := make([]byte, 512)
	count, _ := file.Read(buffer)
	return http.DetectContentType(buffer[:count])
}

func classifyPreview(mediaType, extension string) PreviewKind {
	return assets.Classify(extension, mediaType).PreviewKind
}

func statFromResolved(file resolvedFile) StatResult {
	extension := strings.ToLower(filepath.Ext(file.relative))
	mediaType := detectMediaType(file.absolute)
	entry := Entry{
		Name: filepath.Base(file.relative), Path: file.relative, Size: file.info.Size(),
		Updated: file.info.ModTime().Unix(), Extension: extension,
		Hidden: strings.HasPrefix(filepath.Base(file.relative), "."),
	}
	return StatResult{
		Root: file.root, Entry: entry, MediaType: mediaType,
		PreviewKind: classifyPreview(mediaType, extension),
		ContentURL:  contentURL(file.root.ID, file.relative),
		Revision:    fmt.Sprintf("%x-%x", file.info.ModTime().UnixNano(), file.info.Size()),
	}
}

// Stat validates and describes one regular file.
func (s *Service) Stat(request FileRequest) (StatResult, error) {
	file, err := s.resolveFile(request)
	if err != nil {
		return StatResult{}, err
	}
	return statFromResolved(file), nil
}

// Open returns a validated file handle and metadata for HTTP streaming.
func (s *Service) Open(request FileRequest) (*os.File, StatResult, error) {
	resolved, err := s.resolveFile(request)
	if err != nil {
		return nil, StatResult{}, err
	}
	file, err := os.Open(resolved.absolute)
	if err != nil {
		return nil, StatResult{}, err
	}
	return file, statFromResolved(resolved), nil
}

func previewLimit(requested int) int {
	if requested <= 0 {
		return defaultPreviewBytes
	}
	if requested > maxPreviewBytes {
		return maxPreviewBytes
	}
	return requested
}

func decodeUTF16(raw []byte, order binary.ByteOrder) string {
	units := make([]uint16, 0, len(raw)/2)
	for index := 0; index+1 < len(raw); index += 2 {
		units = append(units, order.Uint16(raw[index:index+2]))
	}
	return string(utf16.Decode(units))
}

func decodeTextPreview(raw []byte) (string, string, error) {
	switch {
	case len(raw) >= 3 && string(raw[:3]) == "\xef\xbb\xbf":
		return strings.ToValidUTF8(string(raw[3:]), "\uFFFD"), "utf-8-bom", nil
	case len(raw) >= 2 && raw[0] == 0xff && raw[1] == 0xfe:
		return decodeUTF16(raw[2:], binary.LittleEndian), "utf-16le", nil
	case len(raw) >= 2 && raw[0] == 0xfe && raw[1] == 0xff:
		return decodeUTF16(raw[2:], binary.BigEndian), "utf-16be", nil
	case utf8.Valid(raw):
		return string(raw), "utf-8", nil
	case strings.IndexByte(string(raw), 0) >= 0:
		return "", "", ErrPreviewUnsupported
	default:
		return strings.ToValidUTF8(string(raw), "\uFFFD"), "unknown", nil
	}
}

// Preview reads a bounded text prefix without loading the complete file.
func (s *Service) Preview(request PreviewRequest) (PreviewResult, error) {
	resolved, err := s.resolveFile(FileRequest{RootID: request.RootID, Path: request.Path})
	if err != nil {
		return PreviewResult{}, err
	}
	stat := statFromResolved(resolved)
	if stat.PreviewKind != PreviewKindText {
		return PreviewResult{}, ErrPreviewUnsupported
	}
	file, err := os.Open(resolved.absolute)
	if err != nil {
		return PreviewResult{}, err
	}
	defer file.Close()
	limit := previewLimit(request.MaxBytes)
	raw, err := io.ReadAll(io.LimitReader(file, int64(limit+1)))
	if err != nil {
		return PreviewResult{}, err
	}
	truncated := len(raw) > limit
	if truncated {
		raw = raw[:limit]
	}
	text, encoding, err := decodeTextPreview(raw)
	if err != nil {
		return PreviewResult{}, err
	}
	return PreviewResult{Stat: stat, Text: text, Encoding: encoding, Truncated: truncated}, nil
}
