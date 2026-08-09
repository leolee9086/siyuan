package d5a

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	glbMagic     = 0x46546c67
	glbJSONChunk = 0x4e4f534a
	glbBINChunk  = 0x004e4942
)

type glbChunkInspection struct {
	Type  string `json:"type"`
	Bytes uint32 `json:"bytes"`
}

type glbInspection struct {
	Version            uint32               `json:"version"`
	JSONBytes          uint32               `json:"jsonBytes"`
	BinaryBytes        uint64               `json:"binaryBytes"`
	Chunks             []glbChunkInspection `json:"chunks"`
	AssetVersion       string               `json:"assetVersion,omitempty"`
	SceneCount         int                  `json:"sceneCount"`
	NodeCount          int                  `json:"nodeCount"`
	MeshCount          int                  `json:"meshCount"`
	PrimitiveCount     int                  `json:"primitiveCount"`
	TriangleCount      int64                `json:"triangleCount"`
	MaterialCount      int                  `json:"materialCount"`
	TextureCount       int                  `json:"textureCount"`
	ImageCount         int                  `json:"imageCount"`
	AnimationCount     int                  `json:"animationCount"`
	SkinCount          int                  `json:"skinCount"`
	ExtensionsUsed     []string             `json:"extensionsUsed"`
	ExtensionsRequired []string             `json:"extensionsRequired"`
}

type parsedGLB struct {
	inspection        glbInspection
	document          map[string]any
	binaryChunkOffset int64
	binaryChunkLength uint32
}

func inspectGLB(path string) (*sceneInspectionReport, error) {
	started := time.Now()
	metadata, errorValue := os.Stat(path)
	if errorValue != nil {
		return nil, errorValue
	}
	parsed, errorValue := parseGLB(path)
	if errorValue != nil {
		return nil, errorValue
	}
	report := &sceneInspectionReport{
		SchemaVersion: 1,
		DocumentKind:  "scene",
		Operation:     "inspect",
		Status:        "pass",
		Format:        "glb",
		File:          summarizeFile(path, metadata),
		Warnings:      []string{},
		GLB:           &parsed.inspection,
	}
	report.ElapsedMS = float64(time.Since(started).Microseconds()) / 1000
	return report, nil
}

func parseGLB(path string) (*parsedGLB, error) {
	file, errorValue := os.Open(path)
	if errorValue != nil {
		return nil, errorValue
	}
	defer file.Close()
	metadata, errorValue := file.Stat()
	if errorValue != nil {
		return nil, errorValue
	}
	if metadata.Size() < 20 {
		return nil, fmt.Errorf("GLB 文件过短")
	}
	header := make([]byte, 12)
	if _, errorValue = io.ReadFull(file, header); errorValue != nil {
		return nil, errorValue
	}
	magic := binary.LittleEndian.Uint32(header[0:4])
	versionValue := binary.LittleEndian.Uint32(header[4:8])
	declaredLength := binary.LittleEndian.Uint32(header[8:12])
	if magic != glbMagic {
		return nil, fmt.Errorf("文件缺少 glTF 二进制标记")
	}
	if versionValue != 2 {
		return nil, fmt.Errorf("当前仅支持 GLB 2，文件版本为 %d", versionValue)
	}
	if int64(declaredLength) != metadata.Size() {
		return nil, fmt.Errorf("GLB 声明长度 %d 与文件长度 %d 不一致", declaredLength, metadata.Size())
	}
	offset := int64(12)
	var document map[string]any
	var binaryChunkOffset int64
	var binaryChunkLength uint32
	inspection := glbInspection{Version: versionValue, Chunks: []glbChunkInspection{}, ExtensionsUsed: []string{}, ExtensionsRequired: []string{}}
	for offset < metadata.Size() {
		chunkHeader := make([]byte, 8)
		if _, errorValue = io.ReadFull(file, chunkHeader); errorValue != nil {
			return nil, fmt.Errorf("GLB 块头不完整: %w", errorValue)
		}
		offset += 8
		length := binary.LittleEndian.Uint32(chunkHeader[0:4])
		chunkType := binary.LittleEndian.Uint32(chunkHeader[4:8])
		if int64(length) > metadata.Size()-offset {
			return nil, fmt.Errorf("GLB 块长度越过文件结尾")
		}
		switch chunkType {
		case glbJSONChunk:
			if document != nil {
				return nil, fmt.Errorf("GLB 包含多个 JSON 块")
			}
			payload := make([]byte, length)
			if _, errorValue = io.ReadFull(file, payload); errorValue != nil {
				return nil, errorValue
			}
			offset += int64(length)
			payload = bytes.TrimRight(payload, "\x00")
			if errorValue = json.Unmarshal(payload, &document); errorValue != nil {
				return nil, fmt.Errorf("GLB JSON 解析失败: %w", errorValue)
			}
			inspection.JSONBytes = length
			inspection.Chunks = append(inspection.Chunks, glbChunkInspection{Type: "JSON", Bytes: length})
		case glbBINChunk:
			if binaryChunkLength != 0 {
				return nil, fmt.Errorf("GLB 包含多个 BIN 块")
			}
			binaryChunkOffset = offset
			binaryChunkLength = length
			if _, errorValue = file.Seek(int64(length), io.SeekCurrent); errorValue != nil {
				return nil, errorValue
			}
			offset += int64(length)
			inspection.BinaryBytes += uint64(length)
			inspection.Chunks = append(inspection.Chunks, glbChunkInspection{Type: "BIN", Bytes: length})
		default:
			if _, errorValue = file.Seek(int64(length), io.SeekCurrent); errorValue != nil {
				return nil, errorValue
			}
			offset += int64(length)
			inspection.Chunks = append(inspection.Chunks, glbChunkInspection{Type: "unknown", Bytes: length})
		}
	}
	if document == nil {
		return nil, fmt.Errorf("GLB 缺少 JSON 块")
	}
	if offset != metadata.Size() {
		return nil, fmt.Errorf("GLB 块边界与文件长度不一致")
	}
	fillGLBInspection(&inspection, document)
	return &parsedGLB{inspection: inspection, document: document, binaryChunkOffset: binaryChunkOffset, binaryChunkLength: binaryChunkLength}, nil
}

