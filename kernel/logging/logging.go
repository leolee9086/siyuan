// SiYuan - Build Your Eternal Digital Garden
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

package logging

import (
	"bytes"
	"fmt"
	"io"
	stdlog "log"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

const (
	ExitCodeUnavailableDatabase = 20
	ExitCodeUnavailablePort     = 21
	ExitCodeSecurityRisk        = 22
	ExitCodeWorkspaceLocked     = 24
	ExitCodeInitWorkspaceErr    = 25
	ExitCodeFileSysErr          = 26
	ExitCodeOk                  = 0
	ExitCodeFatal               = 1
)

func ShortStack() string {
	output := string(debug.Stack())
	lines := strings.Split(output, "\n")
	if 5 < len(lines) {
		lines = lines[5:]
	}
	buf := bytes.Buffer{}
	for _, l := range lines {
		if strings.Contains(l, "gin-gonic") {
			break
		}
		buf.WriteString("    ")
		buf.WriteString(l)
		buf.WriteByte('\n')
	}
	return buf.String()
}

const shardMaxSize int64 = 100 * 1024

type FileLoggerConfig struct {
	Path         string
	LogToStdout  bool
	ShardMaxSize int64
	Level        string
}

// FileLogger 为需要独立落盘的日志通道提供与主日志一致的分片和级别能力。
type FileLogger struct {
	lock         sync.Mutex
	path         string
	logDir       string
	logName      string
	logExt       string
	logToStdout  bool
	shardMaxSize int64
	level        int
	currentDate  string
	fileIndex    int
}

func NewFileLogger(config FileLoggerConfig) (*FileLogger, error) {
	path := strings.TrimSpace(config.Path)
	if path == "" {
		return nil, fmt.Errorf("log path is empty")
	}

	shardSize := config.ShardMaxSize
	if shardSize <= 0 {
		shardSize = shardMaxSize
	}
	level := logLevel
	if strings.TrimSpace(config.Level) != "" {
		level = getLevel(config.Level)
	}
	dir, name := filepath.Split(path)
	ext := filepath.Ext(name)
	return &FileLogger{
		path:         path,
		logDir:       dir,
		logName:      strings.TrimSuffix(name, ext),
		logExt:       ext,
		logToStdout:  config.LogToStdout,
		shardMaxSize: shardSize,
		level:        level,
	}, nil
}

func (l *FileLogger) Path() string {
	l.lock.Lock()
	defer l.lock.Unlock()
	return l.path
}

func (l *FileLogger) SetLevel(level string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	l.level = getLevel(level)
}

func (l *FileLogger) isEnabled(level int) bool {
	l.lock.Lock()
	defer l.lock.Unlock()
	return l.level <= level
}

func (l *FileLogger) dailyLogPath(idx int) string {
	today := time.Now().Format("2006-01-02")
	if idx == 0 {
		return filepath.Join(l.logDir, l.logName+"-"+today+l.logExt)
	}
	return filepath.Join(l.logDir, fmt.Sprintf("%s-%s-%d%s", l.logName, today, idx, l.logExt))
}

func (l *FileLogger) write(level int, prefix, format string, v ...interface{}) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if level < l.level {
		return
	}

	today := time.Now().Format("2006-01-02")
	if l.currentDate != today {
		l.currentDate = today
		l.fileIndex = 0
	}

	var logFile *os.File
	for {
		actualPath := l.dailyLogPath(l.fileIndex)
		if err := os.MkdirAll(filepath.Dir(actualPath), 0755); err != nil {
			stdlog.Printf("create log dir [%s] failed: %s", filepath.Dir(actualPath), err)
			return
		}
		if info, err := os.Stat(actualPath); err == nil && l.shardMaxSize <= info.Size() {
			l.fileIndex++
			continue
		}
		var err error
		logFile, err = os.OpenFile(actualPath, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err != nil {
			stdlog.Printf("create log file [%s] failed: %s", actualPath, err)
			return
		}
		break
	}
	defer logFile.Close()

	writers := []io.Writer{logFile}
	if l.logToStdout {
		writers = append([]io.Writer{os.Stdout}, writers...)
	}
	output := stdlog.New(io.MultiWriter(writers...), prefix, stdlog.Ldate|stdlog.Ltime|stdlog.Lshortfile)
	_ = output.Output(4, fmt.Sprintf(format, v...))
}

func (l *FileLogger) Tracef(format string, v ...interface{}) {
	l.write(Trace, "T ", format, v...)
}

func (l *FileLogger) Debugf(format string, v ...interface{}) {
	l.write(Debug, "D ", format, v...)
}

func (l *FileLogger) Infof(format string, v ...interface{}) {
	l.write(Info, "I ", format, v...)
}

func (l *FileLogger) Warnf(format string, v ...interface{}) {
	l.write(Warn, "W ", format, v...)
}

func (l *FileLogger) Errorf(format string, v ...interface{}) {
	l.write(Error, "E ", format, v...)
}

var LogPath string

var (
	defaultLoggerLock sync.RWMutex
	defaultLogger     *FileLogger
	logToStdout       = true
)

func init() {
	dir, err := os.Getwd()
	if nil != err {
		stdlog.Printf("get current dir failed: %s", err)
		dir = "./"
	}
	LogPath = filepath.Join(dir, "logging.log")
	defaultLogger, _ = NewFileLogger(FileLoggerConfig{Path: LogPath, LogToStdout: logToStdout})
}

func SetLogPath(path string) {
	defaultLoggerLock.Lock()
	defer defaultLoggerLock.Unlock()
	created, err := NewFileLogger(FileLoggerConfig{Path: path, LogToStdout: logToStdout})
	if err != nil {
		stdlog.Printf("set log path [%s] failed: %s", path, err)
		return
	}
	LogPath = path
	defaultLogger = created
}

func SetLogToStdout(enabled bool) {
	defaultLoggerLock.Lock()
	defer defaultLoggerLock.Unlock()
	created, err := NewFileLogger(FileLoggerConfig{Path: LogPath, LogToStdout: enabled})
	if err != nil {
		stdlog.Printf("configure stdout logging failed: %s", err)
		return
	}
	logToStdout = enabled
	defaultLogger = created
}

func getDefaultLogger() *FileLogger {
	defaultLoggerLock.RLock()
	defer defaultLoggerLock.RUnlock()
	return defaultLogger
}

func LogTracef(format string, v ...interface{}) {
	getDefaultLogger().Tracef(format, v...)
}

func LogTrace(content string) {
	current := getDefaultLogger()
	if current.isEnabled(Trace) {
		current.Tracef("%s", content)
	}
}

func LogDebugf(format string, v ...interface{}) {
	getDefaultLogger().Debugf(format, v...)
}

func LogDebug(content string) {
	current := getDefaultLogger()
	if current.isEnabled(Debug) {
		current.Debugf("%s", content)
	}
}

func LogInfof(format string, v ...interface{}) {
	getDefaultLogger().Infof(format, v...)
}

func LogInfo(content string) {
	current := getDefaultLogger()
	if current.isEnabled(Debug) {
		current.Infof("%s", content)
	}
}

func LogErrorf(format string, v ...interface{}) {
	getDefaultLogger().Errorf(format, v...)
}

func LogError(content string) {
	current := getDefaultLogger()
	if current.isEnabled(Debug) {
		current.Errorf("%s", content)
	}
}

func LogWarnf(format string, v ...interface{}) {
	getDefaultLogger().Warnf(format, v...)
}

func LogWarn(content string) {
	current := getDefaultLogger()
	if current.isEnabled(Warn) {
		current.Warnf("%s", content)
	}
}

func LogFatalf(exitCode int, format string, v ...interface{}) {
	format += "\n%s"
	v = append(v, shortStack())
	getDefaultLogger().write(Fatal, "F ", format, v...)
	os.Exit(exitCode)
}

func LogFatal(exitCode int, content string) {
	LogFatalf(exitCode, "%s", content)
}

func Recover() {
	if e := recover(); nil != e {
		stack := stack()
		msg := fmt.Sprintf("PANIC RECOVERED: %v\n\t%s\n", e, stack)
		LogErrorf("%s", msg)
	}
}

var (
	dunno     = []byte("???")
	centerDot = []byte("·")
	dot       = []byte(".")
	slash     = []byte("/")
)

func stack() []byte {
	buf := &bytes.Buffer{}
	var lines [][]byte
	var lastFile string
	for i := 2; ; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		fmt.Fprintf(buf, "%s:%d (0x%x)\n", file, line, pc)
		if file != lastFile {
			data, err := os.ReadFile(file)
			if err != nil {
				continue
			}
			lines = bytes.Split(data, []byte{'\n'})
			lastFile = file
		}
		line--
		fmt.Fprintf(buf, "\t%s: %s\n", function(pc), source(lines, line))
	}
	return buf.Bytes()
}

