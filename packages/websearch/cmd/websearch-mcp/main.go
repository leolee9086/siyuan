// websearch-mcp 是 websearch 包的独立 MCP server。
//
// 它以独立服务的形式，把 s-forge 内核内部使用的同一套搜索能力暴露给任何
// 标准 MCP 客户端（Claude Desktop、Cursor 等）。内核与本服务共享 websearch
// Go 模块，但除此之外完全解耦。
//
// 传输：
//   - stdio（默认）：stdin/stdout 上换行分隔的 JSON-RPC
//   - streamable HTTP（2025-06-18）：-http-addr :8080 提供 /mcp
//
// 配置优先级：命令行 flags > 环境变量 > 可选 JSON 配置文件（-config）> 包默认值。
package main

import (
	"fmt"
	"log"
	"os"

	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

func main() {
	cfg, err := loadConfig(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, "websearch-mcp:", err)
		fmt.Fprintln(os.Stderr, "try 'websearch-mcp -h' for usage")
		os.Exit(2)
	}
	if cfg.ShowVersion {
		fmt.Printf("websearch-mcp %s\n", shared.Version)
		return
	}

	logger := log.New(os.Stderr, "[websearch-mcp] ", log.LstdFlags)
	service := shared.NewService(cfg.runtimeConfig())
	server := NewServer(Deps{
		SearchFn: func(query string, opts shared.SearchOptions) (shared.SearchResponse, error) {
			return service.Search(query, opts, nil)
		},
		StatusFn: func(names []string, probe bool, query string) []shared.EngineDiagnostic {
			return service.Diagnose(names, probe, query)
		},
		Protect: cfg.ProtectURLs,
		Logger:  logger,
	})

	if cfg.HTTPAddr != "" {
		if err := runHTTP(server, cfg.HTTPAddr, logger); err != nil {
			logger.Fatalf("http server: %v", err)
		}
		return
	}
	if err := runStdio(server, logger); err != nil {
		logger.Fatalf("stdio server: %v", err)
	}
}