func fillGLBInspection(result *glbInspection, document map[string]any) {
	meshes := objectArray(document["meshes"])
	accessors := objectArray(document["accessors"])
	result.AssetVersion = stringValue(objectValue(document["asset"])["version"])
	result.SceneCount = len(objectArray(document["scenes"]))
	result.NodeCount = len(objectArray(document["nodes"]))
	result.MeshCount = len(meshes)
	for _, mesh := range meshes {
		for _, primitive := range objectArray(mesh["primitives"]) {
			result.PrimitiveCount++
			result.TriangleCount += primitiveTriangles(primitive, accessors)
		}
	}
	result.MaterialCount = len(objectArray(document["materials"]))
	result.TextureCount = len(objectArray(document["textures"]))
	result.ImageCount = len(objectArray(document["images"]))
	result.AnimationCount = len(objectArray(document["animations"]))
	result.SkinCount = len(objectArray(document["skins"]))
	result.ExtensionsUsed = stringArray(document["extensionsUsed"])
	result.ExtensionsRequired = stringArray(document["extensionsRequired"])
}

func primitiveTriangles(primitive map[string]any, accessors []map[string]any) int64 {
	accessorIndex, exists := integerValue(primitive["indices"])
	if !exists {
		attributes := objectValue(primitive["attributes"])
		accessorIndex, exists = integerValue(attributes["POSITION"])
	}
	if !exists || accessorIndex < 0 || accessorIndex >= len(accessors) {
		return 0
	}
	count, exists := integerValue(accessors[accessorIndex]["count"])
	if !exists || count < 0 {
		return 0
	}
	mode, exists := integerValue(primitive["mode"])
	if !exists {
		mode = 4
	}
	switch mode {
	case 4:
		return int64(count / 3)
	case 5, 6:
		if count > 2 {
			return int64(count - 2)
		}
	}
	return 0
}

func validateGLB(path string, report *sceneInspectionReport) error {
	parsed, errorValue := parseGLB(path)
	if errorValue != nil {
		return errorValue
	}
	issues := validateGLTFDocument(parsed.document, parsed.inspection)
	report.Operation = "validate"
	report.Validation = &issues
	if issues.ErrorCount > 0 {
		report.Status = "fail"
	} else if issues.WarningCount > 0 || len(report.Warnings) > 0 {
		report.Status = "warning"
	} else {
		report.Status = "pass"
	}
	return nil
}

