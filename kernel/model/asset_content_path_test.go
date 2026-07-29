// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestAssetPathAndBoxDecodesURLPath(t *testing.T) {
	path, boxID, err := AssetPathAndBox("assets/%E9%93%9C%E9%9B%80%E5%8F%B0.md?box=20260321210706-xn94gx9", "")
	if err != nil {
		t.Fatal(err)
	}
	if path != "assets/铜雀台.md" {
		t.Fatalf("decoded path: got %q", path)
	}
	if boxID != "20260321210706-xn94gx9" {
		t.Fatalf("box ID: got %q", boxID)
	}
}

func TestReadTextAssetContentByPathUsesBoxQuery(t *testing.T) {
	originalDataDir, originalWorkspaceDir := util.DataDir, util.WorkspaceDir
	t.Cleanup(func() {
		util.DataDir, util.WorkspaceDir = originalDataDir, originalWorkspaceDir
	})

	workspaceDir := t.TempDir()
	util.WorkspaceDir = workspaceDir
	util.DataDir = filepath.Join(workspaceDir, "data")
	boxID := "20260321210706-xn94gx9"
	assetPath := filepath.Join(util.DataDir, boxID, "assets", "铜雀台.md")
	if err := os.MkdirAll(filepath.Dir(assetPath), 0755); err != nil {
		t.Fatal(err)
	}
	const content = "# 铜雀台\n\n主要内容"
	if err := os.WriteFile(assetPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	asset, err := ReadTextAssetContentByPath("assets/%E9%93%9C%E9%9B%80%E5%8F%B0.md?box=" + boxID)
	if err != nil {
		t.Fatal(err)
	}
	if asset.Path != "assets/%E9%93%9C%E9%9B%80%E5%8F%B0.md?box="+boxID {
		t.Fatalf("asset path: got %q", asset.Path)
	}
	if asset.Content != content {
		t.Fatalf("asset content: got %q, want %q", asset.Content, content)
	}
}
