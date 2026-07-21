package observability

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const detailLogShardSize int64 = 10 * 1024 * 1024

var (
	detailLoggerLock sync.Mutex
	detailLogger     *logging.FileLogger
	detailLoggerPath string
)

// DetailLogPath 返回 MAGI 完整载荷和正文的独立日志路径。
func DetailLogPath() string {
	baseDir := util.TempDir
	if baseDir == "" {
		baseDir = filepath.Join(os.TempDir(), "siyuan")
	}
	return filepath.Join(baseDir, "magi", "magi.log")
}

// Detailf 将不适合出现在主日志和终端中的 MAGI 详细内容写入独立日志通道。
func Detailf(format string, v ...interface{}) {
	path := DetailLogPath()
	detailLoggerLock.Lock()
	defer detailLoggerLock.Unlock()

	if detailLogger == nil || detailLoggerPath != path {
		var err error
		detailLogger, err = logging.NewFileLogger(logging.FileLoggerConfig{
			Path:         path,
			LogToStdout:  false,
			ShardMaxSize: detailLogShardSize,
			Level:        "info",
		})
		if err != nil {
			logging.LogErrorf("MAGI detail logger initialization failed: %v", err)
			return
		}
		detailLoggerPath = path
	}
	detailLogger.Infof(format, v...)
}
