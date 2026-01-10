package cronjob

import (
	"strings"
	"testing"
)

func Test提升Imports(t *testing.T) {
	source := `// Header
package main

// Comment 1
import (
	"siyuan/siyuan"
)

// Comment 2
var Name = "Test"

// Comment 3
func Run() {
	println("Run")
}

// Comment 4
import (
	"os"
)

// Comment 5
func Helper() {
	os.Exit(0)
}
`

	expectedContains := []string{
		"package main",
		`"siyuan/siyuan"`,
		`"os"`,
		"var Name = \"Test\"",
		"func Run()",
		"func Helper()",
	}

	result, err := 提升Imports(source)
	if err != nil {
		t.Fatalf("提升Imports failed: %v", err)
	}

	t.Logf("Result:\n%s", result)

	// Check for duplicates
	if strings.Count(result, "func Run()") > 1 {
		t.Errorf("Duplicate content detected: func Run()")
	}
	if strings.Count(result, "var Name") > 1 {
		t.Errorf("Duplicate content detected: var Name")
	}

	for _, exp := range expectedContains {
		if !strings.Contains(result, exp) {
			t.Errorf("Expected content missing: %s", exp)
		}
	}
}
