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

	"github.com/88250/gulu"
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

const shardMaxSize = 100 * 1024

var (
	logger      *Logger
	logFile     *os.File
	LogPath     string
	logToStdout = true
	logDir      string
	logName     string
	logExt      string
	currentDate string
	fileIndex   int
)

func init() {
	dir, err := os.Getwd()
	if nil != err {
		stdlog.Printf("get current dir failed: %s", err)
		dir = "./"
	}
	LogPath = filepath.Join(dir, "logging.log")
	initLogParts(LogPath)
}

func initLogParts(path string) {
	dir, name := filepath.Split(path)
	logDir = dir
	ext := filepath.Ext(name)
	logName = strings.TrimSuffix(name, ext)
	logExt = ext
}

func dailyLogPath(idx int) string {
	today := time.Now().Format("2006-01-02")
	if idx == 0 {
		return filepath.Join(logDir, logName+"-"+today+logExt)
	}
	return filepath.Join(logDir, fmt.Sprintf("%s-%s-%d%s", logName, today, idx, logExt))
}

func SetLogPath(path string) {
	LogPath = path
	initLogParts(path)
}

func SetLogToStdout(enabled bool) {
	logToStdout = enabled
}

func LogTracef(format string, v ...interface{}) {
	defer closeLogger()
	openLogger()

	if !logger.IsTraceEnabled() {
		return
	}
	logger.Tracef(format, v...)
}

func LogTrace(content string) {
	defer closeLogger()
	openLogger()

	if !logger.IsTraceEnabled() {
		return
	}
	logger.Tracef(content)
}

func LogDebugf(format string, v ...interface{}) {
	defer closeLogger()
	openLogger()

	if !logger.IsDebugEnabled() {
		return
	}
	logger.Debugf(format, v...)
}

func LogDebug(content string) {
	defer closeLogger()
	openLogger()

	if !logger.IsDebugEnabled() {
		return
	}
	logger.Debugf(content)
}

func LogInfof(format string, v ...interface{}) {
	defer closeLogger()
	openLogger()
	logger.Infof(format, v...)
}

func LogInfo(content string) {
	defer closeLogger()
	openLogger()

	if !logger.IsDebugEnabled() {
		return
	}
	logger.Infof(content)
}

func LogErrorf(format string, v ...interface{}) {
	defer closeLogger()
	openLogger()
	logger.Errorf(format, v...)
}

func LogError(content string) {
	defer closeLogger()
	openLogger()

	if !logger.IsDebugEnabled() {
		return
	}
	logger.Errorf(content)
}

func LogWarnf(format string, v ...interface{}) {
	defer closeLogger()
	openLogger()

	if !logger.IsWarnEnabled() {
		return
	}
	logger.Warnf(format, v...)
}

func LogWarn(content string) {
	defer closeLogger()
	openLogger()

	if !logger.IsWarnEnabled() {
		return
	}
	logger.Warnf(content)
}

func LogFatalf(exitCode int, format string, v ...interface{}) {
	openLogger()
	logger.Fatalf(exitCode, format, v...)
}

func LogFatal(exitCode int, content string) {
	openLogger()
	logger.Fatalf(exitCode, content)
}

var lock = sync.Mutex{}

func openLogger() {
	lock.Lock()

	today := time.Now().Format("2006-01-02")
	if currentDate != today {
		if logFile != nil {
			logFile.Close()
		}
		currentDate = today
		fileIndex = 0
	}

	for {
		actualPath := dailyLogPath(fileIndex)
		dir, _ := filepath.Split(actualPath)
		if !gulu.File.IsExist(dir) {
			if err := os.MkdirAll(dir, 0755); nil != err {
				stdlog.Printf("create log dir [%s] failed: %s", dir, err)
			}
		}

		if gulu.File.IsExist(actualPath) {
			if size := gulu.File.GetFileSize(actualPath); shardMaxSize <= size {
				fileIndex++
				continue
			}
		}

		var err error
		logFile, err = os.OpenFile(actualPath, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0644)
		if nil != err {
			stdlog.Printf("create log file [%s] failed: %s", actualPath, err)
		}
		logger = NewLogger(io.MultiWriter(getWriters(logFile)...))
		break
	}
}

func closeLogger() {
	logFile.Close()
	lock.Unlock()
}

func getWriters(logFile *os.File) []io.Writer {
	if logFile == nil {
		return []io.Writer{os.Stdout}
	}
	writers := make([]io.Writer, 0, 2)
	if logToStdout {
		writers = append(writers, os.Stdout)
	}
	writers = append(writers, logFile)
	return writers
}

func Recover() {
	if e := recover(); nil != e {
		stack := stack()
		msg := fmt.Sprintf("PANIC RECOVERED: %v\n\t%s\n", e, stack)
		LogErrorf(msg)
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
	closeLogger()
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
