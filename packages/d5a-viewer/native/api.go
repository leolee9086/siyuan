package d5a

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// InspectionReport is the stable report returned by the D5A/GLB inspection
// pipeline.  The report is intentionally shared with the CLI so that the
// file-browser adapter and the standalone tool observe identical diagnostics.
type InspectionReport = sceneInspectionReport

// ExtractionReport is the atomic D5A archive extraction result.
type ExtractionReport = extractionReport

// InspectFile parses a local D5A or GLB file and returns its structural report.
// The input is normalized to an absolute path before parsing.
func InspectFile(path string) (*InspectionReport, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	format, err := sceneFormat(absolute)
	if err != nil {
		return nil, err
	}
	if format == "d5a" {
		return inspectD5A(absolute)
	}
	return inspectGLB(absolute)
}

// InspectFileJSON returns the versioned structural report without exposing
// the parser's internal Go type graph to HTTP adapters.
func InspectFileJSON(path string) ([]byte, error) {
	report, err := InspectFile(path)
	if err != nil {
		return nil, err
	}
	return json.Marshal(report)
}

// InspectD5A parses a D5A container without routing through the GLB detector.
func InspectD5A(path string) (*InspectionReport, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	return inspectD5A(absolute)
}

// InspectD5Mesh parses a standalone D5Mesh payload with the same version and
// boundary checks used for a D5A bundle.
func InspectD5Mesh(path string) (*InspectionReport, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	metadata, err := os.Stat(absolute)
	if err != nil {
		return nil, err
	}
	stream, err := os.Open(absolute)
	if err != nil {
		return nil, err
	}
	started := time.Now()
	parsed, parseErr := parseD5MeshStream(stream, metadata.Size())
	closeErr := stream.Close()
	if parseErr == nil {
		parseErr = closeErr
	}
	if parseErr != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(absolute), parseErr)
	}
	warnings := append([]string(nil), parsed.warnings...)
	report := &sceneInspectionReport{
		SchemaVersion: 1,
		DocumentKind:  "mesh",
		Operation:     "inspect",
		Status:        "pass",
		Format:        "d5mesh",
		File:          summarizeFile(absolute, metadata),
		ElapsedMS:     float64(time.Since(started).Microseconds()) / 1000,
		Warnings:      warnings,
		D5A: &d5aInspection{
			Variant: "d5mesh", EntryCount: 1, FileEntryCount: 1,
			CompressedBytes: uint64(metadata.Size()), UncompressedBytes: uint64(metadata.Size()),
			Bundles: []d5aBundleInspection{{
				ID: "", MeshEntry: filepath.Base(absolute), Status: "parsed",
				Mesh: &parsed.summary, Warnings: warnings,
			}},
		},
		Runtime: runtimeSince(started),
	}
	if len(warnings) > 0 {
		report.Status = "warning"
	}
	return report, nil
}

// InspectD5MeshJSON is the JSON adapter used by file-browser integrations.
func InspectD5MeshJSON(path string) ([]byte, error) {
	report, err := InspectD5Mesh(path)
	if err != nil {
		return nil, err
	}
	return json.Marshal(report)
}

// ValidateD5A parses and applies the D5A validation summary to a report.
func ValidateD5A(path string) (*InspectionReport, error) {
	report, err := InspectD5A(path)
	if err != nil {
		return nil, err
	}
	validateD5A(report)
	return report, nil
}

// ExtractD5A exposes the same atomic extraction path used by d5-tool.
func ExtractD5A(input, outputDirectory string, requested []string, overwrite bool) (*ExtractionReport, error) {
	return extractD5A(input, outputDirectory, requested, overwrite)
}

// Run executes the standalone command dispatcher without requiring callers to
// duplicate command routing.  The command-line wrapper owns process exit.
func Run(argv []string) error {
	return run(argv)
}
