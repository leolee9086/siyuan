package d5a

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var d5ColorPattern = regexp.MustCompile(`(?i)R=([-+0-9.eE]+),G=([-+0-9.eE]+),B=([-+0-9.eE]+),A=([-+0-9.eE]+)`)

type d5DxfMaterial struct {
	index        int
	key          string
	name         string
	color        [4]float64
	completeness int
}

type d5DxfPart struct {
	layer     dxfLayer
	group     *meshGroup
	transform matrix4
}

type d5GroupModel struct {
	id        string
	title     string
	transform matrix4
}

type d5GroupDocument struct {
	models    []d5GroupModel
	rootTitle string
}

func loadD5aDxfSource(contextValue context.Context, input string) (*dxfSceneSource, error) {
	archive, errorValue := zip.OpenReader(input)
	if errorValue != nil {
		return nil, fmt.Errorf("打开 D5A ZIP 失败: %w", errorValue)
	}
	defer archive.Close()
	files := make([]*zip.File, 0, len(archive.File))
	lookup := map[string]*zip.File{}
	for _, entry := range archive.File {
		if entry.FileInfo().IsDir() || strings.HasSuffix(entry.Name, "/") {
			continue
		}
		files = append(files, entry)
		canonical := canonicalArchivePath(entry.Name)
		if _, exists := lookup[canonical]; !exists {
			lookup[canonical] = entry
		}
	}
	bundles := collectArchiveBundles(files, lookup)
	if len(bundles) == 0 {
		if len(findArchiveSuffix(files, ".fbx")) > 0 {
			return nil, fmt.Errorf("Go 原生 DXF 转换当前处理普通 D5Mesh D5A；此文件为旧版 FBX D5A")
		}
		return nil, fmt.Errorf("D5A 中没有可转换的普通 D5Mesh 载荷")
	}
	for _, bundle := range bundles {
		if archiveEntryEncrypted(bundle.mesh) || archiveEntryEncrypted(bundle.info) {
			return nil, fmt.Errorf("%s 位于加密容器中", bundle.mesh.Name)
		}
	}
	groupDocument := d5GroupDocument{}
	if entry := lookup["groupinfo.json"]; entry != nil && !archiveEntryEncrypted(entry) {
		if raw, readError := readArchiveJSONObject(contextValue, entry); readError == nil {
			groupDocument = parseD5GroupDocument(raw)
		}
	}
	bundles = orderD5Bundles(bundles, groupDocument.models)
	title := groupDocument.rootTitle
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
	}
	modelsByID := map[string]d5GroupModel{}
	for _, model := range groupDocument.models {
		modelsByID[strings.ToLower(model.id)] = model
	}
	usedLayers := map[string]bool{}
	parts := []d5DxfPart{}
	diagnostics := []conversionDiagnostic{}
	metrics := sceneDocumentMetrics{NodeCount: 1 + len(bundles)}
	meshDefinitions := map[string]bool{}
	texturePaths := map[string]bool{}
	extraInstances := 0
	rootMatrix := d5RootToYUpMatrix()
	for bundleIndex, bundle := range bundles {
		if errorValue = contextValue.Err(); errorValue != nil {
			return nil, errorValue
		}
		groupModel, hasGroupModel := modelsByID[strings.ToLower(bundle.id)]
		bundleMatrix := identityMatrix4()
		if hasGroupModel {
			bundleMatrix = groupModel.transform
		}
		materials := []d5DxfMaterial{}
		if bundle.info != nil {
			materials, texturePaths, errorValue = mergeD5Materials(contextValue, bundle.info, texturePaths)
			if errorValue != nil {
				appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "d5-info-warning", Path: bundle.info.Name, Message: fmt.Sprintf("材质信息读取失败，使用默认颜色: %v", errorValue)})
				materials = nil
			}
		}
		materialByKey := map[string]d5DxfMaterial{}
		for _, material := range materials {
			key := strings.ToLower(material.key)
			current, exists := materialByKey[key]
			if !exists || material.completeness > current.completeness {
				materialByKey[key] = material
			}
		}
		stream, openError := bundle.mesh.Open()
		if openError != nil {
			return nil, openError
		}
		parsed, parseError := parseD5MeshGeometryStream(&contextReader{context: contextValue, reader: stream}, int64(bundle.mesh.UncompressedSize64))
		closeError := stream.Close()
		if parseError == nil {
			parseError = closeError
		}
		if parseError != nil {
			return nil, fmt.Errorf("%s: %w", bundle.mesh.Name, parseError)
		}
		for _, warning := range parsed.warnings {
			appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "d5mesh-warning", Path: bundle.mesh.Name, Message: warning})
		}
		descriptorsByGroup := make([][]int, len(parsed.groups))
		for descriptorIndex, descriptor := range parsed.descriptors {
			if descriptor.groupIndex >= 0 && descriptor.groupIndex < len(parsed.groups) {
				descriptorsByGroup[descriptor.groupIndex] = append(descriptorsByGroup[descriptor.groupIndex], descriptorIndex)
			}
		}
		bundleTriangles := int64(0)
		bundleVertices := int64(0)
		for groupIndex := range parsed.groups {
			group := &parsed.groups[groupIndex]
			descriptorIndices := descriptorsByGroup[groupIndex]
			if len(descriptorIndices) == 0 {
				descriptorIndices = []int{-1}
			}
			if len(descriptorIndices) > 1 {
				extraInstances += len(descriptorIndices) - 1
			}
			for _, descriptorIndex := range descriptorIndices {
				descriptor := meshDescriptor{materialName: group.key, transform: identityMatrix4()}
				if descriptorIndex >= 0 {
					descriptor = parsed.descriptors[descriptorIndex]
				}
				material, hasMaterial := materialByKey[strings.ToLower(descriptor.materialName)]
				if !hasMaterial {
					material, hasMaterial = materialByKey[strings.ToLower(group.key)]
				}
				if !hasMaterial && descriptorIndex >= 0 && descriptorIndex < len(materials) {
					material, hasMaterial = materials[descriptorIndex], true
				}
				if !hasMaterial && groupIndex < len(materials) {
					material, hasMaterial = materials[groupIndex], true
				}
				if !hasMaterial {
					material = d5DxfMaterial{index: -1, key: group.key, name: descriptor.materialName, color: [4]float64{0.72, 0.72, 0.72, 1}}
				}
				partName := descriptor.meshName
				if partName == "" {
					partName = descriptor.materialName
				}
				if partName == "" {
					partName = group.key
				}
				materialName := material.name
				if materialName == "" {
					materialName = material.key
				}
				if materialName == "" {
					materialName = "Default"
				}
				layer := makeDxfLayer(partName+"__"+materialName, material.color, usedLayers)
				world := multiplyMatrix4(rootMatrix, multiplyMatrix4(bundleMatrix, descriptor.transform))
				parts = append(parts, d5DxfPart{layer: layer, group: group, transform: world})
				metrics.PrimitiveCount++
				metrics.MeshNodeCount++
				metrics.PrimitivesWithNormals++
				metrics.PrimitivesWithUV0++
				metrics.TriangleCount += group.triangles
				metrics.VertexCount += group.vertices
				bundleTriangles += group.triangles
				bundleVertices += group.vertices
				meshDefinitions[fmt.Sprintf("%d:%d:%d", bundleIndex, groupIndex, material.index)] = true
			}
		}
		if bundleTriangles != parsed.summary.TriangleCount || bundleVertices != parsed.summary.VertexCount {
			return nil, fmt.Errorf("%s 的实例几何统计与 D5Mesh 摘要不一致", bundle.mesh.Name)
		}
		metrics.MaterialCount += len(materials)
	}
	metrics.NodeCount += metrics.MeshNodeCount
	metrics.MeshDefinitionCount = len(meshDefinitions)
	metrics.TextureCount = len(texturePaths)
	metrics.ImageCount = len(texturePaths)
	if metrics.TriangleCount == 0 {
		return nil, fmt.Errorf("D5A 中没有可转换的三角面")
	}
	if len(texturePaths) > 0 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-textures-not-representable", Message: "DXF 3DFACE 不承载表面纹理；材质只保留为部件图层和 True Color"})
	}
	appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-uv-not-representable", Message: "DXF 3DFACE 不承载逐顶点 UV；UV 数据未写入"})
	appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-shading-basis-derived", Message: "DXF 3DFACE 不承载顶点法线或切线；目标工具将从面几何重建着色基"})
	if extraInstances > 0 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-instances-expanded", Message: fmt.Sprintf("%d 个额外实例已展开为独立 3DFACE", extraInstances)})
	}
	if metrics.NodeCount > 1 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-hierarchy-flattened", Message: "节点世界变换已应用到顶点；部件和材质边界保留为图层，父子层级不写入"})
	}
	source := &dxfSceneSource{name: title, format: "d5a", metrics: metrics, diagnostics: diagnostics}
	for _, part := range parts {
		source.layers = append(source.layers, part.layer)
	}
	source.writeEntities = func(contextValue context.Context, encoder *dxfEncoder) error {
		for _, part := range parts {
			indices := part.group.indices
			for offset := 0; offset < len(indices); offset += 3 {
				if offset%(4096*3) == 0 {
					if errorValue := contextValue.Err(); errorValue != nil {
						return errorValue
					}
				}
				points := [3]point3{}
				for corner := 0; corner < 3; corner++ {
					vertex := int(indices[offset+corner])
					positionOffset := vertex * 3
					if positionOffset < 0 || positionOffset+2 >= len(part.group.positions) {
						return fmt.Errorf("D5Mesh 顶点索引 %d 超出位置数组", vertex)
					}
					world, transformError := transformPoint3(part.transform, point3{
						float64(part.group.positions[positionOffset]), float64(part.group.positions[positionOffset+1]), float64(part.group.positions[positionOffset+2]),
					})
					if transformError != nil {
						return transformError
					}
					points[corner] = yUpToDxfPoint(world)
				}
				if errorValue := encoder.writeFace(part.layer, points[0], points[1], points[2]); errorValue != nil {
					return errorValue
				}
			}
		}
		return nil
	}
	return source, nil
}

