package main

import (
	"bufio"
	"bytes"
	"log"
	"os"
)

// runStdio 提供 MCP stdio 传输：stdin/stdout 上换行分隔的 JSON-RPC。
// 所有日志只走 stderr，保证 stdout 保持协议纯净。
func runStdio(s *Server, logger *log.Logger) error {
	logger.Printf("starting stdio transport (MCP protocol %s)", defaultProtocolVersion)
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		resp, notification := s.Handle(line)
		if notification {
			continue
		}
		if _, err := os.Stdout.Write(append(append([]byte{}, resp...), '\n')); err != nil {
			return err
		}
		// MCP 客户端增量读取，每应答后立即刷新。
		if err := os.Stdout.Sync(); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	logger.Printf("stdio transport closed")
	return nil
}
