package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	WarnThreshold  = 300
	ErrorThreshold = 500
)

func main() {
	kernelRoot, err := findKernelRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}

	var (
		warnCount int
		errCount  int
		fileCount int
	)

	err = filepath.WalkDir(kernelRoot, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			base := filepath.Base(path)
			if base == "vendor" || base == "node_modules" || base == ".git" || base == "tools" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		fileCount++
		codeLines, err := countCodeLines(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "读取文件失败 %s: %v\n", path, err)
			return nil
		}

		relPath, _ := filepath.Rel(kernelRoot, path)
		relPath = filepath.ToSlash(relPath)

		if codeLines > ErrorThreshold {
			fmt.Printf("ERROR: %s 文件超过最大实际代码行数限制。当前实际代码 %d 行，最大允许实际代码 %d 行。请通过拆分模块、拆分函数、减少重复模式化代码的方式减少代码行数，绝不能试图通过破坏代码可读性的删除注释等方式强行敷衍任务！\n", relPath, codeLines, ErrorThreshold)
			errCount++
		} else if codeLines > WarnThreshold {
			fmt.Printf("WARNING: %s 文件实际代码行数超过警告阈值。当前实际代码 %d 行，警告阈值 %d 行。请考虑通过拆分模块、拆分函数、减少重复模式化代码的方式减少代码行数，绝不能试图通过破坏代码可读性的删除注释等方式强行敷衍任务！\n", relPath, codeLines, WarnThreshold)
			warnCount++
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "walk error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n检查了 %d 个 Go 文件: %d 个错误, %d 个警告\n", fileCount, errCount, warnCount)

	if errCount > 0 {
		os.Exit(1)
	}
}

func findKernelRoot() (string, error) {
	pwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		goMod := filepath.Join(pwd, "go.mod")
		if _, err := os.Stat(goMod); err == nil {
			content, err := os.ReadFile(goMod)
			if err == nil && strings.Contains(string(content), "module github.com/siyuan-note/siyuan/kernel") {
				return pwd, nil
			}
		}
		parent := filepath.Dir(pwd)
		if parent == pwd {
			return "", fmt.Errorf("找不到 kernel 根目录 (go.mod)")
		}
		pwd = parent
	}
}

func countCodeLines(filePath string) (int, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	lines := strings.Split(string(content), "\n")

	codeCount := 0
	inBlockComment := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" {
			continue
		}

		if inBlockComment {
			if strings.Contains(trimmed, "*/") {
				inBlockComment = false
			}
			continue
		}

		if strings.HasPrefix(trimmed, "/*") {
			if !strings.Contains(trimmed, "*/") {
				inBlockComment = true
			}
			continue
		}

		if strings.HasPrefix(trimmed, "//") {
			continue
		}

		codeCount++
	}

	return codeCount, nil
}
