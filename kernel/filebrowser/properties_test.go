package filebrowser

import (
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/internal/testutil/symlinkfixture"
)

func TestBatchPropertiesDescribesFilesDirectoriesAndPartialFailures(t *testing.T) {
	workspace := t.TempDir()
	external := t.TempDir()
	if err := os.Mkdir(filepath.Join(workspace, "folder"), 0755); err != nil {
		t.Fatal(err)
	}
	writePropertyPNG(t, filepath.Join(workspace, "folder", "preview.png"), 3, 2)
	if err := os.WriteFile(filepath.Join(external, "read-only.txt"), []byte("external"), 0600); err != nil {
		t.Fatal(err)
	}
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) {
		return map[string]*agent.TaskDirectoryBinding{
			"session": {Main: &agent.TaskDirectoryGrant{
				ID: "external", Path: external, Name: "external", Permission: agent.TaskDirectoryPermissionReadOnly,
			}},
		}, nil
	})
	roots, err := service.ListRoots()
	if err != nil {
		t.Fatal(err)
	}
	externalID := roots[1].ID
	request := BatchPropertiesRequest{Items: []FileRequest{
		{RootID: "workspace", Path: ""},
		{RootID: "workspace", Path: "folder"},
		{RootID: "workspace", Path: "folder/preview.png"},
		{RootID: externalID, Path: "read-only.txt"},
		{RootID: "workspace", Path: "missing.txt"},
		{RootID: "missing-root", Path: "file.txt"},
	}}
	result, err := service.BatchProperties(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if result.SuccessCount != 4 || result.FailureCount != 2 || len(result.Items) != len(request.Items) {
		t.Fatalf("unexpected batch summary: %+v", result)
	}
	if root := result.Items[0].Properties; root == nil || !root.Entry.IsDir || root.Entry.Path != "" || root.PreviewKind != PreviewKindDirectory {
		t.Fatalf("workspace root properties changed: %+v", root)
	}
	if directory := result.Items[1].Properties; directory == nil || !directory.Entry.IsDir || directory.Entry.Name != "folder" {
		t.Fatalf("directory properties changed: %+v", directory)
	}
	imageProperties := result.Items[2].Properties
	if imageProperties == nil || imageProperties.Width != 3 || imageProperties.Height != 2 ||
		imageProperties.PreviewKind != PreviewKindImage || imageProperties.ContentURL == "" || imageProperties.Revision == "" {
		t.Fatalf("image properties changed: %+v", imageProperties)
	}
	if runtime.GOOS == "windows" && imageProperties.Created == 0 {
		t.Fatal("Windows creation time was not exposed")
	}
	if externalProperties := result.Items[3].Properties; externalProperties == nil || !externalProperties.ReadOnly || externalProperties.Root.ID != externalID {
		t.Fatalf("root capability was not reflected: %+v", externalProperties)
	}
	if result.Items[4].Error == nil || result.Items[4].Error.Code != "path-not-found" {
		t.Fatalf("missing path error changed: %+v", result.Items[4])
	}
	if result.Items[5].Error == nil || result.Items[5].Error.Code != "root-not-found" {
		t.Fatalf("missing root error changed: %+v", result.Items[5])
	}
}

func TestPropertiesRejectsExternalSymbolicLinkAndDescribesInternalSymbolicLink(t *testing.T) {
	workspace := t.TempDir()
	outside := t.TempDir()
	insideTarget := filepath.Join(workspace, "inside.txt")
	outsideTarget := filepath.Join(outside, "outside.txt")
	if err := os.WriteFile(insideTarget, []byte("inside"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(outsideTarget, []byte("outside"), 0600); err != nil {
		t.Fatal(err)
	}
	symlinkfixture.Create(t, insideTarget, filepath.Join(workspace, "inside-link.txt"))
	symlinkfixture.Create(t, outsideTarget, filepath.Join(workspace, "outside-link.txt"))
	service := NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	properties, err := service.Properties(FileRequest{RootID: "workspace", Path: "inside-link.txt"})
	if err != nil || !properties.Entry.IsSymlink || properties.Entry.Size != int64(len("inside")) {
		t.Fatalf("internal symbolic link properties changed: properties=%+v err=%v", properties, err)
	}
	_, err = service.Properties(FileRequest{RootID: "workspace", Path: "outside-link.txt"})
	if !errors.Is(err, ErrPathTraversal) {
		t.Fatalf("external symbolic link was not rejected: %v", err)
	}
}

func TestBatchPropertiesEnforcesRequestBounds(t *testing.T) {
	service := NewService(t.TempDir(), func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	if _, err := service.BatchProperties(context.Background(), BatchPropertiesRequest{}); !errors.Is(err, ErrPropertiesEmpty) {
		t.Fatalf("empty batch was accepted: %v", err)
	}
	items := make([]FileRequest, maxPropertyItems+1)
	if _, err := service.BatchProperties(context.Background(), BatchPropertiesRequest{Items: items}); !errors.Is(err, ErrPropertiesTooLarge) {
		t.Fatalf("oversized batch was accepted: %v", err)
	}
}

func writePropertyPNG(t *testing.T, path string, width, height int) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	imageData := image.NewRGBA(image.Rect(0, 0, width, height))
	imageData.Set(0, 0, color.RGBA{R: 255, A: 255})
	if err = png.Encode(file, imageData); err != nil {
		_ = file.Close()
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
}
