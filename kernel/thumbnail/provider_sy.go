package thumbnail

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// SYProvider implements the reference loader for SiYuan .sy archives.
//
// The reference treats a .sy file as an application document and serves the
// product icon as its thumbnail. This is a format-specific provider, not a
// generic file-icon fallback: a missing product icon is reported as an error.
type SYProvider struct {
	iconPath string
}

func NewSYProvider() *SYProvider {
	return &SYProvider{iconPath: filepath.Join(util.WorkingDir, "stage", "icon.png")}
}

func (p *SYProvider) Name() string {
	return "SY"
}

func (p *SYProvider) Priority() int {
	return 40
}

func (p *SYProvider) CanHandle(filePath string) bool {
	return strings.EqualFold(filepath.Ext(filePath), ".sy")
}

func (p *SYProvider) Generate(_ string, _, _ int) ([]byte, error) {
	if p == nil || strings.TrimSpace(p.iconPath) == "" {
		return nil, fmt.Errorf("SY thumbnail icon path is empty")
	}
	data, err := os.ReadFile(p.iconPath)
	if err != nil {
		return nil, fmt.Errorf("read SY thumbnail icon %q: %w", p.iconPath, err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("SY thumbnail icon %q is empty", p.iconPath)
	}
	return data, nil
}

// newSYProvider is kept package-private so tests can use a real fixture
// without mutating the process-wide working-directory configuration.
func newSYProvider(iconPath string) *SYProvider {
	return &SYProvider{iconPath: iconPath}
}
