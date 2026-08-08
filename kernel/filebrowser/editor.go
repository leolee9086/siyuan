package filebrowser

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

var (
	ErrEditorEncoding       = errors.New("file browser editor encoding is invalid")
	ErrEditorBinary         = errors.New("file browser editor does not accept binary data")
	ErrEditorTooLarge       = errors.New("file browser editor document exceeds the configured size limit")
	ErrEditorRevisionNeeded = errors.New("file browser editor revision is required")
	ErrEditorConflict       = errors.New("file browser editor document changed externally")
)

// EditorReadRequest addresses one authorized text file using root-relative data.
type EditorReadRequest struct {
	RootID   string `json:"rootID"`
	Path     string `json:"path"`
	MaxBytes int    `json:"maxBytes,omitempty"`
}

// EditorWriteRequest carries the complete modified text and the byte revision
// observed by the client. Text is deliberately the only content field exposed
// by this domain boundary; absolute paths and file handles stay in fswalk.
type EditorWriteRequest struct {
	RootID           string              `json:"rootID"`
	Path             string              `json:"path"`
	Text             string              `json:"text"`
	Encoding         fswalk.TextEncoding `json:"encoding"`
	ExpectedRevision string              `json:"revision"`
	MaxBytes         int                 `json:"maxBytes,omitempty"`
}

// EditorDocument is the bounded snapshot consumed by a local editor tab.
type EditorDocument struct {
	Root        Root        `json:"root"`
	Entry       Entry       `json:"entry"`
	PreviewKind PreviewKind `json:"previewKind"`
	ContentURL  string      `json:"contentURL"`
	Text        string      `json:"text"`
	Encoding    string      `json:"encoding"`
	Size        int64       `json:"size"`
	Updated     int64       `json:"updated"`
	Revision    string      `json:"revision"`
	ReadOnly    bool        `json:"readOnly"`
	Language    string      `json:"language"`
}

// EditorWriteResult reports the new revision and metadata after an atomic save.
// It does not echo the complete text because the caller already owns it.
type EditorWriteResult struct {
	Root        Root        `json:"root"`
	Entry       Entry       `json:"entry"`
	PreviewKind PreviewKind `json:"previewKind"`
	ContentURL  string      `json:"contentURL"`
	Encoding    string      `json:"encoding"`
	Size        int64       `json:"size"`
	Updated     int64       `json:"updated"`
	Revision    string      `json:"revision"`
	ReadOnly    bool        `json:"readOnly"`
	Language    string      `json:"language"`
}

func editorTextLimit(maxBytes int) int64 {
	if maxBytes <= 0 {
		return fswalk.DefaultEditorTextReadLimit
	}
	if int64(maxBytes) > fswalk.MaxEditorTextReadLimit {
		return fswalk.MaxEditorTextReadLimit
	}
	return int64(maxBytes)
}

func editorLanguage(relative string) string {
	extension := strings.ToLower(filepath.Ext(relative))
	if language, ok := map[string]string{
		".c": "c", ".cc": "cpp", ".cpp": "cpp", ".h": "cpp", ".hpp": "cpp",
		".css": "css", ".csv": "plaintext", ".go": "go", ".html": "html",
		".ini": "ini", ".java": "java", ".js": "javascript", ".jsx": "javascript",
		".json": "json", ".log": "plaintext", ".md": "markdown", ".mjs": "javascript",
		".py": "python", ".rs": "rust", ".scss": "scss", ".sh": "shell",
		".sql": "sql", ".ts": "typescript", ".tsx": "typescript", ".toml": "ini",
		".txt": "plaintext", ".vue": "vue", ".xml": "xml", ".yaml": "yaml", ".yml": "yaml",
	}[extension]; ok {
		return language
	}
	if extension == "" {
		return "plaintext"
	}
	return strings.TrimPrefix(extension, ".")
}

