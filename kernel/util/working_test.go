// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package util

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/logging"
)

func TestForgeWorkspaceUsesAbsolutePaths(t *testing.T) {
	originalWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory failed: %s", err)
	}
	originalHomeDir, originalWorkingDir, originalMode := HomeDir, WorkingDir, Mode
	originalWorkspaceDir, originalWorkspaceName := WorkspaceDir, WorkspaceName
	originalConfDir, originalDataDir, originalRepoDir := ConfDir, DataDir, RepoDir
	originalHistoryDir, originalTempDir, originalQueueDir := HistoryDir, TempDir, QueueDir
	originalDBPath, originalHistoryDBPath := DBPath, HistoryDBPath
	originalAssetContentDBPath, originalBlockTreeDBPath := AssetContentDBPath, BlockTreeDBPath
	originalSnippetsPath, originalShortcutsPath := SnippetsPath, ShortcutsPath
	originalLogPath := logging.LogPath
	originalTempEnv := map[string]string{}
	for _, name := range []string{"TEMP", "TMP", "TMPDIR"} {
		originalTempEnv[name] = os.Getenv(name)
	}
	baseDir := t.TempDir()
	t.Cleanup(func() {
		_ = os.Chdir(originalWD)
		for name, value := range originalTempEnv {
			_ = os.Setenv(name, value)
		}
		HomeDir, WorkingDir, Mode = originalHomeDir, originalWorkingDir, originalMode
		WorkspaceDir, WorkspaceName = originalWorkspaceDir, originalWorkspaceName
		ConfDir, DataDir, RepoDir = originalConfDir, originalDataDir, originalRepoDir
		HistoryDir, TempDir, QueueDir = originalHistoryDir, originalTempDir, originalQueueDir
		DBPath, HistoryDBPath = originalDBPath, originalHistoryDBPath
		AssetContentDBPath, BlockTreeDBPath = originalAssetContentDBPath, originalBlockTreeDBPath
		SnippetsPath, ShortcutsPath = originalSnippetsPath, originalShortcutsPath
		logging.SetLogPath(originalLogPath)
		_ = os.RemoveAll(baseDir)
	})

	workingDir := filepath.Join(baseDir, "app", "kernel")
	if err = os.MkdirAll(workingDir, 0o755); err != nil {
		t.Fatalf("create working directory failed: %s", err)
	}
	if err = os.Chdir(workingDir); err != nil {
		t.Fatalf("change working directory failed: %s", err)
	}

	HomeDir = filepath.Join(baseDir, "home")
	WorkingDir = "."
	Mode = ModeForge
	initWorkspaceDir(filepath.Join("..", "..", ".dev-workspace"))

	if WorkingDir != workingDir {
		t.Fatalf("unexpected working path: got %q, want %q", WorkingDir, workingDir)
	}
	wantWorkspaceDir := filepath.Join(baseDir, ".dev-workspace")
	if WorkspaceDir != wantWorkspaceDir {
		t.Fatalf("unexpected workspace path: got %q, want %q", WorkspaceDir, wantWorkspaceDir)
	}
	for name, path := range map[string]string{
		"workspace": WorkspaceDir,
		"conf":      ConfDir,
		"data":      DataDir,
		"temp":      TempDir,
	} {
		if !filepath.IsAbs(path) {
			t.Errorf("%s path is not absolute: %q", name, path)
		}
	}

	wantOSTempDir := filepath.Join(wantWorkspaceDir, "temp", "os")
	for _, name := range []string{"TEMP", "TMP", "TMPDIR"} {
		if got := os.Getenv(name); got != wantOSTempDir {
			t.Errorf("unexpected %s: got %q, want %q", name, got, wantOSTempDir)
		}
	}

	otherDir := filepath.Join(baseDir, "other")
	if err = os.MkdirAll(otherDir, 0o755); err != nil {
		t.Fatalf("create alternate working directory failed: %s", err)
	}
	if err = os.Chdir(otherDir); err != nil {
		t.Fatalf("change to alternate working directory failed: %s", err)
	}
	if _, err = os.Stat(os.Getenv("TEMP")); err != nil {
		t.Fatalf("absolute temp directory became inaccessible after changing directory: %s", err)
	}
}
