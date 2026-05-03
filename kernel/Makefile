.PHONY: lint lint-files lint-golangci

lint: lint-files lint-golangci

lint-files:
	@echo "=== 文件行数检查 ==="
	@go run tools/filelinelimit/main.go

lint-golangci:
	@echo "=== golangci-lint 检查 ==="
	@which golangci-lint > /dev/null 2>&1 || (echo "golangci-lint 未安装，跳过"; exit 0)
	@golangci-lint run ./...
