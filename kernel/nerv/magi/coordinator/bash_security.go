package coordinator

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// BashCommandClass 表示 Bash 命令的安全分类结果。
type BashCommandClass int

const (
	// BashAllow 安全只读命令，自动允许执行。
	BashAllow BashCommandClass = iota
	// BashAsk 受限写命令，需要治理投票。
	BashAsk
	// BashDeny 绝对禁止的命令，直接拒绝。
	BashDeny
)

// safeReadCommands 安全只读命令（自动允许）。
var safeReadCommands = map[string]bool{
	"ls": true, "cat": true, "head": true, "tail": true,
	"wc": true, "stat": true, "file": true, "strings": true,
	"echo": true, "printf": true, "true": true, "false": true,
	"pwd": true, "which": true, "find": true, "grep": true, "rg": true,
	"sort": true, "uniq": true, "cut": true, "tr": true,
	"nl": true, "od": true, "hexdump": true, "xxd": true,
	"diff": true, "comm": true, "cmp": true,
}

// gitReadOnlySubcommands Git 只读子命令。
var gitReadOnlySubcommands = map[string]bool{
	"status": true, "log": true, "diff": true, "show": true,
	"branch": true, "tag": true, "blame": true, "grep": true,
	"stash": true, "ls-files": true, "describe": true,
	"rev-parse": true, "rev-list": true, "shortlog": true,
}

// gitWriteSubcommands Git 写子命令（需治理投票）。
var gitWriteSubcommands = map[string]bool{
	"add": true, "commit": true, "push": true, "pull": true,
	"rm": true, "mv": true, "checkout": true, "reset": true,
	"revert": true, "cherry-pick": true, "merge": true,
	"rebase": true, "stash": true,
}

// restrictedWriteCommands 受限写命令（需治理投票）。
var restrictedWriteCommands = map[string]bool{
	"mkdir": true, "touch": true, "cp": true, "mv": true,
}

// bannedCommands 绝对禁止命令。
var bannedCommands = map[string]bool{
	"rm": true, "rmdir": true, "sudo": true, "su": true,
	"chown": true, "chgrp": true, "chmod": true,
	"bash": true, "sh": true, "zsh": true, "fish": true,
	"wget": true, "curl": true, "nc": true, "telnet": true,
	"eval": true, "exec": true, "source": true,
	"dd": true, "mkfs": true, "mount": true, "umount": true, "fdisk": true,
	"kill": true, "pkill": true, "nice": true, "renice": true,
	"apt": true, "apt-get": true, "yum": true, "dnf": true,
	"brew": true, "npm": true, "pip": true, "pip3": true, "gem": true,
	"cargo": true, "go": true,
	"crontab": true, "systemctl": true, "service": true,
	"docker": true, "podman": true, "kubectl": true,
}

// classifyBashCommand 分类命令：allow / ask / deny。
// root 参数是 forge dev repo 根目录，用于路径安全检查。
func classifyBashCommand(command string, root string) BashCommandClass {
	command = strings.TrimSpace(command)
	if command == "" {
		return BashDeny
	}

	// 检查危险模式
	if err := checkDangerousPatterns(command); err != nil {
		return BashDeny
	}

	baseCmd := extractBaseCommand(command)
	if baseCmd == "" {
		return BashDeny
	}

	// 禁止命令
	if bannedCommands[baseCmd] {
		return BashDeny
	}

	// git 子命令分类
	if baseCmd == "git" {
		return classifyGitCommand(command)
	}

	// 受限写命令
	if restrictedWriteCommands[baseCmd] {
		return BashAsk
	}

	// 安全只读命令
	if safeReadCommands[baseCmd] {
		// 但仍需检查路径约束
		if err := checkPathConstraints(command, root); err != nil {
			return BashDeny
		}
		return BashAllow
	}

	// 未知命令视为受限（需治理）
	return BashAsk
}