func validateGLTFDocument(document map[string]any, inspection glbInspection) validationSummary {
	messages := []validationMessage{}
	add := func(severity, code, message, pointer string) {
		messages = append(messages, validationMessage{Severity: severity, Code: code, Message: message, Pointer: pointer})
	}
	asset := objectValue(document["asset"])
	if stringValue(asset["version"]) != "2.0" {
		add("error", "ASSET_VERSION", "asset.version 必须为 2.0", "/asset/version")
	}
	if len(inspection.Chunks) == 0 || inspection.Chunks[0].Type != "JSON" {
		add("error", "GLB_JSON_FIRST", "GLB 首块必须是 JSON", "")
	}
	for index, chunk := range inspection.Chunks {
		if chunk.Type == "unknown" {
			add("warning", "GLB_UNKNOWN_CHUNK", "GLB 包含未知块", fmt.Sprintf("/chunks/%d", index))
		}
	}
	buffers := objectArray(document["buffers"])
	bufferViews := objectArray(document["bufferViews"])
	accessors := objectArray(document["accessors"])
	for index, buffer := range buffers {
		length, ok := integerValue(buffer["byteLength"])
		if !ok || length < 0 {
			add("error", "BUFFER_LENGTH", "buffer.byteLength 必须是非负整数", fmt.Sprintf("/buffers/%d/byteLength", index))
			continue
		}
		if index == 0 && stringValue(buffer["uri"]) == "" && uint64(length) > inspection.BinaryBytes {
			add("error", "BUFFER_BIN_LENGTH", "二进制块短于 buffers[0].byteLength", fmt.Sprintf("/buffers/%d/byteLength", index))
		}
	}
	for index, view := range bufferViews {
		bufferIndex, ok := integerValue(view["buffer"])
		if !ok || bufferIndex < 0 || bufferIndex >= len(buffers) {
			add("error", "BUFFERVIEW_BUFFER", "bufferView 引用了无效 buffer", fmt.Sprintf("/bufferViews/%d/buffer", index))
			continue
		}
		length, lengthOK := integerValue(view["byteLength"])
		offset, offsetOK := integerValue(view["byteOffset"])
		if !offsetOK {
			offset = 0
		}
		bufferLength, _ := integerValue(buffers[bufferIndex]["byteLength"])
		if !lengthOK || length < 0 || offset < 0 || offset+length > bufferLength {
			add("error", "BUFFERVIEW_RANGE", "bufferView 范围越过 buffer", fmt.Sprintf("/bufferViews/%d", index))
		}
	}
	validComponents := map[int]bool{5120: true, 5121: true, 5122: true, 5123: true, 5125: true, 5126: true}
	validTypes := map[string]bool{"SCALAR": true, "VEC2": true, "VEC3": true, "VEC4": true, "MAT2": true, "MAT3": true, "MAT4": true}
	for index, accessor := range accessors {
		count, countOK := integerValue(accessor["count"])
		component, componentOK := integerValue(accessor["componentType"])
		if !countOK || count < 0 {
			add("error", "ACCESSOR_COUNT", "accessor.count 必须是非负整数", fmt.Sprintf("/accessors/%d/count", index))
		}
		if !componentOK || !validComponents[component] {
			add("error", "ACCESSOR_COMPONENT", "accessor.componentType 无效", fmt.Sprintf("/accessors/%d/componentType", index))
		}
		if !validTypes[stringValue(accessor["type"])] {
			add("error", "ACCESSOR_TYPE", "accessor.type 无效", fmt.Sprintf("/accessors/%d/type", index))
		}
		if viewIndex, exists := integerValue(accessor["bufferView"]); exists && (viewIndex < 0 || viewIndex >= len(bufferViews)) {
			add("error", "ACCESSOR_BUFFERVIEW", "accessor 引用了无效 bufferView", fmt.Sprintf("/accessors/%d/bufferView", index))
		}
	}
	materials := objectArray(document["materials"])
	meshes := objectArray(document["meshes"])
	for meshIndex, mesh := range meshes {
		primitives := objectArray(mesh["primitives"])
		if len(primitives) == 0 {
			add("error", "MESH_PRIMITIVES", "mesh 必须包含 primitive", fmt.Sprintf("/meshes/%d/primitives", meshIndex))
		}
		for primitiveIndex, primitive := range primitives {
			pointer := fmt.Sprintf("/meshes/%d/primitives/%d", meshIndex, primitiveIndex)
			attributes := objectValue(primitive["attributes"])
			position, ok := integerValue(attributes["POSITION"])
			if !ok || position < 0 || position >= len(accessors) {
				add("error", "PRIMITIVE_POSITION", "primitive 缺少有效 POSITION accessor", pointer+"/attributes/POSITION")
			}
			if indices, exists := integerValue(primitive["indices"]); exists && (indices < 0 || indices >= len(accessors)) {
				add("error", "PRIMITIVE_INDICES", "primitive 引用了无效 indices accessor", pointer+"/indices")
			}
			if material, exists := integerValue(primitive["material"]); exists && (material < 0 || material >= len(materials)) {
				add("error", "PRIMITIVE_MATERIAL", "primitive 引用了无效材质", pointer+"/material")
			}
		}
	}
	nodes := objectArray(document["nodes"])
	for index, node := range nodes {
		if mesh, exists := integerValue(node["mesh"]); exists && (mesh < 0 || mesh >= len(meshes)) {
			add("error", "NODE_MESH", "node 引用了无效 mesh", fmt.Sprintf("/nodes/%d/mesh", index))
		}
		for childIndex, childValue := range anyArray(node["children"]) {
			child, ok := integerValue(childValue)
			if !ok || child < 0 || child >= len(nodes) || child == index {
				add("error", "NODE_CHILD", "node 引用了无效子节点", fmt.Sprintf("/nodes/%d/children/%d", index, childIndex))
			}
		}
	}
	scenes := objectArray(document["scenes"])
	for sceneIndex, scene := range scenes {
		for nodeIndex, nodeValue := range anyArray(scene["nodes"]) {
			node, ok := integerValue(nodeValue)
			if !ok || node < 0 || node >= len(nodes) {
				add("error", "SCENE_NODE", "scene 引用了无效根节点", fmt.Sprintf("/scenes/%d/nodes/%d", sceneIndex, nodeIndex))
			}
		}
	}
	if scene, exists := integerValue(document["scene"]); exists && (scene < 0 || scene >= len(scenes)) {
		add("error", "DEFAULT_SCENE", "默认 scene 索引无效", "/scene")
	}
	used := map[string]bool{}
	for _, extension := range stringArray(document["extensionsUsed"]) {
		used[extension] = true
	}
	for index, extension := range stringArray(document["extensionsRequired"]) {
		if !used[extension] {
			add("error", "EXTENSION_REQUIRED_UNUSED", "extensionsRequired 必须同时出现在 extensionsUsed", fmt.Sprintf("/extensionsRequired/%d", index))
		}
	}
	result := validationSummary{Engine: "native-gltf2-structural", Messages: messages}
	for _, message := range messages {
		switch message.Severity {
		case "error":
			result.ErrorCount++
		case "warning":
			result.WarningCount++
		case "info":
			result.InfoCount++
		case "hint":
			result.HintCount++
		}
	}
	return result
}

