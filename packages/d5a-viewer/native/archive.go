package d5a

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf16"
)

type d5aEntryInspection struct {
	Filename         string `json:"filename"`
	CompressedSize   uint64 `json:"compressedSize"`
	UncompressedSize uint64 `json:"uncompressedSize"`
	Encrypted        bool   `json:"encrypted"`
	Directory        bool   `json:"directory"`
}

type d5MaterialSummary struct {
	Title                 string  `json:"title"`
	InfoVersion           float64 `json:"infoVersion,omitempty"`
	MaterialCount         int     `json:"materialCount"`
	TextureReferenceCount int     `json:"textureReferenceCount"`
}

type d5aBundleInspection struct {
	ID        string             `json:"id"`
	MeshEntry string             `json:"meshEntry"`
	InfoEntry string             `json:"infoEntry,omitempty"`
	Status    string             `json:"status"`
	Mesh      *d5MeshSummary     `json:"mesh,omitempty"`
	Material  *d5MaterialSummary `json:"material,omitempty"`
	Warnings  []string           `json:"warnings"`
}

type d5aLegacyFBXInspection struct {
	Entry            string `json:"entry"`
	Bytes            uint64 `json:"bytes"`
	MaterialXMLEntry string `json:"materialXmlEntry,omitempty"`
}

type d5aInspection struct {
	Variant             string                  `json:"variant"`
	EntryCount          int                     `json:"entryCount"`
	FileEntryCount      int                     `json:"fileEntryCount"`
	EncryptedEntryCount int                     `json:"encryptedEntryCount"`
	CompressedBytes     uint64                  `json:"compressedBytes"`
	UncompressedBytes   uint64                  `json:"uncompressedBytes"`
	GroupInfoEntry      string                  `json:"groupInfoEntry,omitempty"`
	LegacyFBX           *d5aLegacyFBXInspection `json:"legacyFbx,omitempty"`
	Bundles             []d5aBundleInspection   `json:"bundles"`
	Entries             []d5aEntryInspection    `json:"entries,omitempty"`
}

type archiveBundle struct {
	id       string
	prefix   string
	mesh     *zip.File
	info     *zip.File
	icon     *zip.File
	material *zip.File
}

func inspectD5A(path string) (*sceneInspectionReport, error) {
	started := time.Now()
	metadata, errorValue := os.Stat(path)
	if errorValue != nil {
		return nil, errorValue
	}
	archive, errorValue := zip.OpenReader(path)
	if errorValue != nil {
		return nil, fmt.Errorf("打开 D5A ZIP 失败: %w", errorValue)
	}
	defer archive.Close()
	inspection, warnings, errorValue := inspectD5AArchive(&archive.Reader)
	if errorValue != nil {
		return nil, errorValue
	}
	report := &sceneInspectionReport{
		SchemaVersion: 1,
		DocumentKind:  "scene",
		Operation:     "inspect",
		Status:        "pass",
		Format:        "d5a",
		File:          summarizeFile(path, metadata),
		Warnings:      warnings,
		D5A:           inspection,
	}
	if inspection.Variant == "encrypted" || inspection.Variant == "unknown" {
		report.Status = "unsupported"
	} else {
		for _, bundle := range inspection.Bundles {
			if bundle.Status == "protected" {
				report.Status = "unsupported"
				break
			}
		}
		if report.Status == "pass" && len(warnings) > 0 {
			report.Status = "warning"
		}
	}
	report.ElapsedMS = float64(time.Since(started).Microseconds()) / 1000
	return report, nil
}