func readArchiveJSONObject(contextValue context.Context, entry *zip.File) (map[string]any, error) {
	stream, errorValue := entry.Open()
	if errorValue != nil {
		return nil, errorValue
	}
	defer stream.Close()
	content, errorValue := io.ReadAll(io.LimitReader(&contextReader{context: contextValue, reader: stream}, 64*1024*1024+1))
	if errorValue != nil {
		return nil, errorValue
	}
	if len(content) > 64*1024*1024 {
		return nil, fmt.Errorf("%s 超过 64 MiB 读取上限", entry.Name)
	}
	content = decodeJSONBytes(content)
	var result map[string]any
	if errorValue = json.Unmarshal(content, &result); errorValue != nil {
		return nil, errorValue
	}
	return result, nil
}

func parseD5GroupDocument(raw map[string]any) d5GroupDocument {
	result := d5GroupDocument{}
	for _, value := range objectArray(raw["models"]) {
		id := stringValue(value["id"])
		if id == "" {
			continue
		}
		result.models = append(result.models, d5GroupModel{id: id, title: stringValue(value["title"]), transform: d5TransformMatrix(value["transform"])})
	}
	for _, value := range objectArray(raw["groups"]) {
		if stringValue(value["parent"]) == "" && stringValue(value["title"]) != "" {
			result.rootTitle = stringValue(value["title"])
			break
		}
	}
	return result
}

