package fileprovider

import (
	"encoding/csv"
	"errors"
	"io"
	pathpkg "path"
	"strconv"
	"strings"
)

// ParseEFU parses the CSV form emitted by Everything's file-list exporter.
// Rows are never deduplicated; malformed values stay attached to their row.
func ParseEFU(reader io.Reader) ([]Asset, []AssetIssue, error) {
	if reader == nil {
		return nil, nil, ErrEFUHeader
	}
	csvReader := csv.NewReader(reader)
	csvReader.FieldsPerRecord = -1
	csvReader.TrimLeadingSpace = true
	header, err := csvReader.Read()
	if errors.Is(err, io.EOF) || len(header) == 0 {
		return nil, nil, ErrEFUHeader
	}
	if err != nil && len(header) == 0 {
		return nil, nil, ErrEFUHeader
	}
	columns := make(map[string]int, len(header))
	for index, value := range header {
		columns[normalizeColumn(value)] = index
	}
	filenameColumn, ok := columns["filename"]
	if !ok {
		return nil, nil, ErrEFUHeader
	}
	assets := make([]Asset, 0)
	issues := make([]AssetIssue, 0)
	line := 1
	for {
		record, readErr := csvReader.Read()
		if errors.Is(readErr, io.EOF) {
			break
		}
		line++
		if readErr != nil {
			issues = append(issues, AssetIssue{Line: line, Code: "csv", Message: readErr.Error()})
			if record == nil {
				continue
			}
		}
		if len(record) == 0 || allEmpty(record) {
			continue
		}
		filename := field(record, filenameColumn)
		if strings.TrimSpace(filename) == "" {
			issues = append(issues, AssetIssue{Line: line, Code: "missing-filename", Message: "Filename is empty"})
			continue
		}
		normalizedPath := strings.ReplaceAll(strings.TrimSpace(filename), "\\", "/")
		name := pathpkg.Base(normalizedPath)
		asset := Asset{
			ID:        "efu:" + normalizedPath,
			Name:      name,
			Path:      normalizedPath,
			Extension: extension(normalizedPath),
		}
		if sizeIndex, exists := columns["size"]; exists {
			var issue AssetIssue
			asset.Size, issue = parseEFUNumber(field(record, sizeIndex), line, "invalid-size")
			if issue.Code != "" {
				asset.Issues = append(asset.Issues, issue)
			}
		}
		if modifiedIndex, exists := columns["datemodified"]; exists {
			var issue AssetIssue
			asset.Modified, issue = parseEFUTime(field(record, modifiedIndex), line, "invalid-date-modified")
			if issue.Code != "" {
				asset.Issues = append(asset.Issues, issue)
			}
		}
		if createdIndex, exists := columns["datecreated"]; exists {
			var issue AssetIssue
			asset.Created, issue = parseEFUTime(field(record, createdIndex), line, "invalid-date-created")
			if issue.Code != "" {
				asset.Issues = append(asset.Issues, issue)
			}
		}
		assets = append(assets, asset)
	}
	return assets, issues, nil
}

func ParseEFUBytes(data []byte) ([]Asset, []AssetIssue, error) {
	return ParseEFU(strings.NewReader(strings.TrimPrefix(string(data), "\uFEFF")))
}

func normalizeColumn(value string) string {
	value = strings.ToLower(strings.TrimSpace(strings.Trim(value, "\"")))
	var builder strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

func field(record []string, index int) string {
	if index < 0 || index >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[index])
}

func allEmpty(record []string) bool {
	for _, value := range record {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func parseEFUNumber(value string, line int, code string) (int64, AssetIssue) {
	if strings.TrimSpace(value) == "" {
		return 0, AssetIssue{}
	}
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed < 0 {
		if err == nil {
			err = strconv.ErrSyntax
		}
		return 0, AssetIssue{Line: line, Code: code, Message: err.Error()}
	}
	return parsed, AssetIssue{}
}

func parseEFUTime(value string, line int, code string) (int64, AssetIssue) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, AssetIssue{}
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed < 0 {
		if err == nil {
			err = strconv.ErrSyntax
		}
		return 0, AssetIssue{Line: line, Code: code, Message: err.Error()}
	}
	if parsed >= fileTimeThreshold {
		return parsed/10000 - fileTimeEpochMilliseconds, AssetIssue{}
	}
	return parsed, AssetIssue{}
}