func inspectD5AArchive(archive *zip.Reader) (*d5aInspection, []string, error) {
	files := make([]*zip.File, 0, len(archive.File))
	entries := make([]d5aEntryInspection, 0, len(archive.File))
	lookup := map[string]*zip.File{}
	var compressedBytes uint64
	var uncompressedBytes uint64
	var encryptedCount int
	for _, entry := range archive.File {
		directory := entry.FileInfo().IsDir() || strings.HasSuffix(entry.Name, "/")
		encrypted := entry.Flags&1 != 0
		entries = append(entries, d5aEntryInspection{
			Filename: entry.Name, CompressedSize: entry.CompressedSize64, UncompressedSize: entry.UncompressedSize64,
			Encrypted: encrypted, Directory: directory,
		})
		if directory {
			continue
		}
		files = append(files, entry)
		canonical := canonicalArchivePath(entry.Name)
		if _, exists := lookup[canonical]; !exists {
			lookup[canonical] = entry
		}
		compressedBytes += entry.CompressedSize64
		uncompressedBytes += entry.UncompressedSize64
		if encrypted {
			encryptedCount++
		}
	}
	warnings := []string{}
	if len(files) == 0 {
		warnings = append(warnings, "容器内没有文件条目")
	}
	bundles := collectArchiveBundles(files, lookup)
	if len(bundles) > 1 {
		warnings = append(warnings, fmt.Sprintf("检测到 %d 个 D5Mesh 子包，将按根分组信息合并加载", len(bundles)))
	}
	fbxFiles := findArchiveSuffix(files, ".fbx")
	if len(fbxFiles) > 1 {
		warnings = append(warnings, fmt.Sprintf("容器包含 %d 个 FBX，仅加载第一个", len(fbxFiles)))
	}
	groupInfo := lookup["groupinfo.json"]
	criticalEncrypted := false
	for _, bundle := range bundles {
		criticalEncrypted = criticalEncrypted || archiveEntryEncrypted(bundle.mesh) || archiveEntryEncrypted(bundle.info)
	}
	if len(fbxFiles) > 0 {
		criticalEncrypted = criticalEncrypted || archiveEntryEncrypted(fbxFiles[0])
	}
	criticalEncrypted = criticalEncrypted || archiveEntryEncrypted(groupInfo)
	variant := "unknown"
	if criticalEncrypted {
		variant = "encrypted"
	} else if len(bundles) > 0 {
		variant = "d5mesh"
	} else if len(fbxFiles) > 0 {
		variant = "legacy-fbx"
	}
	resultBundles := make([]d5aBundleInspection, 0, len(bundles))
	for _, bundle := range bundles {
		bundleResult := d5aBundleInspection{ID: bundle.id, MeshEntry: bundle.mesh.Name, Status: "parsed", Warnings: []string{}}
		if bundle.info != nil {
			bundleResult.InfoEntry = bundle.info.Name
		}
		if archiveEntryEncrypted(bundle.mesh) {
			bundleResult.Status = "protected"
			warning := bundle.mesh.Name + ": 加密 D5Mesh 载荷只记录容器信息"
			bundleResult.Warnings = append(bundleResult.Warnings, warning)
			warnings = append(warnings, warning)
		} else {
			stream, openError := bundle.mesh.Open()
			if openError != nil {
				return nil, nil, fmt.Errorf("打开 %s 失败: %w", bundle.mesh.Name, openError)
			}
			parsed, parseError := parseD5MeshStream(stream, int64(bundle.mesh.UncompressedSize64))
			if parseError == nil {
				_, parseError = io.Copy(io.Discard, stream)
			}
			closeError := stream.Close()
			if parseError == nil {
				parseError = closeError
			}
			if errors.Is(parseError, errProtectedD5Mesh) {
				bundleResult.Status = "protected"
				warning := bundle.mesh.Name + ": 受保护 D5Mesh 载荷只记录容器信息"
				bundleResult.Warnings = append(bundleResult.Warnings, warning)
				warnings = append(warnings, warning)
			} else if parseError != nil {
				return nil, nil, fmt.Errorf("%s: %w", bundle.mesh.Name, parseError)
			} else {
				bundleResult.Mesh = &parsed.summary
				for _, warningValue := range parsed.warnings {
					prefixed := bundle.mesh.Name + ": " + warningValue
					bundleResult.Warnings = append(bundleResult.Warnings, prefixed)
					warnings = append(warnings, prefixed)
				}
			}
		}
		if bundle.info != nil && !archiveEntryEncrypted(bundle.info) {
			material, materialError := inspectD5Info(bundle.info)
			if materialError != nil {
				warning := fmt.Sprintf("%s: info.json 解析失败: %v", bundle.info.Name, materialError)
				bundleResult.Warnings = append(bundleResult.Warnings, warning)
				warnings = append(warnings, warning)
			} else {
				bundleResult.Material = material
			}
		}
		resultBundles = append(resultBundles, bundleResult)
	}
	if variant == "legacy-fbx" {
		warnings = append(warnings, "旧版 FBX 已完成容器检查；完整 FBX 几何验证在场景转换核心中执行")
	}
	if variant == "unknown" {
		warnings = append(warnings, "容器未包含可识别的 D5Mesh 或 FBX 场景载荷")
	}
	inspection := &d5aInspection{
		Variant: variant, EntryCount: len(archive.File), FileEntryCount: len(files), EncryptedEntryCount: encryptedCount,
		CompressedBytes: compressedBytes, UncompressedBytes: uncompressedBytes, Bundles: resultBundles, Entries: entries,
	}
	if groupInfo != nil {
		inspection.GroupInfoEntry = groupInfo.Name
	}
	if len(fbxFiles) > 0 {
		materialXML := findArchiveBasename(files, "d5material.xml")
		inspection.LegacyFBX = &d5aLegacyFBXInspection{Entry: fbxFiles[0].Name, Bytes: fbxFiles[0].UncompressedSize64}
		if materialXML != nil {
			inspection.LegacyFBX.MaterialXMLEntry = materialXML.Name
		}
	}
	return inspection, warnings, nil
}