func d5TransformMatrix(value any) matrix4 {
	raw := objectValue(value)
	translation := objectValue(raw["translation"])
	rotation := objectValue(raw["rotation"])
	scale := objectValue(raw["scale3D"])
	tx, txOK := finiteJSONNumber(translation["x"])
	ty, tyOK := finiteJSONNumber(translation["y"])
	tz, tzOK := finiteJSONNumber(translation["z"])
	rx, rxOK := finiteJSONNumber(rotation["x"])
	ry, ryOK := finiteJSONNumber(rotation["y"])
	rz, rzOK := finiteJSONNumber(rotation["z"])
	rw, rwOK := finiteJSONNumber(rotation["w"])
	sx, sxOK := finiteJSONNumber(scale["x"])
	sy, syOK := finiteJSONNumber(scale["y"])
	sz, szOK := finiteJSONNumber(scale["z"])
	if !(txOK && tyOK && tzOK && rxOK && ryOK && rzOK && rwOK && sxOK && syOK && szOK) {
		return identityMatrix4()
	}
	return composeMatrix4(point3{tx, ty, tz}, [4]float64{rx, ry, rz, rw}, point3{sx, sy, sz})
}

func orderD5Bundles(bundles []archiveBundle, models []d5GroupModel) []archiveBundle {
	if len(models) == 0 {
		return bundles
	}
	byID := map[string]archiveBundle{}
	for _, bundle := range bundles {
		byID[strings.ToLower(bundle.id)] = bundle
	}
	ordered := make([]archiveBundle, 0, len(bundles))
	selected := map[string]bool{}
	for _, model := range models {
		key := strings.ToLower(model.id)
		if bundle, exists := byID[key]; exists {
			ordered = append(ordered, bundle)
			selected[key] = true
		}
	}
	for _, bundle := range bundles {
		if !selected[strings.ToLower(bundle.id)] {
			ordered = append(ordered, bundle)
		}
	}
	return ordered
}