// extractBaseCommand 提取命令的 base command（忽略管道、重定向、env 变量前缀）。
func extractBaseCommand(command string) string {
	command = strings.TrimSpace(command)
	if command == "" {
		return ""
	}

	// 移除前导的环境变量赋值（如 KEY=value cmd）
	parts := splitRespectingQuotes(command)
	if len(parts) == 0 {
		return ""
	}

	// 找到第一个不是 KEY=VALUE 模式的 token 作为 base command
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		// 跳过环境变量赋值
		if strings.Contains(trimmed, "=") && !strings.HasPrefix(trimmed, "-") {
			eqIdx := strings.Index(trimmed, "=")
			// 如果 = 前面是有效的标识符，认为是环境变量
			if isEnvVarAssignment(trimmed[:eqIdx]) {
				continue
			}
		}
		// 跳过管道符号
		if trimmed == "|" || trimmed == "|&" {
			continue
		}
		return strings.TrimSpace(trimmed)
	}

	return ""
}

// splitRespectingQuotes 简单分割命令行，考虑引号。
func splitRespectingQuotes(command string) []string {
	var parts []string
	var current strings.Builder
	inSingle := false
	inDouble := false

	for i := 0; i < len(command); i++ {
		ch := command[i]
		switch {
		case ch == '\'' && !inDouble:
			inSingle = !inSingle
			current.WriteByte(ch)
		case ch == '"' && !inSingle:
			inDouble = !inDouble
			current.WriteByte(ch)
		case ch == ' ' && !inSingle && !inDouble:
			if current.Len() > 0 {
				parts = append(parts, current.String())
				current.Reset()
			}
		default:
			current.WriteByte(ch)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}

// isEnvVarAssignment 检查 token 是否是有效的环境变量名。
func isEnvVarAssignment(key string) bool {
	if key == "" {
		return false
	}
	for i, r := range key {
		if i == 0 && !isAlpha(r) && r != '_' {
			return false
		}
		if !isAlphaNum(r) && r != '_' {
			return false
		}
	}
	return true
}

func isAlpha(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
}

func isAlphaNum(r rune) bool {
	return isAlpha(r) || (r >= '0' && r <= '9')
}

// classifyGitCommand 对 git 命令进行子命令分类。
func classifyGitCommand(fullCommand string) BashCommandClass {
	// 提取 git 的子命令
	parts := splitRespectingQuotes(fullCommand)
	if len(parts) < 2 {
		return BashAsk // 只有 git 没有子命令，要求投票
	}

	subCmd := ""
	for i, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "git" && i+1 < len(parts) {
			next := strings.TrimSpace(parts[i+1])
			if !strings.HasPrefix(next, "-") {
				subCmd = next
				break
			}
		}
	}

	if subCmd == "" {
		return BashAsk
	}

	if gitReadOnlySubcommands[subCmd] {
		return BashAllow
	}
	if gitWriteSubcommands[subCmd] {
		return BashAsk
	}

	// 未知 git 子命令视为受限
	return BashAsk
}

// checkPathConstraints 检查命令参数中的路径是否在 forge dev repo 内。
// 当前实现检测 cd 命令的逃逸尝试和其他路径参数。
func checkPathConstraints(command string, root string) error {
	command = strings.TrimSpace(command)
	if command == "" || root == "" {
		return nil
	}

	// 检查 cd 逃逸：cd .. 或 cd 绝对路径
	cdEscapes := detectCdEscape(command, root)
	if len(cdEscapes) > 0 {
		return fmt.Errorf("禁止 cd 逸出 forge dev repo 根目录: %s", strings.Join(cdEscapes, "; "))
	}

	return nil
}

// detectCdEscape 检测 cd 命令的逃逸尝试。
func detectCdEscape(command string, root string) []string {
	var escapes []string
	parts := splitRespectingQuotes(command)
	for i, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "cd" {
			continue
		}
		if i+1 >= len(parts) {
			continue
		}
		cdTarget := strings.TrimSpace(parts[i+1])
		cdTarget = strings.Trim(cdTarget, "'\"") // 去除引号

		// 检查绝对路径
		if filepath.IsAbs(cdTarget) {
			escapes = append(escapes, fmt.Sprintf("cd %s (绝对路径)", cdTarget))
			continue
		}

		// 检查 .. 逃逸
		cleaned := filepath.Clean(cdTarget)
		if strings.HasPrefix(cleaned, "..") || cleaned == ".." {
			rel, err := filepath.Rel(root, filepath.Join(root, cleaned))
			if err != nil || strings.HasPrefix(rel, "..") {
				escapes = append(escapes, fmt.Sprintf("cd %s (尝试逃逸到 repo 外部)", cdTarget))
			}
		}
	}
	return escapes
}

