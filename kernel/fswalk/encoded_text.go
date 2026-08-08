package fswalk

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// TextEncoding is the byte encoding preserved by an editor document.
type TextEncoding string

const (
	TextEncodingUTF8    TextEncoding = "utf-8"
	TextEncodingUTF8BOM TextEncoding = "utf-8-bom"
	TextEncodingUTF16LE TextEncoding = "utf-16le"
	TextEncodingUTF16BE TextEncoding = "utf-16be"
)

const (
	DefaultEditorTextReadLimit int64 = 8 * 1024 * 1024
	MaxEditorTextReadLimit     int64 = 32 * 1024 * 1024
)

var (
	ErrUnsupportedTextEncoding = errors.New("text encoding is not supported")
	ErrInvalidUTF16            = errors.New("text is not valid UTF-16")
	ErrRevisionRequired        = errors.New("text file revision is required")
)

// EncodedTextDocument is a bounded text snapshot. Revision hashes the exact
// bytes read from disk so a save can reject an external modification.
type EncodedTextDocument struct {
	Path     string
	Text     string
	Encoding TextEncoding
	Size     int64
	Updated  int64
	Revision string
}

func editorTextLimit(maxBytes int64) int64 {
	if maxBytes <= 0 {
		return DefaultEditorTextReadLimit
	}
	if maxBytes > MaxEditorTextReadLimit {
		return MaxEditorTextReadLimit
	}
	return maxBytes
}

