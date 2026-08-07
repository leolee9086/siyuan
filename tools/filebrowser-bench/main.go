package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

func main() {
	root := flag.String("root", `D:\`, "待遍历根目录")
	fixture := flag.Bool("fixture", true, "创建小规模真实文件夹用于开发验证")
	shape := flag.String("fixture-shape", "balanced", "小规模样本形状：balanced、wide、deep 或 empty")
	parents := flag.Int("fixture-parents", 24, "小规模样本的一级目录数")
	branches := flag.Int("fixture-branches", 2, "每个一级目录的二级目录数")
	files := flag.Int("fixture-files", 24, "每个二级目录的文件数")
	count := flag.Int("fixture-count", 4096, "wide 文件数或 empty 目录数")
	depth := flag.Int("fixture-depth", 96, "deep 样本深度")
	warmups := flag.Int("warmups", 1, "每个实现的热身次数")
	iterations := flag.Int("iterations", 3, "每个实现的计时次数")
	timeout := flag.Duration("timeout", 2*time.Hour, "每个实现的最长运行时间")
	only := flag.String("only", "", "以逗号分隔的实现名称")
	node := flag.String("node", "node", "Node.js 可执行文件")
	sacRoot := flag.String("sac-root", `D:\dev\SACAssetsManager`, "SACAssetsManager 最终检出路径")
	output := flag.String("output", "", "可选 JSON 结果路径")
	flag.Parse()

	if *iterations < 1 || *warmups < 0 {
		fatalf("iterations 必须大于 0，warmups 不能为负数")
	}
	var expected *snapshot
	var config *fixtureConfig
	if *fixture {
		value := fixtureConfig{Shape: strings.ToLower(strings.TrimSpace(*shape))}
		switch value.Shape {
		case "balanced":
			value.Parents, value.Branches, value.Files = *parents, *branches, *files
		case "wide", "empty":
			value.Count = *count
		case "deep":
			value.Depth = *depth
		}
		created, err := makeFixture(value)
		if err != nil {
			fatalf("创建样本失败：%v", err)
		}
		defer os.RemoveAll(created.Root)
		*root = created.Root
		expected = &created.Expected
		config = &value
	}
	absoluteRoot, err := filepath.Abs(*root)
	if err != nil {
		fatalf("解析根目录失败：%v", err)
	}
	selected := parseSelection(*only)
	report := benchmarkReport{CreatedAt: time.Now(), Root: absoluteRoot, Fixture: *fixture,
		FixtureConfig: config, Expected: expected, Warmups: *warmups, Iterations: *iterations}

	for _, implementation := range goImplementations() {
		if !selectedImplementation(selected, implementation.Name) {
			continue
		}
		fmt.Fprintf(os.Stderr, "运行 %s...\n", implementation.Name)
		ctx, cancel := context.WithTimeout(context.Background(), *timeout)
		value := runGoReport(ctx, implementation, absoluteRoot, *warmups, *iterations)
		cancel()
		report.Reports = append(report.Reports, value)
	}

	script, err := filepath.Abs("node-bench.mjs")
	if err != nil {
		fatalf("解析 Node 基准脚本失败：%v", err)
	}
	for _, name := range []string{"sac-fdir-modified", "fdir-stock", "fast-glob-promise", "fast-glob-stream"} {
		if !selectedImplementation(selected, name) {
			continue
		}
		fmt.Fprintf(os.Stderr, "运行 %s...\n", name)
		ctx, cancel := context.WithTimeout(context.Background(), *timeout)
		value := runNodeReport(ctx, *node, script, name, absoluteRoot, *sacRoot, *warmups, *iterations)
		cancel()
		report.Reports = append(report.Reports, value)
	}

	markMatches(&report)
	printTable(report)
	if *output != "" {
		if err = writeReport(*output, report); err != nil {
			fatalf("写入结果失败：%v", err)
		}
		fmt.Fprintf(os.Stderr, "结果已写入 %s\n", *output)
	}
}

func parseSelection(raw string) map[string]bool {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	result := map[string]bool{}
	for _, name := range strings.Split(raw, ",") {
		result[strings.TrimSpace(name)] = true
	}
	return result
}

func selectedImplementation(selection map[string]bool, name string) bool {
	return selection == nil || selection[name]
}

func markMatches(report *benchmarkReport) {
	target := report.Expected
	if target != nil {
		report.ComparisonTarget = "fixture-manifest"
	} else {
		for index := range report.Reports {
			if report.Reports[index].Name == "filepath-walkdir" && report.Reports[index].Error == "" {
				value := report.Reports[index].Validation.Snapshot
				target = &value
				report.ComparisonTarget = "filepath-walkdir-live-snapshot"
				break
			}
		}
	}
	if target == nil {
		return
	}
	for index := range report.Reports {
		if report.Reports[index].Error != "" {
			continue
		}
		value := report.Reports[index].Validation.Snapshot
		pathSetMatches := pathSetsMatch(value, *target)
		typeCountsMatch := typeCountsMatch(value, *target)
		stable := samplesMatchValidation(report.Reports[index])
		report.Reports[index].PathSetMatches = &pathSetMatches
		report.Reports[index].TypeCountsMatch = &typeCountsMatch
		if value.ErrorsKnown && target.ErrorsKnown {
			errorCountMatch := value.Errors == target.Errors
			report.Reports[index].ErrorCountMatch = &errorCountMatch
		}
		report.Reports[index].Stable = &stable
	}
}

func snapshotsMatch(left, right snapshot) bool {
	return pathSetsMatch(left, right) && typeCountsMatch(left, right)
}

func pathSetsMatch(left, right snapshot) bool {
	return left.Entries == right.Entries && left.Digest == right.Digest
}

func typeCountsMatch(left, right snapshot) bool {
	return left.Files == right.Files && left.Directories == right.Directories
}

func samplesMatchValidation(report implementationReport) bool {
	want := report.Validation.Snapshot
	for _, sample := range report.Samples {
		got := sample.Snapshot
		if got.Entries != want.Entries || got.Files != want.Files || got.Directories != want.Directories ||
			(got.ErrorsKnown && want.ErrorsKnown && got.Errors != want.Errors) {
			return false
		}
	}
	return true
}

func printTable(report benchmarkReport) {
	fmt.Printf("root=%s fixture=%t warmups=%d iterations=%d\n", report.Root, report.Fixture, report.Warmups, report.Iterations)
	fmt.Printf("%-25s %12s %12s %12s %10s %7s %7s %7s %7s\n", "implementation", "median-ms",
		"entries", "errors", "alloc-MiB", "paths", "types", "err", "stable")
	for _, value := range report.Reports {
		if value.Error != "" {
			fmt.Printf("%-25s ERROR %s\n", value.Name, value.Error)
			continue
		}
		durations := make([]int64, len(value.Samples))
		allocations := uint64(0)
		for index, sample := range value.Samples {
			durations[index] = sample.ElapsedNanoseconds
			allocations += sample.AllocatedBytes
		}
		sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
		median := float64(durations[len(durations)/2]) / float64(time.Millisecond)
		allocated := "n/a"
		if len(value.Samples) > 0 && value.Samples[0].AllocationKnown {
			allocated = fmt.Sprintf("%.2f", float64(allocations)/float64(len(value.Samples))/(1024*1024))
		}
		pathMatch := "n/a"
		if value.PathSetMatches != nil {
			pathMatch = fmt.Sprint(*value.PathSetMatches)
		}
		typeMatch := "n/a"
		if value.TypeCountsMatch != nil {
			typeMatch = fmt.Sprint(*value.TypeCountsMatch)
		}
		errorMatch := "n/a"
		if value.ErrorCountMatch != nil {
			errorMatch = fmt.Sprint(*value.ErrorCountMatch)
		}
		stable := "n/a"
		if value.Stable != nil {
			stable = fmt.Sprint(*value.Stable)
		}
		fmt.Printf("%-25s %12.2f %12d %12d %10s %7s %7s %7s %7s\n", value.Name, median,
			value.Validation.Snapshot.Entries, value.Validation.Snapshot.Errors, allocated,
			pathMatch, typeMatch, errorMatch, stable)
	}
}

func writeReport(path string, report benchmarkReport) error {
	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(encoded, '\n'), 0600)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