// dangerousPatternRe 编译一次性用于检测危险模式的正则表达式。
var (
	// commandSubstitutionRe 检测 $() 和 ${} 命令替换。
	commandSubstitutionRe = regexp.MustCompile(`\$\([^)]+\)`)
	// backtickRe 检测反引号命令替换。
	backtickRe = regexp.MustCompile("`[^`]+`")
	// pipeToShellRe 检测管道到 shell 的危险模式。
	pipeToShellRe = regexp.MustCompile(`\|\s*(bash|sh|zsh|fish)\b`)
	// redirectToExternalRe 检测重定向到 /tmp、/etc、/dev 等外部路径。
	redirectToExternalRe = regexp.MustCompile(`>\s*(/tmp/|/etc/|/dev/|/var/|/opt/|/usr/)`)
	// redirectFromExternalRe 检测从外部路径重定向输入。
	redirectFromExternalRe = regexp.MustCompile(`<\s*(/tmp/|/etc/|/dev/|/var/|/opt/|/usr/)`)
)

// checkDangerousPatterns 检查危险模式：$() 命令替换、反引号、管道到 shell 等。
func checkDangerousPatterns(command string) error {
	command = strings.TrimSpace(command)
	if command == "" {
		return fmt.Errorf("空命令")
	}

	// 命令替换 $(...)
	if commandSubstitutionRe.MatchString(command) {
		return fmt.Errorf("禁止 $() 命令替换: %s", commandSubstitutionRe.FindString(command))
	}

	// 反引号命令替换
	if backtickRe.MatchString(command) {
		return fmt.Errorf("禁止反引号命令替换: %s", backtickRe.FindString(command))
	}

	// 管道到 shell
	if pipeToShellRe.MatchString(command) {
		return fmt.Errorf("禁止管道到 shell 解释器: %s", pipeToShellRe.FindString(command))
	}

	// 重定向到外部路径
	if redirectToExternalRe.MatchString(command) {
		return fmt.Errorf("禁止重定向到系统路径: %s", redirectToExternalRe.FindString(command))
	}

	// 从外部路径重定向输入
	if redirectFromExternalRe.MatchString(command) {
		return fmt.Errorf("禁止从系统路径重定向输入: %s", redirectFromExternalRe.FindString(command))
	}

	// 检查链式执行危险命令（如 ls; rm -rf /）
	// 只检查分号分隔、&&、|| 后是否跟禁止命令
	if err := checkChainedDangerousCommands(command); err != nil {
		return err
	}

	return nil
}

// checkChainedDangerousCommands 检查链式执行中的危险命令。
func checkChainedDangerousCommands(command string) error {
	// 用分号、&&、|| 分割命令
	separators := regexp.MustCompile(`[;&|]{1,2}\s*`)
	segments := separators.Split(command, -1)

	for _, segment := range segments {
		trimmed := strings.TrimSpace(segment)
		if trimmed == "" {
			continue
		}
		baseCmd := extractBaseCommand(trimmed)
		if baseCmd == "" {
			continue
		}
		if bannedCommands[baseCmd] {
			return fmt.Errorf("链式执行中包含禁止命令: %s", baseCmd)
		}
	}

	return nil
}

// validateBashTimeout 验证超时设置是否在允许范围内（1-120 秒）。
func validateBashTimeout(timeout int) error {
	if timeout < 1 {
		return fmt.Errorf("超时值 %d 过小，最小为 1 秒", timeout)
	}
	if timeout > 120 {
		return fmt.Errorf("超时值 %d 过大，最大为 120 秒", timeout)
	}
	return nil
}

// resolveBashTimeout 解析实际使用的超时值，应用默认值 30 秒。
func resolveBashTimeout(timeout int) (int, error) {
	if timeout <= 0 {
		timeout = 30
	}
	if err := validateBashTimeout(timeout); err != nil {
		return 30, err
	}
	return timeout, nil
}

// formatBashTimeoutDuration 将超时秒数转换为 time.Duration。
func formatBashTimeoutDuration(timeout int) time.Duration {
	if timeout <= 0 {
		timeout = 30
	}
	return time.Duration(timeout) * time.Second
}

// maxBashOutputBytes Bash 命令输出的最大字节数（1MB）。
const maxBashOutputBytes = 1024 * 1024