func source(lines [][]byte, n int) []byte {
	if n < 0 || n >= len(lines) {
		return dunno
	}
	return bytes.Trim(lines[n], " \t")
}

func function(pc uintptr) []byte {
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return dunno
	}
	name := []byte(fn.Name())
	if lastslash := bytes.LastIndex(name, slash); lastslash >= 0 {
		name = name[lastslash+1:]
	}
	if period := bytes.Index(name, dot); period >= 0 {
		name = name[period+1:]
	}
	name = bytes.Replace(name, centerDot, dot, -1)
	return name
}

const (
	Off = iota
	Trace
	Debug
	Info
	Warn
	Error
	Fatal
)

var logLevel = Debug

type Logger struct {
	level  int
	logger *stdlog.Logger
}

func NewLogger(out io.Writer) *Logger {
	ret := &Logger{level: logLevel, logger: stdlog.New(out, "", stdlog.Ldate|stdlog.Ltime|stdlog.Lshortfile)}
	return ret
}

func SetLogLevel(level string) {
	logLevel = getLevel(level)
	if current := getDefaultLogger(); current != nil {
		current.SetLevel(level)
	}
}

func getLevel(level string) int {
	level = strings.ToLower(level)

	switch level {
	case "off":
		return Off
	case "trace":
		return Trace
	case "debug":
		return Debug
	case "info":
		return Info
	case "warn":
		return Warn
	case "error":
		return Error
	case "fatal":
		return Fatal
	default:
		return Info
	}
}

