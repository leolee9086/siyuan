package symlinkfixture

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	strictEnvironment   = "SFORGE_TEST_REQUIRE_REAL_SYMLINK"
	tempRootEnvironment = "SFORGE_TEST_TEMP_ROOT"
	repoRootEnvironment = "SFORGE_TEST_REPO_ROOT"
)

func Create(t testing.TB, target, link string) {
	t.Helper()
	strict := os.Getenv(strictEnvironment) == "1"
	if strict {
		validateStrictFixturePaths(t, target, link)
	}

	restore, privilegeErr := enableCreateSymbolicLinkPrivilege()
	if restore != nil {
		defer func() {
			if err := restore(); err != nil {
				t.Errorf("restore SeCreateSymbolicLinkPrivilege: %v", err)
			}
		}()
	}
	if privilegeErr != nil && strict {
		t.Fatalf("enable SeCreateSymbolicLinkPrivilege: %v", privilegeErr)
	}
	if privilegeErr != nil {
		t.Logf("SeCreateSymbolicLinkPrivilege is not assigned to this token: %v", privilegeErr)
	} else if strict {
		t.Log("temporarily enabled SeCreateSymbolicLinkPrivilege for symbolic-link creation")
	}
	if err := os.Symlink(target, link); err != nil {
		if strict {
			t.Fatalf("create required symbolic link %s -> %s: %v", link, target, err)
		}
		t.Skipf("real symbolic-link fixture requires the UAC acceptance runner: %v", err)
	}
	if err := verifySymbolicLink(link); err != nil {
		t.Fatalf("symbolic-link fixture verification failed for %s: %v", link, err)
	}
	if strict {
		t.Logf("created verified symbolic link %s -> %s", link, target)
	}
}

func validateStrictFixturePaths(t testing.TB, target, link string) {
	t.Helper()
	tempRoot := requiredAbsoluteDirectory(t, tempRootEnvironment)
	repoRoot := requiredAbsoluteDirectory(t, repoRootEnvironment)
	allowedRoot := filepath.Join(repoRoot, ".dev-workspace", "temp", "go-test")
	if !sameOrWithin(allowedRoot, tempRoot) {
		t.Fatalf("strict test root leaves repository isolation boundary: root=%s allowed=%s", tempRoot, allowedRoot)
	}
	for label, path := range map[string]string{"target": target, "link": link} {
		absolute, err := filepath.Abs(path)
		if err != nil {
			t.Fatalf("resolve symbolic-link %s path %q: %v", label, path, err)
		}
		if !sameOrWithin(tempRoot, absolute) {
			t.Fatalf("symbolic-link %s leaves strict test root: path=%s root=%s", label, absolute, tempRoot)
		}
		if !strings.EqualFold(filepath.VolumeName(tempRoot), filepath.VolumeName(absolute)) {
			t.Fatalf("symbolic-link %s crosses volumes: path=%s root=%s", label, absolute, tempRoot)
		}
	}
}

func requiredAbsoluteDirectory(t testing.TB, name string) string {
	t.Helper()
	value := os.Getenv(name)
	if value == "" {
		t.Fatalf("strict symbolic-link acceptance requires %s", name)
	}
	absolute, err := filepath.Abs(value)
	if err != nil {
		t.Fatalf("resolve %s=%q: %v", name, value, err)
	}
	info, err := os.Stat(absolute)
	if err != nil || !info.IsDir() {
		t.Fatalf("%s must name an existing directory: path=%s err=%v", name, absolute, err)
	}
	return filepath.Clean(absolute)
}

func sameOrWithin(root, candidate string) bool {
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(candidate))
	if err != nil || filepath.IsAbs(relative) || relative == ".." {
		return false
	}
	return !strings.HasPrefix(relative, ".."+string(os.PathSeparator))
}

func unexpectedReparseTag(tag uint32) error {
	return fmt.Errorf("expected IO_REPARSE_TAG_SYMLINK, got %#x", tag)
}