func mergeD5Materials(contextValue context.Context, entry *zip.File, texturePaths map[string]bool) ([]d5DxfMaterial, map[string]bool, error) {
	raw, errorValue := readArchiveJSONObject(contextValue, entry)
	if errorValue != nil {
		return nil, texturePaths, errorValue
	}
	keys := []string{}
	for _, value := range anyArray(raw["material_MapKey"]) {
		if text, ok := value.(string); ok {
			keys = append(keys, text)
		} else {
			keys = append(keys, "")
		}
	}
	byIndex := map[int]d5DxfMaterial{}
	detail := nestedJSONObject(raw["detailInfo"])
	for _, style := range objectArray(detail["styleDatas"]) {
		if active, ok := style["bActive"].(bool); ok && !active {
			continue
		}
		for _, element := range objectArray(style["elements"]) {
			index, ok := integerValue(element["materialIndex"])
			if !ok || index < 0 {
				continue
			}
			if _, exists := byIndex[index]; exists {
				continue
			}
			data := objectValue(element["materialData"])
			key := ""
			if index < len(keys) {
				key = keys[index]
			}
			material := d5DxfMaterial{index: index, key: key, name: stringValue(data["title"]), color: [4]float64{0.72, 0.72, 0.72, 1}}
			if material.name == "" {
				material.name = key
			}
			parameters := nestedJSONArray(data["matInfo"])
			material.completeness = len(parameters)
			for _, parameter := range parameters {
				name := strings.ToLower(stringValue(parameter["name"]))
				value := stringValue(parameter["value"])
				if name == "diffuse (color)" {
					material.color = parseD5Color(value)
				}
				if typeValue, typeOK := integerValue(parameter["type"]); typeOK && typeValue == 3 && value != "" {
					texturePaths[canonicalArchivePath(value)] = true
					material.completeness += 1000
				}
			}
			byIndex[index] = material
		}
	}
	for index, key := range keys {
		if _, exists := byIndex[index]; !exists {
			byIndex[index] = d5DxfMaterial{index: index, key: key, name: key, color: [4]float64{0.72, 0.72, 0.72, 1}}
		}
	}
	indices := make([]int, 0, len(byIndex))
	for index := range byIndex {
		indices = append(indices, index)
	}
	sort.Ints(indices)
	result := make([]d5DxfMaterial, 0, len(indices))
	for _, index := range indices {
		result = append(result, byIndex[index])
	}
	return result, texturePaths, nil
}

func parseD5Color(value string) [4]float64 {
	match := d5ColorPattern.FindStringSubmatch(value)
	if len(match) != 5 {
		return [4]float64{0.72, 0.72, 0.72, 1}
	}
	result := [4]float64{}
	for index := 0; index < 4; index++ {
		parsed, errorValue := strconv.ParseFloat(match[index+1], 64)
		if errorValue != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return [4]float64{0.72, 0.72, 0.72, 1}
		}
		result[index] = parsed
	}
	return result
}

func finiteJSONNumber(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok && !math.IsNaN(number) && !math.IsInf(number, 0)
}

type contextReader struct {
	context context.Context
	reader  io.Reader
}

func (reader *contextReader) Read(buffer []byte) (int, error) {
	if errorValue := reader.context.Err(); errorValue != nil {
		return 0, errorValue
	}
	return reader.reader.Read(buffer)
}