func (l *Logger) SetLevel(level string) {
	l.level = getLevel(level)
}

func (l *Logger) IsTraceEnabled() bool {
	return l.level <= Trace
}

func (l *Logger) IsDebugEnabled() bool {
	return l.level <= Debug
}

func (l *Logger) IsWarnEnabled() bool {
	return l.level <= Warn
}

func (l *Logger) Tracef(format string, v ...interface{}) {
	if Trace < l.level {
		return
	}

	l.logger.SetPrefix("T ")
	l.logger.Output(3, fmt.Sprintf(format, v...))
}

func (l *Logger) Debugf(format string, v ...interface{}) {
	if Debug < l.level {
		return
	}

	l.logger.SetPrefix("D ")
	l.logger.Output(3, fmt.Sprintf(format, v...))
}

func (l *Logger) Infof(format string, v ...interface{}) {
	if Info < l.level {
		return
	}

	l.logger.SetPrefix("I ")
	l.logger.Output(3, fmt.Sprintf(format, v...))
}

func (l *Logger) Warnf(format string, v ...interface{}) {
	if Warn < l.level {
		return
	}

	l.logger.SetPrefix("W ")
	msg := fmt.Sprintf(format, v...)
	l.logger.Output(3, msg)
}

func (l *Logger) Errorf(format string, v ...interface{}) {
	if Error < l.level {
		return
	}

	l.logger.SetPrefix("E ")
	msg := fmt.Sprintf(format, v...)
	l.logger.Output(3, msg)
}

func (l *Logger) Fatalf(exitCode int, format string, v ...interface{}) {
	if Fatal < l.level {
		return
	}

	l.logger.SetPrefix("F ")
	format += "\n%s"
	v = append(v, shortStack())
	msg := fmt.Sprintf(format, v...)
	l.logger.Output(3, msg)
	os.Exit(exitCode)
}

func shortStack() string {
	output := string(debug.Stack())
	lines := strings.Split(output, "\n")
	if 11 < len(lines) {
		lines = lines[11:]
	}
	buf := bytes.Buffer{}
	for _, l := range lines {
		if strings.Contains(l, "gin-gonic") {
			break
		}
		buf.WriteString("    ")
		buf.WriteString(l)
		buf.WriteByte('\n')
	}
	return buf.String()
}