func collectArchiveBundles(files []*zip.File, lookup map[string]*zip.File) []archiveBundle {
	order := []string{}
	byPrefix := map[string][]*zip.File{}
	originalPrefix := map[string]string{}
	for _, entry := range files {
		if !strings.HasSuffix(canonicalArchivePath(entry.Name), ".d5mesh") {
			continue
		}
		prefix := archiveParent(entry.Name)
		key := canonicalArchivePath(prefix)
		if _, exists := byPrefix[key]; !exists {
			order = append(order, key)
			originalPrefix[key] = prefix
		}
		byPrefix[key] = append(byPrefix[key], entry)
	}
	result := make([]archiveBundle, 0, len(order))
	for _, key := range order {
		meshes := byPrefix[key]
		mesh := meshes[0]
		for _, candidate := range meshes {
			if archiveBasename(candidate.Name) == "1.d5mesh" {
				mesh = candidate
				break
			}
		}
		prefix := originalPrefix[key]
		join := func(name string) *zip.File {
			if prefix == "" {
				return lookup[canonicalArchivePath(name)]
			}
			return lookup[canonicalArchivePath(prefix+"/"+name)]
		}
		result = append(result, archiveBundle{id: prefix, prefix: prefix, mesh: mesh, info: join("info.json"), icon: join("icon.png"), material: join("d5material.xml")})
	}
	return result
}

func inspectD5Info(entry *zip.File) (*d5MaterialSummary, error) {
	stream, errorValue := entry.Open()
	if errorValue != nil {
		return nil, errorValue
	}
	defer stream.Close()
	content, errorValue := io.ReadAll(io.LimitReader(stream, 64*1024*1024+1))
	if errorValue != nil {
		return nil, errorValue
	}
	if len(content) > 64*1024*1024 {
		return nil, fmt.Errorf("info.json 超过 64 MiB 检查上限")
	}
	content = decodeJSONBytes(content)
	var raw map[string]any
	if errorValue = json.Unmarshal(content, &raw); errorValue != nil {
		return nil, errorValue
	}
	materialIndices := map[int]bool{}
	for index, value := range anyArray(raw["material_MapKey"]) {
		if _, ok := value.(string); ok {
			materialIndices[index] = true
		}
	}
	texturePaths := map[string]bool{}
	detail := nestedJSONObject(raw["detailInfo"])
	for _, style := range objectArray(detail["styleDatas"]) {
		if active, ok := style["bActive"].(bool); ok && !active {
			continue
		}
		for _, element := range objectArray(style["elements"]) {
			if index, ok := integerValue(element["materialIndex"]); ok && index >= 0 {
				materialIndices[index] = true
			}
			materialData := objectValue(element["materialData"])
			for _, parameter := range nestedJSONArray(materialData["matInfo"]) {
				typeValue, typeOK := integerValue(parameter["type"])
				pathValue := stringValue(parameter["value"])
				if typeOK && typeValue == 3 && pathValue != "" {
					texturePaths[canonicalArchivePath(pathValue)] = true
				}
			}
		}
	}
	infoVersion, _ := raw["infoVersion"].(float64)
	return &d5MaterialSummary{
		Title: stringValue(raw["title"]), InfoVersion: infoVersion, MaterialCount: len(materialIndices), TextureReferenceCount: len(texturePaths),
	}, nil
}

func nestedJSONObject(value any) map[string]any {
	if object, ok := value.(map[string]any); ok {
		return object
	}
	text, ok := value.(string)
	if !ok || text == "" {
		return map[string]any{}
	}
	var object map[string]any
	if json.Unmarshal([]byte(text), &object) != nil {
		return map[string]any{}
	}
	return object
}

