package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
)

func runNodeReport(ctx context.Context, node, script, name, root, sacRoot string,
	warmups, iterations int) implementationReport {
	command := exec.CommandContext(ctx, node, "--expose-gc", script,
		"--implementation", name,
		"--root", root,
		"--sac-root", sacRoot,
		"--warmups", strconv.Itoa(warmups),
		"--iterations", strconv.Itoa(iterations))
	var stdout, stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return implementationReport{Name: name, Error: fmt.Sprintf("%v: %s", err, stderr.String())}
	}
	var report implementationReport
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		return implementationReport{Name: name, Error: fmt.Sprintf("decode Node result: %v: %s", err, stdout.String())}
	}
	return report
}
