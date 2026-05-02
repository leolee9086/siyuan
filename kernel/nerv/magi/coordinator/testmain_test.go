package coordinator

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/logging"
)

// TestMain redirects test log output to system temp directory,
// preventing logging package from writing log files into code directory.
func TestMain(m *testing.M) {
	logging.SetLogPath(filepath.Join(os.TempDir(), "magi-coordinator-test.log"))

	os.Exit(m.Run())
}