func objectArray(value any) []map[string]any {
	raw, ok := value.([]any)
	if !ok {
		return nil
	}
	result := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if object, ok := item.(map[string]any); ok {
			result = append(result, object)
		}
	}
	return result
}

func anyArray(value any) []any {
	result, _ := value.([]any)
	return result
}

func objectValue(value any) map[string]any {
	result, _ := value.(map[string]any)
	if result == nil {
		return map[string]any{}
	}
	return result
}

func stringArray(value any) []string {
	raw := anyArray(value)
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		if text, ok := item.(string); ok {
			result = append(result, text)
		}
	}
	return result
}

func stringValue(value any) string {
	result, _ := value.(string)
	return result
}

func integerValue(value any) (int, bool) {
	number, ok := value.(float64)
	if !ok || number != float64(int(number)) {
		return 0, false
	}
	return int(number), true
}

func summarizeFile(path string, metadata os.FileInfo) fileSummary {
	return fileSummary{Name: filepath.Base(path), Bytes: metadata.Size(), LastModified: metadata.ModTime().UnixMilli()}
}

func sceneFormat(path string) (string, error) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".d5a":
		return "d5a", nil
	case ".glb":
		return "glb", nil
	default:
		return "", fmt.Errorf("场景命令仅支持 .d5a 或 .glb 文件")
	}
}
