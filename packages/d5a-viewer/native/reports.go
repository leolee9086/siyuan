package d5a

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

type fileSummary struct {
	Name         string `json:"name"`
	Bytes        int64  `json:"bytes"`
	LastModified int64  `json:"lastModified"`
}

type runtimeSummary struct {
	ElapsedMS       float64 `json:"elapsedMs"`
	GoAllocated     uint64  `json:"goAllocatedBytes"`
	GoHeapInUse     uint64  `json:"goHeapInUseBytes"`
	GoSystemBytes   uint64  `json:"goSystemBytes"`
	PeakAllocated   uint64  `json:"peakGoAllocatedBytes,omitempty"`
	PeakHeapInUse   uint64  `json:"peakGoHeapInUseBytes,omitempty"`
	PeakSystemBytes uint64  `json:"peakGoSystemBytes,omitempty"`
}

type runtimePeak struct {
	allocated uint64
	heapInUse uint64
	system    uint64
}

func (peak *runtimePeak) sample() {
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	if memory.Alloc > peak.allocated {
		peak.allocated = memory.Alloc
	}
	if memory.HeapInuse > peak.heapInUse {
		peak.heapInUse = memory.HeapInuse
	}
	if memory.Sys > peak.system {
		peak.system = memory.Sys
	}
}

type validationMessage struct {
	Severity string `json:"severity"`
	Code     string `json:"code"`
	Message  string `json:"message"`
	Pointer  string `json:"pointer,omitempty"`
}

type validationSummary struct {
	Engine       string              `json:"engine"`
	ErrorCount   int                 `json:"errorCount"`
	WarningCount int                 `json:"warningCount"`
	InfoCount    int                 `json:"infoCount,omitempty"`
	HintCount    int                 `json:"hintCount,omitempty"`
	Messages     []validationMessage `json:"messages"`
}

type sceneInspectionReport struct {
	SchemaVersion int                `json:"schemaVersion"`
	DocumentKind  string             `json:"documentKind"`
	Operation     string             `json:"operation"`
	Status        string             `json:"status"`
	Format        string             `json:"format"`
	File          fileSummary        `json:"file"`
	ElapsedMS     float64            `json:"elapsedMs"`
	Warnings      []string           `json:"warnings"`
	D5A           *d5aInspection     `json:"d5a,omitempty"`
	GLB           *glbInspection     `json:"glb,omitempty"`
	Validation    *validationSummary `json:"validation,omitempty"`
	Runtime       runtimeSummary     `json:"runtime"`
}

func runtimeSince(started time.Time) runtimeSummary {
	return runtimeSinceWithPeak(started, nil)
}

func runtimeSinceWithPeak(started time.Time, peak *runtimePeak) runtimeSummary {
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	result := runtimeSummary{
		ElapsedMS:     float64(time.Since(started).Microseconds()) / 1000,
		GoAllocated:   memory.Alloc,
		GoHeapInUse:   memory.HeapInuse,
		GoSystemBytes: memory.Sys,
	}
	if peak != nil {
		peak.sample()
		result.PeakAllocated = peak.allocated
		result.PeakHeapInUse = peak.heapInUse
		result.PeakSystemBytes = peak.system
	}
	return result
}

func printJSON(value any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func writeJSONAtomically(path string, value any) error {
	absolute, errorValue := filepath.Abs(path)
	if errorValue != nil {
		return errorValue
	}
	if errorValue = os.MkdirAll(filepath.Dir(absolute), 0o755); errorValue != nil {
		return errorValue
	}
	temporary, errorValue := os.CreateTemp(filepath.Dir(absolute), filepath.Base(absolute)+".*.partial.json")
	if errorValue != nil {
		return errorValue
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		_ = temporary.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()
	encoder := json.NewEncoder(temporary)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if errorValue = encoder.Encode(value); errorValue != nil {
		return errorValue
	}
	if errorValue = temporary.Sync(); errorValue != nil {
		return errorValue
	}
	if errorValue = temporary.Close(); errorValue != nil {
		return errorValue
	}
	if errorValue = replaceFile(temporaryPath, absolute, true); errorValue != nil {
		return errorValue
	}
	committed = true
	return nil
}

func replaceFile(source, destination string, overwrite bool) error {
	if _, errorValue := os.Stat(destination); errorValue == nil {
		if !overwrite {
			return fmt.Errorf("输出已存在：%s；使用 --overwrite 覆盖", destination)
		}
		if errorValue = os.Remove(destination); errorValue != nil {
			return errorValue
		}
	} else if !os.IsNotExist(errorValue) {
		return errorValue
	}
	return os.Rename(source, destination)
}
