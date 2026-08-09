package d5a

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"runtime"
	"strings"
)

var version = "0.1.0-dev"

// webContent is populated from dist/ by the native build script.
//
//go:embed web
var embeddedWeb embed.FS

func main() {
	if errorValue := run(os.Args[1:]); errorValue != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", errorValue)
		os.Exit(1)
	}
}

func run(argv []string) error {
	if len(argv) == 0 || containsAny(argv, "--help", "-h") {
		printUsage()
		return nil
	}
	if argv[0] == "--version" || argv[0] == "-v" {
		fmt.Printf("d5-tool %s\n", version)
		return nil
	}
	switch argv[0] {
	case "capabilities":
		return capabilitiesCommand(argv[1:])
	case "inspect":
		return inspectCommand(argv[1:], "inspect")
	case "validate":
		return inspectCommand(argv[1:], "validate")
	case "extract":
		return extractCommand(argv[1:])
	case "convert":
		return convertCommand(argv[1:])
	case "serve":
		return serveCommand(argv[1:])
	case "view":
		return viewCommand(argv[1:])
	default:
		return fmt.Errorf("未知命令 %s", argv[0])
	}
}

func capabilitiesCommand(argv []string) error {
	args, errorValue := parseArguments(argv, nil, []string{"json"})
	if errorValue != nil {
		return errorValue
	}
	if len(args.positionals) > 0 {
		return fmt.Errorf("capabilities 不接受位置参数")
	}
	result := map[string]any{
		"schemaVersion": 1,
		"host":          "go",
		"runtime":       runtime.Version() + " " + runtime.GOOS + "/" + runtime.GOARCH,
		"singleBinary":  true,
		"nodeRuntime":   false,
		"webUi":         map[string]any{"serve": true, "localOnly": true, "embedded": true, "sceneExports": []string{"glb", "d5a", "dxf"}},
		"formats": []map[string]any{
			{"format": "d5a", "documentKind": "scene", "operations": []string{"inspect", "view", "validate", "extract", "convert:dxf"}, "streamingInput": true, "streamingOutput": true, "structuralReport": true},
			{"format": "glb", "documentKind": "scene", "operations": []string{"inspect", "view", "validate", "convert:dxf"}, "validator": "native glTF 2 structural validator", "streamingInput": true},
			{"format": "dxf", "documentKind": "scene", "operations": []string{"write"}, "geometry": "3DFACE", "units": "meters", "streamingOutput": true, "structuralReport": true},
		},
	}
	if args.flags["json"] {
		return printJSON(result)
	}
	fmt.Println("D5A 场景: inspect, view, validate, extract, convert:dxf")
	fmt.Println("GLB 场景: inspect, view, validate, convert:dxf")
	fmt.Println("DXF 场景: write (3DFACE / meters)")
	fmt.Println("Go 原生单一二进制 / 内嵌本地 WebUI / 无 Node 运行时")
	return nil
}

func embeddedWebFS() (fs.FS, error) {
	return fs.Sub(embeddedWeb, "web")
}

func containsAny(values []string, targets ...string) bool {
	for _, value := range values {
		for _, target := range targets {
			if value == target {
				return true
			}
		}
	}
	return false
}

func printUsage() {
	lines := []string{
		"D5 Asset Studio 原生 CLI",
		"",
		"用法:",
		"  d5-tool capabilities [--json]",
		"  d5-tool inspect <输入.d5a|输入.glb> [--report <报告.json>] [--json]",
		"  d5-tool validate <输入.d5a|输入.glb> [--report <报告.json>] [--json]",
		"  d5-tool convert <输入.d5a|输入.glb> --output <输出.dxf> [--report <报告.json>] [--overwrite] [--json]",
		"  d5-tool extract <输入.d5a> --output <目录> [--entry <归档路径>] [--overwrite] [--json]",
		"  d5-tool serve [--host 127.0.0.1] [--port 5329] [--state <状态.json>] [--open] [--json]",
		"  d5-tool view <输入.d5a|输入.glb> [--host 127.0.0.1] [--port 5329] [--open] [--json]",
	}
	fmt.Println(strings.Join(lines, "\n"))
}
