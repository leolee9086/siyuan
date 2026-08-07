package fswalk

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

const defaultTextReadLimit = int64(2 * 1024 * 1024)

type newlineStyle uint8

const (
	newlineLF newlineStyle = iota
	newlineCRLF
	newlineCR
)

type textFile struct {
	relative string
	original []byte
	text     string
	bom      bool
	newline  newlineStyle
	updated  int64
}

// TextDocument 是传给纯文本变换函数的不可执行 I/O 快照。
type TextDocument struct {
	Path    string
	Text    string
	Size    int64
	Updated int64
}

// ReadTextFile 在绑定根内读取一个受限 UTF-8 文本快照。
func (w *Walker) ReadTextFile(ctx context.Context, relative string, maxBytes int64) (TextDocument, error) {
	target, err := w.resolveTarget(relative)
	if err != nil {
		return TextDocument{}, err
	}
	if !target.info.Mode().IsRegular() {
		return TextDocument{}, ErrNotRegularFile
	}
	document, err := w.readText(ctx, target.relative, target.absolute, maxBytes)
	if err != nil {
		return TextDocument{}, err
	}
	return document.document(), nil
}

// WriteTextFile 在绑定根内验证并原子写入 UTF-8 文本。
func (w *Walker) WriteTextFile(ctx context.Context, relative, text string, maxBytes int64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.IndexByte(text, 0) >= 0 {
		return ErrBinaryText
	}
	if !utf8.ValidString(text) {
		return ErrInvalidUTF8
	}
	content := []byte(text)
	if maxBytes > 0 && int64(len(content)) > maxBytes {
		return ErrTextFileTooLarge
	}
	absolute, _, err := w.boundPath(ctx, relative, true)
	if err != nil {
		return err
	}
	if _, err = w.ensureBoundDirectory(ctx, filepath.Dir(absolute), 0755); err != nil {
		return err
	}
	return w.writeAtomic(ctx, absolute, content, 0644)
}

func (w *Walker) readText(ctx context.Context, relative, absolute string, maxBytes int64) (textFile, error) {
	if maxBytes <= 0 {
		maxBytes = defaultTextReadLimit
	}
	file, info, err := w.openBoundRegular(ctx, absolute)
	if err != nil {
		return textFile{}, err
	}
	defer file.Close()
	if info.Size() > maxBytes {
		return textFile{}, ErrTextFileTooLarge
	}
	raw, err := readContextBounded(ctx, file, info.Size(), maxBytes)
	if err != nil {
		return textFile{}, err
	}
	if bytes.IndexByte(raw, 0) >= 0 {
		return textFile{}, ErrBinaryText
	}
	bom := len(raw) >= 3 && bytes.Equal(raw[:3], []byte{0xef, 0xbb, 0xbf})
	content := raw
	if bom {
		content = content[3:]
	}
	if !utf8.Valid(content) {
		return textFile{}, ErrInvalidUTF8
	}
	return textFile{
		relative: relative, original: raw,
		text: normalizeNewlines(string(content)), bom: bom,
		newline: detectNewlineStyle(content), updated: info.ModTime().UnixNano(),
	}, nil
}

func (f textFile) document() TextDocument {
	return TextDocument{Path: f.relative, Text: f.text, Size: int64(len(f.original)), Updated: f.updated}
}

func (f textFile) encode(text string) []byte {
	text = normalizeNewlines(text)
	switch f.newline {
	case newlineCRLF:
		text = strings.ReplaceAll(text, "\n", "\r\n")
	case newlineCR:
		text = strings.ReplaceAll(text, "\n", "\r")
	}
	encoded := []byte(text)
	if !f.bom {
		return encoded
	}
	result := make([]byte, 3, len(encoded)+3)
	copy(result, []byte{0xef, 0xbb, 0xbf})
	return append(result, encoded...)
}

func normalizeNewlines(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	return strings.ReplaceAll(value, "\r", "\n")
}

func detectNewlineStyle(value []byte) newlineStyle {
	crlf := bytes.Count(value, []byte("\r\n"))
	withoutCRLF := bytes.ReplaceAll(value, []byte("\r\n"), nil)
	lf := bytes.Count(withoutCRLF, []byte("\n"))
	cr := bytes.Count(withoutCRLF, []byte("\r"))
	if crlf >= lf && crlf >= cr && crlf > 0 {
		return newlineCRLF
	}
	if cr > lf && cr > 0 {
		return newlineCR
	}
	return newlineLF
}
