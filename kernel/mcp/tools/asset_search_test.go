// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func useBoxAssetTestWorkspace(t *testing.T) string {
	t.Helper()
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
	if err := os.WriteFile(assetPath, []byte("# 铜雀台\n\n主要内容"), 0644); err != nil {
		t.Fatal(err)
	}
	return "assets/%E9%93%9C%E9%9B%80%E5%8F%B0.md?box=" + boxID
}

func TestAssetStatResolvesEncodedBoxAssetPath(t *testing.T) {
	assetPath := useBoxAssetTestWorkspace(t)
	result, err := assetStat(map[string]any{"path": assetPath})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError || len(result.Content) != 1 || !strings.Contains(result.Content[0].Text, "IsDir: false") {
		t.Fatalf("unexpected stat result: %#v", result)
	}
}

func TestGetAssetHandlerReadsBoxScopedTextAsset(t *testing.T) {
	assetPath := useBoxAssetTestWorkspace(t)
	result, err := getAssetHandler(map[string]any{"path": assetPath})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError || len(result.Content) != 1 || !strings.Contains(result.Content[0].Text, "# 铜雀台") {
		t.Fatalf("unexpected getasset result: %#v", result)
	}
}