func adaptEditorError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, fswalk.ErrInvalidUTF8), errors.Is(err, fswalk.ErrInvalidUTF16),
		errors.Is(err, fswalk.ErrUnsupportedTextEncoding):
		return ErrEditorEncoding
	case errors.Is(err, fswalk.ErrBinaryText):
		return ErrEditorBinary
	case errors.Is(err, fswalk.ErrTextFileTooLarge):
		return ErrEditorTooLarge
	case errors.Is(err, fswalk.ErrRevisionRequired):
		return ErrEditorRevisionNeeded
	case errors.Is(err, fswalk.ErrFileChanged):
		return ErrEditorConflict
	case errors.Is(err, fswalk.ErrNotRegularFile):
		return ErrNotFile
	default:
		return operationError(err)
	}
}

func editorEntry(relative string, size, updated int64) Entry {
	name := filepath.Base(filepath.FromSlash(relative))
	extension := strings.ToLower(filepath.Ext(name))
	return Entry{
		Name: name, Path: relative, IsDir: false,
		Size: size, Updated: updated, Extension: extension,
		Hidden: strings.HasPrefix(name, "."),
	}
}

func (s *Service) editorDocument(root Root, relative string, snapshot fswalk.EncodedTextDocument) EditorDocument {
	return EditorDocument{
		Root: root, Entry: editorEntry(relative, snapshot.Size, snapshot.Updated),
		PreviewKind: PreviewKindText, ContentURL: contentURL(root.ID, relative),
		Text: snapshot.Text, Encoding: string(snapshot.Encoding), Size: snapshot.Size,
		Updated: snapshot.Updated, Revision: snapshot.Revision,
		ReadOnly: !root.CapabilitiesForPath(relative).Write, Language: editorLanguage(relative),
	}
}

func (s *Service) editorRoot(rootID, relative string, write bool) (Root, *fswalk.Walker, string, error) {
	root, walker, normalized, err := s.operationRoot(rootID, relative, write)
	if err != nil {
		return Root{}, nil, "", adaptEditorError(err)
	}
	return root, walker, normalized, nil
}

// ReadEditorFile reads a bounded text snapshot through the shared filesystem boundary.
func (s *Service) ReadEditorFile(ctx context.Context, request EditorReadRequest) (EditorDocument, error) {
	root, walker, relative, err := s.editorRoot(request.RootID, request.Path, false)
	if err != nil {
		return EditorDocument{}, err
	}
	snapshot, err := walker.ReadTextFileWithEncoding(ctx, relative, editorTextLimit(request.MaxBytes))
	if err != nil {
		return EditorDocument{}, adaptEditorError(err)
	}
	return s.editorDocument(root, relative, snapshot), nil
}

// WriteEditorFile verifies the revision and atomically saves a text snapshot.
func (s *Service) WriteEditorFile(ctx context.Context, request EditorWriteRequest) (EditorWriteResult, error) {
	root, walker, relative, err := s.editorRoot(request.RootID, request.Path, true)
	if err != nil {
		return EditorWriteResult{}, err
	}
	newRevision, err := walker.WriteTextFileWithEncoding(ctx, relative, request.Text, request.Encoding,
		request.ExpectedRevision, editorTextLimit(request.MaxBytes))
	if err != nil {
		return EditorWriteResult{}, adaptEditorError(err)
	}
	snapshot, err := walker.ReadTextFileWithEncoding(ctx, relative, editorTextLimit(request.MaxBytes))
	if err != nil {
		return EditorWriteResult{}, adaptEditorError(err)
	}
	if snapshot.Revision != newRevision {
		return EditorWriteResult{}, ErrEditorConflict
	}
	document := s.editorDocument(root, relative, snapshot)
	return EditorWriteResult{
		Root: document.Root, Entry: document.Entry, PreviewKind: document.PreviewKind,
		ContentURL: document.ContentURL, Encoding: document.Encoding, Size: document.Size,
		Updated: document.Updated, Revision: document.Revision, ReadOnly: document.ReadOnly,
		Language: document.Language,
	}, nil
}