func nestedJSONArray(value any) []map[string]any {
	if direct, ok := value.([]any); ok {
		return objectArray(direct)
	}
	text, ok := value.(string)
	if !ok || text == "" {
		return nil
	}
	var values []any
	if json.Unmarshal([]byte(text), &values) != nil {
		return nil
	}
	return objectArray(values)
}

func decodeJSONBytes(content []byte) []byte {
	if bytes.HasPrefix(content, []byte{0xef, 0xbb, 0xbf}) {
		return content[3:]
	}
	if bytes.HasPrefix(content, []byte{0xff, 0xfe}) {
		units := make([]uint16, 0, (len(content)-2)/2)
		for index := 2; index+1 < len(content); index += 2 {
			units = append(units, uint16(content[index])|uint16(content[index+1])<<8)
		}
		return []byte(string(utf16.Decode(units)))
	}
	return content
}

func validateD5A(report *sceneInspectionReport) {
	report.Operation = "validate"
	messages := make([]validationMessage, 0, len(report.Warnings))
	for _, warning := range report.Warnings {
		messages = append(messages, validationMessage{Severity: "warning", Code: "D5A_WARNING", Message: warning})
	}
	report.Validation = &validationSummary{Engine: "d5mesh-parser", WarningCount: len(messages), Messages: messages}
	if report.Status != "unsupported" {
		if len(messages) > 0 {
			report.Status = "warning"
		} else {
			report.Status = "pass"
		}
	}
}

type extractionEntry struct {
	Path   string `json:"path"`
	Output string `json:"output"`
	Bytes  uint64 `json:"bytes"`
}

type extractionReport struct {
	SchemaVersion   int               `json:"schemaVersion"`
	DocumentKind    string            `json:"documentKind"`
	Operation       string            `json:"operation"`
	Status          string            `json:"status"`
	Format          string            `json:"format"`
	Input           string            `json:"input"`
	OutputDirectory string            `json:"outputDirectory"`
	ElapsedMS       float64           `json:"elapsedMs"`
	Entries         []extractionEntry `json:"entries"`
}

func extractD5A(input, outputDirectory string, requested []string, overwrite bool) (*extractionReport, error) {
	started := time.Now()
	archive, errorValue := zip.OpenReader(input)
	if errorValue != nil {
		return nil, errorValue
	}
	defer archive.Close()
	requestedSet := map[string]bool{}
	for _, entry := range requested {
		requestedSet[canonicalArchivePath(entry)] = true
	}
	selectAll := len(requestedSet) == 0
	selected := []*zip.File{}
	for _, entry := range archive.File {
		if entry.FileInfo().IsDir() || strings.HasSuffix(entry.Name, "/") {
			continue
		}
		if selectAll || requestedSet[canonicalArchivePath(entry.Name)] {
			selected = append(selected, entry)
			delete(requestedSet, canonicalArchivePath(entry.Name))
		}
	}
	if len(requestedSet) > 0 {
		missing := make([]string, 0, len(requestedSet))
		for entry := range requestedSet {
			missing = append(missing, entry)
		}
		sort.Strings(missing)
		return nil, fmt.Errorf("D5A 中缺少条目: %s", strings.Join(missing, ", "))
	}
	if len(selected) == 0 {
		return nil, fmt.Errorf("D5A 容器中没有可解包的文件条目")
	}
	root, errorValue := filepath.Abs(outputDirectory)
	if errorValue != nil {
		return nil, errorValue
	}
	if errorValue = os.MkdirAll(root, 0o755); errorValue != nil {
		return nil, errorValue
	}
	destinations := map[string]bool{}
	result := &extractionReport{SchemaVersion: 1, DocumentKind: "scene", Operation: "extract", Status: "pass", Format: "d5a", Input: input, OutputDirectory: root, Entries: []extractionEntry{}}
	for _, entry := range selected {
		if archiveEntryEncrypted(entry) {
			return nil, fmt.Errorf("%s 位于加密容器中", entry.Name)
		}
		destination, pathError := archiveOutputPath(root, entry.Name)
		if pathError != nil {
			return nil, pathError
		}
		key := strings.ToLower(destination)
		if destinations[key] {
			return nil, fmt.Errorf("D5A 包含冲突的输出路径 %s", entry.Name)
		}
		destinations[key] = true
		if pathError = extractArchiveFile(entry, destination, overwrite); pathError != nil {
			return nil, pathError
		}
		result.Entries = append(result.Entries, extractionEntry{Path: entry.Name, Output: destination, Bytes: entry.UncompressedSize64})
	}
	result.ElapsedMS = float64(time.Since(started).Microseconds()) / 1000
	return result, nil
}

