package coordinator

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	ignore "github.com/sabhiram/go-gitignore"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

func TestLoadForgeDevRepoGitIgnorePreservesLegacyParsing(t *testing.T) {
	root := t.TempDir()
	raw := []byte("\xef\xbb\xbfignored/\r\n*.tmp\r\nsolo\rline\n")
	if err := os.WriteFile(filepath.Join(root, ".gitignore"), raw, 0600); err != nil {
		t.Fatal(err)
	}
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	current := loadForgeDevRepoGitIgnore(context.Background(), walker, true)
	legacyText := strings.ReplaceAll(string(raw), "\r\n", "\n")
	legacy := ignore.CompileIgnoreLines(strings.Split(legacyText, "\n")...)
	if current == nil {
		t.Fatal("existing .gitignore was not loaded")
	}
	for _, candidate := range []string{"ignored/file.go", "cache.tmp", "solo\rline", "visible.go"} {
		if current.MatchesPath(candidate) != legacy.MatchesPath(candidate) {
			t.Fatalf("gitignore behavior differs for %q", candidate)
		}
	}
}

func TestLoadForgeDevRepoGitIgnoreHandlesMissingDisabledAndLinkedFiles(t *testing.T) {
	root := t.TempDir()
	walker, err := fswalk.New(root)
	if err != nil {
		t.Fatal(err)
	}
	if matcher := loadForgeDevRepoGitIgnore(context.Background(), walker, false); matcher != nil {
		t.Fatal("disabled gitignore loading returned a matcher")
	}
	if matcher := loadForgeDevRepoGitIgnore(context.Background(), walker, true); matcher != nil {
		t.Fatal("missing gitignore returned a matcher")
	}
	outside := filepath.Join(t.TempDir(), "outside.gitignore")
	if err = os.WriteFile(outside, []byte("secret/"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(outside, filepath.Join(root, ".gitignore")); err != nil {
		t.Skipf("symlink fixture is unavailable: %v", err)
	}
	if matcher := loadForgeDevRepoGitIgnore(context.Background(), walker, true); matcher != nil {
		t.Fatal("linked gitignore crossed the bound file policy")
	}
}
