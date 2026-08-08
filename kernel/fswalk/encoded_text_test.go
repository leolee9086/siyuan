package fswalk

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"unicode/utf16"

	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func encodedUTF16Fixture(text string, order binary.ByteOrder, bom []byte) []byte {
	units := utf16.Encode([]rune(text))
	result := make([]byte, len(bom)+len(units)*2)
	copy(result, bom)
	for index, unit := range units {
		if order == binary.LittleEndian {
			binary.LittleEndian.PutUint16(result[len(bom)+index*2:], unit)
		} else {
			binary.BigEndian.PutUint16(result[len(bom)+index*2:], unit)
		}
	}
	return result
}

func revisionOf(raw []byte) string {
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func TestEncodedTextReadRecognizesSupportedEncodings(t *testing.T) {
	root := t.TempDir()
	fixtures := []struct {
		name     string
		raw      []byte
		encoding TextEncoding
	}{
		{name: "utf8.txt", raw: []byte("hello 中文\n"), encoding: TextEncodingUTF8},
		{name: "utf8-bom.txt", raw: append([]byte{0xef, 0xbb, 0xbf}, []byte("hello 中文\n")...), encoding: TextEncodingUTF8BOM},
		{name: "utf16le.txt", raw: encodedUTF16Fixture("hello 中文\n", binary.LittleEndian, []byte{0xff, 0xfe}), encoding: TextEncodingUTF16LE},
		{name: "utf16be.txt", raw: encodedUTF16Fixture("hello 中文\n", binary.BigEndian, []byte{0xfe, 0xff}), encoding: TextEncodingUTF16BE},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			path := filepath.Join(root, fixture.name)
			if err := os.WriteFile(path, fixture.raw, 0600); err != nil {
				t.Fatal(err)
			}
			walker, err := New(root)
			if err != nil {
				t.Fatal(err)
			}
			document, err := walker.ReadTextFileWithEncoding(context.Background(), fixture.name, 0)
			if err != nil {
				t.Fatal(err)
			}
			if document.Text != "hello 中文\n" || document.Encoding != fixture.encoding ||
				document.Size != int64(len(fixture.raw)) || document.Revision != revisionOf(fixture.raw) {
				t.Fatalf("unexpected document: %+v", document)
			}
		})
	}
}

func TestEncodedTextWritePreservesEncodingPermissionsAndRevision(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "document.txt")
	raw := encodedUTF16Fixture("first\n", binary.LittleEndian, []byte{0xff, 0xfe})
	if err := os.WriteFile(path, raw, 0600); err != nil {
		t.Fatal(err)
	}
	before, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	document, err := walker.ReadTextFileWithEncoding(context.Background(), "document.txt", 1024)
	if err != nil {
		t.Fatal(err)
	}
	newRevision, err := walker.WriteTextFileWithEncoding(context.Background(), "document.txt", "second 中文\n",
		document.Encoding, document.Revision, 1024)
	if err != nil {
		t.Fatal(err)
	}
	expected := encodedUTF16Fixture("second 中文\n", binary.LittleEndian, []byte{0xff, 0xfe})
	written, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(written, expected) || newRevision != revisionOf(expected) {
		t.Fatalf("encoded write changed bytes: %v revision=%s err=%v", written, newRevision, err)
	}
	after, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if before.Mode().Perm() != after.Mode().Perm() {
		t.Fatalf("file permissions changed: before=%#o after=%#o", before.Mode().Perm(), after.Mode().Perm())
	}
	if _, err = walker.WriteTextFileWithEncoding(context.Background(), "document.txt", "stale", document.Encoding,
		document.Revision, 1024); !errors.Is(err, ErrFileChanged) {
		t.Fatalf("stale revision returned %v", err)
	}
	if err = os.WriteFile(path, []byte("external"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = walker.WriteTextFileWithEncoding(context.Background(), "document.txt", "nul\x00", TextEncodingUTF8,
		newRevision, 1024); !errors.Is(err, ErrBinaryText) {
		t.Fatalf("NUL write returned %v", err)
	}
}

func TestEncodedTextRejectsInvalidContentLimitsDirectoriesAndLinks(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "binary.bin"), []byte{'a', 0, 'b'}, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "invalid.txt"), []byte{0xff, 0xfe, 0x00}, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "odd-utf16.txt"), []byte{0xff, 0xfe, 0x61}, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "bad-surrogate.txt"), []byte{0xff, 0xfe, 0x00, 0xd8}, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "large.txt"), []byte("12345"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, "directory"), 0755); err != nil {
		t.Fatal(err)
	}
	walker, err := New(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		path string
		err  error
	}{
		{path: "binary.bin", err: ErrBinaryText},
		{path: "invalid.txt", err: ErrInvalidUTF16},
		{path: "odd-utf16.txt", err: ErrInvalidUTF16},
		{path: "bad-surrogate.txt", err: ErrInvalidUTF16},
		{path: "large.txt", err: ErrTextFileTooLarge},
		{path: "directory", err: ErrNotRegularFile},
	} {
		t.Run(test.path, func(t *testing.T) {
			limit := int64(0)
			if test.path == "large.txt" {
				limit = 4
			}
			if _, readErr := walker.ReadTextFileWithEncoding(context.Background(), test.path, limit); !errors.Is(readErr, test.err) {
				t.Fatalf("returned %v, want %v", readErr, test.err)
			}
		})
	}
	if _, err = walker.ReadTextFileWithEncoding(context.Background(), "../outside.txt", 1024); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("path traversal returned %v", err)
	}
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err = os.WriteFile(outside, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, outside, filepath.Join(root, "linked.txt"))
	if _, err = walker.ReadTextFileWithEncoding(context.Background(), "linked.txt", 1024); !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("linked file returned %v", err)
	}
}