func extractArchiveFile(entry *zip.File, destination string, overwrite bool) error {
	if _, errorValue := os.Stat(destination); errorValue == nil && !overwrite {
		return fmt.Errorf("输出已存在：%s；使用 --overwrite 覆盖", destination)
	} else if errorValue != nil && !os.IsNotExist(errorValue) {
		return errorValue
	}
	if errorValue := os.MkdirAll(filepath.Dir(destination), 0o755); errorValue != nil {
		return errorValue
	}
	source, errorValue := entry.Open()
	if errorValue != nil {
		return errorValue
	}
	defer source.Close()
	temporary, errorValue := os.CreateTemp(filepath.Dir(destination), filepath.Base(destination)+".*.partial")
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
	written, errorValue := io.CopyBuffer(temporary, source, make([]byte, 256*1024))
	if errorValue != nil {
		return errorValue
	}
	if uint64(written) != entry.UncompressedSize64 {
		return fmt.Errorf("%s 解包长度 %d 与目录记录 %d 不一致", entry.Name, written, entry.UncompressedSize64)
	}
	if errorValue = temporary.Sync(); errorValue != nil {
		return errorValue
	}
	if errorValue = temporary.Close(); errorValue != nil {
		return errorValue
	}
	if errorValue = replaceFile(temporaryPath, destination, overwrite); errorValue != nil {
		return errorValue
	}
	committed = true
	return nil
}

func archiveOutputPath(root, name string) (string, error) {
	normalized := strings.ReplaceAll(name, "\\", "/")
	if strings.HasPrefix(normalized, "/") || filepath.IsAbs(normalized) || filepath.VolumeName(normalized) != "" {
		return "", fmt.Errorf("D5A 条目路径越界: %s", name)
	}
	parts := strings.Split(normalized, "/")
	for _, part := range parts {
		if part == ".." || part == "" || part == "." {
			return "", fmt.Errorf("D5A 条目路径越界: %s", name)
		}
	}
	destination := filepath.Join(append([]string{root}, parts...)...)
	relative, errorValue := filepath.Rel(root, destination)
	if errorValue != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("D5A 条目路径越界: %s", name)
	}
	return destination, nil
}

func canonicalArchivePath(path string) string {
	normalized := strings.ReplaceAll(path, "\\", "/")
	normalized = strings.TrimPrefix(normalized, "./")
	normalized = strings.TrimLeft(normalized, "/")
	return strings.ToLower(normalized)
}

func archiveParent(path string) string {
	normalized := strings.TrimLeft(strings.TrimPrefix(strings.ReplaceAll(path, "\\", "/"), "./"), "/")
	separator := strings.LastIndex(normalized, "/")
	if separator < 0 {
		return ""
	}
	return normalized[:separator]
}

func archiveBasename(path string) string {
	canonical := canonicalArchivePath(path)
	if separator := strings.LastIndex(canonical, "/"); separator >= 0 {
		return canonical[separator+1:]
	}
	return canonical
}

func findArchiveSuffix(files []*zip.File, suffix string) []*zip.File {
	result := []*zip.File{}
	for _, entry := range files {
		if strings.HasSuffix(canonicalArchivePath(entry.Name), strings.ToLower(suffix)) {
			result = append(result, entry)
		}
	}
	return result
}

func findArchiveBasename(files []*zip.File, name string) *zip.File {
	name = strings.ToLower(name)
	for _, entry := range files {
		if archiveBasename(entry.Name) == name {
			return entry
		}
	}
	return nil
}

func archiveEntryEncrypted(entry *zip.File) bool {
	return entry != nil && entry.Flags&1 != 0
}

func readJSONFile(path string) (any, error) {
	file, errorValue := os.Open(path)
	if errorValue != nil {
		return nil, errorValue
	}
	defer file.Close()
	decoder := json.NewDecoder(bufio.NewReader(file))
	var value any
	if errorValue = decoder.Decode(&value); errorValue != nil {
		return nil, errorValue
	}
	return value, nil
}