func encodedTextRevision(raw []byte) string {
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func decodeEncodedText(raw []byte) (string, TextEncoding, error) {
	switch {
	case len(raw) >= 3 && bytes.Equal(raw[:3], []byte{0xef, 0xbb, 0xbf}):
		content := raw[3:]
		if bytes.IndexByte(content, 0) >= 0 {
			return "", "", ErrBinaryText
		}
		if !utf8.Valid(content) {
			return "", "", ErrInvalidUTF8
		}
		return string(content), TextEncodingUTF8BOM, nil
	case len(raw) >= 2 && raw[0] == 0xff && raw[1] == 0xfe:
		return decodeUTF16Text(raw[2:], binary.LittleEndian, TextEncodingUTF16LE)
	case len(raw) >= 2 && raw[0] == 0xfe && raw[1] == 0xff:
		return decodeUTF16Text(raw[2:], binary.BigEndian, TextEncodingUTF16BE)
	case bytes.IndexByte(raw, 0) >= 0:
		return "", "", ErrBinaryText
	case utf8.Valid(raw):
		return string(raw), TextEncodingUTF8, nil
	default:
		return "", "", ErrInvalidUTF8
	}
}

func decodeUTF16Text(raw []byte, order binary.ByteOrder, encoding TextEncoding) (string, TextEncoding, error) {
	if len(raw)%2 != 0 {
		return "", "", ErrInvalidUTF16
	}
	units := make([]uint16, 0, len(raw)/2)
	for index := 0; index < len(raw); index += 2 {
		units = append(units, order.Uint16(raw[index:index+2]))
	}
	for index := 0; index < len(units); index++ {
		unit := units[index]
		if unit >= 0xd800 && unit <= 0xdbff {
			if index+1 >= len(units) || units[index+1] < 0xdc00 || units[index+1] > 0xdfff {
				return "", "", ErrInvalidUTF16
			}
			index++
			continue
		}
		if unit >= 0xdc00 && unit <= 0xdfff {
			return "", "", ErrInvalidUTF16
		}
	}
	text := string(utf16.Decode(units))
	if strings.IndexByte(text, 0) >= 0 {
		return "", "", ErrBinaryText
	}
	return text, encoding, nil
}

func encodeText(text string, encoding TextEncoding) ([]byte, error) {
	if !utf8.ValidString(text) {
		return nil, ErrInvalidUTF8
	}
	if strings.IndexByte(text, 0) >= 0 {
		return nil, ErrBinaryText
	}
	switch encoding {
	case TextEncodingUTF8:
		return []byte(text), nil
	case TextEncodingUTF8BOM:
		return append([]byte{0xef, 0xbb, 0xbf}, []byte(text)...), nil
	case TextEncodingUTF16LE, TextEncodingUTF16BE:
		units := utf16.Encode([]rune(text))
		result := make([]byte, 2+len(units)*2)
		if encoding == TextEncodingUTF16LE {
			result[0], result[1] = 0xff, 0xfe
			for index, unit := range units {
				binary.LittleEndian.PutUint16(result[2+index*2:], unit)
			}
			return result, nil
		}
		result[0], result[1] = 0xfe, 0xff
		for index, unit := range units {
			binary.BigEndian.PutUint16(result[2+index*2:], unit)
		}
		return result, nil
	default:
		return nil, ErrUnsupportedTextEncoding
	}
}

func (w *Walker) readEncodedText(ctx context.Context, target boundTarget, maxBytes int64) (EncodedTextDocument, []byte, error) {
	limit := editorTextLimit(maxBytes)
	if target.info.Size() > limit {
		return EncodedTextDocument{}, nil, ErrTextFileTooLarge
	}
	file, info, err := w.openBoundRegular(ctx, target.absolute)
	if err != nil {
		return EncodedTextDocument{}, nil, err
	}
	defer file.Close()
	raw, err := readContextBounded(ctx, file, info.Size(), limit)
	if err != nil {
		return EncodedTextDocument{}, nil, err
	}
	text, encoding, err := decodeEncodedText(raw)
	if err != nil {
		return EncodedTextDocument{}, nil, err
	}
	return EncodedTextDocument{
		Path: target.relative, Text: text, Encoding: encoding,
		Size: int64(len(raw)), Updated: info.ModTime().UnixNano(), Revision: encodedTextRevision(raw),
	}, raw, nil
}

// ReadTextFileWithEncoding reads an existing regular text file without
// exposing its absolute path or an open handle to the caller.
func (w *Walker) ReadTextFileWithEncoding(ctx context.Context, relative string, maxBytes int64) (EncodedTextDocument, error) {
	if err := ctx.Err(); err != nil {
		return EncodedTextDocument{}, err
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return EncodedTextDocument{}, err
	}
	if !target.info.Mode().IsRegular() {
		return EncodedTextDocument{}, ErrNotRegularFile
	}
	document, _, err := w.readEncodedText(ctx, target, maxBytes)
	return document, err
}

// WriteTextFileWithEncoding verifies the byte revision and atomically writes
// a text document while preserving the existing regular-file permission bits.
func (w *Walker) WriteTextFileWithEncoding(ctx context.Context, relative, text string,
	encoding TextEncoding, expectedRevision string, maxBytes int64) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if expectedRevision == "" {
		return "", ErrRevisionRequired
	}
	encoded, err := encodeText(text, encoding)
	if err != nil {
		return "", err
	}
	limit := editorTextLimit(maxBytes)
	if int64(len(encoded)) > limit {
		return "", ErrTextFileTooLarge
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return "", err
	}
	if !target.info.Mode().IsRegular() {
		return "", ErrNotRegularFile
	}
	current, _, err := w.readEncodedText(ctx, target, limit)
	if err != nil {
		return "", err
	}
	if current.Revision != expectedRevision {
		return "", ErrFileChanged
	}
	// Re-read immediately before replacement so a change during encoding does
	// not silently overwrite the newer file.
	latest, _, err := w.readEncodedText(ctx, target, limit)
	if err != nil {
		return "", err
	}
	if latest.Revision != expectedRevision {
		return "", ErrFileChanged
	}
	absolute, _, err := w.boundPath(ctx, target.relative, false)
	if err != nil {
		return "", err
	}
	if err = w.writeAtomic(ctx, absolute, encoded, target.info.Mode()); err != nil {
		return "", err
	}
	return encodedTextRevision(encoded), nil
}
