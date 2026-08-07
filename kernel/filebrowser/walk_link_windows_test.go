//go:build windows

package filebrowser

import (
	"fmt"
	"os/exec"
	"testing"
)

func TestWalkDoesNotDescendIntoDirectoryJunctions(t *testing.T) {
	assertWalkDirectoryLinkContract(t, "junction", func(target, link string) {
		if err := createWalkDirectoryJunction(target, link); err != nil {
			t.Fatal(err)
		}
	})
}

func createWalkDirectoryJunction(target, link string) error {
	output, err := exec.Command("cmd.exe", "/d", "/c", "mklink", "/J", link, target).CombinedOutput()
	if err != nil {
		return fmt.Errorf("create junction: %w: %s", err, output)
	}
	return nil
}
