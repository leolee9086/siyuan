package d5a

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func inspectCommand(argv []string, operation string) error {
	args, errorValue := parseArguments(argv, []string{"input", "report"}, []string{"json", "quiet"})
	if errorValue != nil {
		return errorValue
	}
	input := args.one("input")
	if input == "" && len(args.positionals) > 0 {
		input = args.positionals[0]
	}
	if input == "" {
		return fmt.Errorf("请提供待检查的 .d5a 或 .glb 文件")
	}
	if len(args.positionals) > 1 {
		return fmt.Errorf("场景检查只接受一个输入文件")
	}
	input, errorValue = filepath.Abs(input)
	if errorValue != nil {
		return errorValue
	}
	format, errorValue := sceneFormat(input)
	if errorValue != nil {
		return errorValue
	}
	started := time.Now()
	var report *sceneInspectionReport
	if format == "d5a" {
		report, errorValue = inspectD5A(input)
	} else {
		report, errorValue = inspectGLB(input)
	}
	if errorValue != nil {
		return errorValue
	}
	if operation == "validate" {
		if format == "d5a" {
			validateD5A(report)
		} else if errorValue = validateGLB(input, report); errorValue != nil {
			return errorValue
		}
	}
	report.ElapsedMS = float64(time.Since(started).Microseconds()) / 1000
	report.Runtime = runtimeSince(started)
	if reportPath := args.one("report"); reportPath != "" {
		if errorValue = writeJSONAtomically(reportPath, report); errorValue != nil {
			return errorValue
		}
	}
	if args.flags["json"] {
		if errorValue = printJSON(report); errorValue != nil {
			return errorValue
		}
	} else {
		printInspection(report, input, args.one("report"))
	}
	if operation == "validate" && (report.Status == "fail" || report.Status == "unsupported") {
		return fmt.Errorf("%s 校验结果为 %s", formatName(format), report.Status)
	}
	return nil
}

func printInspection(report *sceneInspectionReport, input, reportPath string) {
	fmt.Printf("%s: %s\n", filepath.Base(input), report.Status)
	if report.D5A != nil {
		fmt.Printf("D5A %s / %d 文件条目 / %.1f ms\n", report.D5A.Variant, report.D5A.FileEntryCount, report.ElapsedMS)
		for _, bundle := range report.D5A.Bundles {
			if bundle.Mesh != nil {
				fmt.Printf("%s: D5Mesh v%d / %d 面 / %d 顶点 / %d 实例描述符\n", bundle.MeshEntry, bundle.Mesh.Version, bundle.Mesh.TriangleCount, bundle.Mesh.VertexCount, bundle.Mesh.DescriptorCount)
			}
		}
	}
	if report.GLB != nil {
		fmt.Printf("GLB %d / %d 面 / %d 网格 / %d 材质 / %.1f ms\n", report.GLB.Version, report.GLB.TriangleCount, report.GLB.MeshCount, report.GLB.MaterialCount, report.ElapsedMS)
	}
	if report.Validation != nil {
		fmt.Printf("校验 %s: %d 错误 / %d 警告\n", report.Validation.Engine, report.Validation.ErrorCount, report.Validation.WarningCount)
	}
	for _, warning := range report.Warnings {
		fmt.Printf("警告: %s\n", warning)
	}
	if reportPath != "" {
		absolute, _ := filepath.Abs(reportPath)
		fmt.Printf("报告 %s\n", absolute)
	}
}

func extractCommand(argv []string) error {
	args, errorValue := parseArguments(argv, []string{"input", "output", "entry", "report"}, []string{"overwrite", "json", "quiet"})
	if errorValue != nil {
		return errorValue
	}
	input := args.one("input")
	if input == "" && len(args.positionals) > 0 {
		input = args.positionals[0]
	}
	if input == "" {
		return fmt.Errorf("请提供待解包的 .d5a 文件")
	}
	if len(args.positionals) > 1 {
		return fmt.Errorf("场景解包只接受一个输入文件")
	}
	if args.one("output") == "" {
		return fmt.Errorf("--output 需要值")
	}
	input, errorValue = filepath.Abs(input)
	if errorValue != nil {
		return errorValue
	}
	if filepath.Ext(input) != ".d5a" && filepath.Ext(input) != ".D5A" {
		return fmt.Errorf("extract 只支持 .d5a 容器")
	}
	output, errorValue := filepath.Abs(args.one("output"))
	if errorValue != nil {
		return errorValue
	}
	report, errorValue := extractD5A(input, output, args.many("entry"), args.flags["overwrite"])
	if errorValue != nil {
		return errorValue
	}
	if reportPath := args.one("report"); reportPath != "" {
		if errorValue = writeJSONAtomically(reportPath, report); errorValue != nil {
			return errorValue
		}
	}
	if args.flags["json"] {
		return printJSON(report)
	}
	fmt.Printf("%s: 解包 %d 项到 %s\n", filepath.Base(input), len(report.Entries), output)
	fmt.Printf("用时 %.1f ms\n", report.ElapsedMS)
	if reportPath := args.one("report"); reportPath != "" {
		absolute, _ := filepath.Abs(reportPath)
		fmt.Printf("报告 %s\n", absolute)
	}
	return nil
}

func formatName(format string) string {
	return map[string]string{"d5a": "D5A", "glb": "GLB", "dxf": "DXF"}[format]
}

func pathExists(path string) bool {
	_, errorValue := os.Stat(path)
	return errorValue == nil
}
