//go:build windows

package symlinkfixture

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/windows"
)

func TestCreateRestoresSymbolicLinkPrivilegeState(t *testing.T) {
	if os.Getenv(strictEnvironment) != "1" {
		t.Skip("run through scripts/test-windows-symlink-uac.ps1")
	}
	var token windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &token); err != nil {
		t.Fatal(err)
	}
	defer token.Close()
	name, err := windows.UTF16PtrFromString("SeCreateSymbolicLinkPrivilege")
	if err != nil {
		t.Fatal(err)
	}
	var luid windows.LUID
	if err = windows.LookupPrivilegeValue(nil, name, &luid); err != nil {
		t.Fatal(err)
	}
	assignedBefore, attributesBefore, err := tokenPrivilegeAttributes(token, luid)
	if err != nil || !assignedBefore {
		t.Fatalf("privilege is not assigned before creation: assigned=%t attributes=%#x err=%v",
			assignedBefore, attributesBefore, err)
	}

	root := t.TempDir()
	target := filepath.Join(root, "target.txt")
	if err = os.WriteFile(target, []byte("target"), 0600); err != nil {
		t.Fatal(err)
	}
	Create(t, target, filepath.Join(root, "link.txt"))

	assignedAfter, attributesAfter, err := tokenPrivilegeAttributes(token, luid)
	if err != nil || !assignedAfter {
		t.Fatalf("privilege is not assigned after creation: assigned=%t attributes=%#x err=%v",
			assignedAfter, attributesAfter, err)
	}
	if attributesBefore&windows.SE_PRIVILEGE_ENABLED != attributesAfter&windows.SE_PRIVILEGE_ENABLED {
		t.Fatalf("privilege enabled state was not restored: before=%#x after=%#x",
			attributesBefore, attributesAfter)
	}
}
