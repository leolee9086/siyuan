package d5a

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
)

type glbDxfPart struct {
	layer            dxfLayer
	positionAccessor int
	indexAccessor    int
	mode             int
	elementCount     int
	transform        matrix4
}

type glbAccessorData struct {
	data          []byte
	count         int
	components    int
	componentType int
	componentSize int
	stride        int
	normalized    bool
}

func loadGlbDxfSource(contextValue context.Context, input string) (*dxfSceneSource, error) {
	if errorValue := contextValue.Err(); errorValue != nil {
		return nil, errorValue
	}
	parsed, errorValue := parseGLB(input)
	if errorValue != nil {
		return nil, errorValue
	}
	validation := validateGLTFDocument(parsed.document, parsed.inspection)
	if validation.ErrorCount > 0 {
		return nil, fmt.Errorf("GLB 结构校验发现 %d 个错误", validation.ErrorCount)
	}
	for _, extension := range stringArray(parsed.document["extensionsRequired"]) {
		if extension == "KHR_draco_mesh_compression" || extension == "EXT_meshopt_compression" {
			return nil, fmt.Errorf("Go 原生 DXF 转换尚未内嵌 %s 解码器；内嵌 WebUI 可查看该 GLB", extension)
		}
	}
	meshes := objectArray(parsed.document["meshes"])
	nodes := objectArray(parsed.document["nodes"])
	accessors := objectArray(parsed.document["accessors"])
	materials := objectArray(parsed.document["materials"])
	usedLayers := map[string]bool{}
	usedMeshes := map[int]bool{}
	usedMaterials := map[int]bool{}
	parts := []glbDxfPart{}
	diagnostics := []conversionDiagnostic{}
	metrics := sceneDocumentMetrics{
		MaterialCount: 0, TextureCount: len(objectArray(parsed.document["textures"])), ImageCount: len(objectArray(parsed.document["images"])),
		AnimationCount: len(objectArray(parsed.document["animations"])), SkinCount: len(objectArray(parsed.document["skins"])),
	}
	if metrics.TextureCount > 0 || metrics.ImageCount > 0 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-textures-not-representable", Message: "DXF 3DFACE 不承载表面纹理；材质只保留为部件图层和 True Color"})
	}
	if metrics.AnimationCount > 0 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-animation-omitted", Message: fmt.Sprintf("%d 个动画未写入静态 DXF", metrics.AnimationCount)})
	}
	if metrics.SkinCount > 0 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-skin-omitted", Message: fmt.Sprintf("%d 个蒙皮仅按当前静态几何写入", metrics.SkinCount)})
	}
	rootIndices, errorValue := glbSceneRoots(parsed.document, nodes)
	if errorValue != nil {
		return nil, errorValue
	}
	visiting := map[int]bool{}
	visitedCount := 0
	var walk func(int, matrix4, int) error
	walk = func(nodeIndex int, parent matrix4, depth int) error {
		if errorValue := contextValue.Err(); errorValue != nil {
			return errorValue
		}
		if nodeIndex < 0 || nodeIndex >= len(nodes) {
			return fmt.Errorf("GLB 节点索引 %d 越界", nodeIndex)
		}
		if depth > 4096 {
			return fmt.Errorf("GLB 节点层级超过 4096")
		}
		if visiting[nodeIndex] {
			return fmt.Errorf("GLB 节点层级存在循环")
		}
		visiting[nodeIndex] = true
		defer delete(visiting, nodeIndex)
		node := nodes[nodeIndex]
		if _, exists := objectValue(node["extensions"])["EXT_mesh_gpu_instancing"]; exists {
			return fmt.Errorf("Go 原生 DXF 转换尚未迁移 EXT_mesh_gpu_instancing 展开")
		}
		local, matrixError := glbNodeMatrix(node)
		if matrixError != nil {
			return fmt.Errorf("节点 %d: %w", nodeIndex, matrixError)
		}
		world := multiplyMatrix4(parent, local)
		visitedCount++
		if meshIndex, exists := integerValue(node["mesh"]); exists {
			if meshIndex < 0 || meshIndex >= len(meshes) {
				return fmt.Errorf("节点 %d 引用了无效 mesh", nodeIndex)
			}
			mesh := meshes[meshIndex]
			usedMeshes[meshIndex] = true
			metrics.MeshNodeCount++
			meshName := stringValue(mesh["name"])
			if meshName == "" {
				meshName = fmt.Sprintf("Mesh %d", meshIndex+1)
			}
			nodeName := stringValue(node["name"])
			if nodeName == "" {
				nodeName = meshName
			}
			for primitiveIndex, primitive := range objectArray(mesh["primitives"]) {
				metrics.PrimitiveCount++
				mode, modeExists := integerValue(primitive["mode"])
				if !modeExists {
					mode = 4
				}
				if mode != 4 && mode != 5 && mode != 6 {
					appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-non-triangle-primitives-omitted", Path: fmt.Sprintf("meshes.%d.primitives.%d", meshIndex, primitiveIndex), Message: "点线图元未写入 3DFACE"})
					continue
				}
				if _, exists := objectValue(primitive["extensions"])["KHR_draco_mesh_compression"]; exists {
					return fmt.Errorf("mesh %d primitive %d 使用 KHR_draco_mesh_compression", meshIndex, primitiveIndex)
				}
				attributes := objectValue(primitive["attributes"])
				positionAccessor, exists := integerValue(attributes["POSITION"])
				if !exists || positionAccessor < 0 || positionAccessor >= len(accessors) {
					return fmt.Errorf("mesh %d primitive %d 缺少有效 POSITION", meshIndex, primitiveIndex)
				}
				positionCount, exists := integerValue(accessors[positionAccessor]["count"])
				if !exists || positionCount < 0 {
					return fmt.Errorf("POSITION accessor.count 无效")
				}
				indexAccessor := -1
				elementCount := positionCount
				if value, indexExists := integerValue(primitive["indices"]); indexExists {
					if value < 0 || value >= len(accessors) {
						return fmt.Errorf("mesh %d primitive %d 的索引 accessor 无效", meshIndex, primitiveIndex)
					}
					indexAccessor = value
					elementCount, exists = integerValue(accessors[value]["count"])
					if !exists || elementCount < 0 {
						return fmt.Errorf("索引 accessor.count 无效")
					}
				}
				triangleCount := glbModeTriangleCount(mode, elementCount)
				metrics.TriangleCount += triangleCount
				metrics.VertexCount += int64(positionCount)
				if _, exists := integerValue(attributes["NORMAL"]); exists {
					metrics.PrimitivesWithNormals++
					appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-shading-basis-derived", Message: "DXF 3DFACE 不承载顶点法线或切线；目标工具将从面几何重建着色基"})
				}
				if _, exists := integerValue(attributes["TEXCOORD_0"]); exists {
					metrics.PrimitivesWithUV0++
					appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-uv-not-representable", Message: "DXF 3DFACE 不承载逐顶点 UV；UV 数据未写入"})
				}
				if _, exists := integerValue(attributes["TEXCOORD_1"]); exists {
					metrics.PrimitivesWithUV1++
				}
				morphTargets := len(objectArray(primitive["targets"]))
				if morphTargets > 0 {
					appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-morph-targets-omitted", Message: fmt.Sprintf("%d 组变形目标未写入静态 DXF", morphTargets)})
				}
				materialIndex := -1
				materialName := "Default"
				color := [4]float64{1, 1, 1, 1}
				if value, materialExists := integerValue(primitive["material"]); materialExists {
					if value < 0 || value >= len(materials) {
						return fmt.Errorf("mesh %d primitive %d 引用了无效材质", meshIndex, primitiveIndex)
					}
					materialIndex = value
					usedMaterials[value] = true
					materialName, color = glbMaterialAppearance(materials[value], value)
				}
				layer := makeDxfLayer(nodeName+"__"+materialName, color, usedLayers)
				parts = append(parts, glbDxfPart{layer: layer, positionAccessor: positionAccessor, indexAccessor: indexAccessor, mode: mode, elementCount: elementCount, transform: world})
				_ = materialIndex
			}
		}
		for childOffset, value := range anyArray(node["children"]) {
			child, exists := integerValue(value)
			if !exists {
				return fmt.Errorf("节点 %d 的 child %d 不是整数", nodeIndex, childOffset)
			}
			if errorValue := walk(child, world, depth+1); errorValue != nil {
				return errorValue
			}
		}
		return nil
	}
	for _, root := range rootIndices {
		if errorValue = walk(root, identityMatrix4(), 0); errorValue != nil {
			return nil, errorValue
		}
	}
	metrics.NodeCount = visitedCount
	metrics.MeshDefinitionCount = len(usedMeshes)
	metrics.MaterialCount = len(usedMaterials)
	if metrics.TriangleCount == 0 {
		return nil, fmt.Errorf("GLB 默认场景中没有可转换的三角面")
	}
	if metrics.NodeCount > 1 {
		appendDiagnostic(&diagnostics, conversionDiagnostic{Severity: "warning", Code: "dxf-hierarchy-flattened", Message: "节点世界变换已应用到顶点；部件和材质边界保留为图层，父子层级不写入"})
	}
	sourceName := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
	source := &dxfSceneSource{name: sourceName, format: "glb", metrics: metrics, diagnostics: diagnostics}
	for _, part := range parts {
		source.layers = append(source.layers, part.layer)
	}
	source.writeEntities = func(contextValue context.Context, encoder *dxfEncoder) error {
		file, openError := os.Open(input)
		if openError != nil {
			return openError
		}
		defer file.Close()
		for _, part := range parts {
			position, accessorError := readGlbAccessor(file, parsed, part.positionAccessor)
			if accessorError != nil {
				return accessorError
			}
			if position.components != 3 {
				return fmt.Errorf("POSITION accessor 必须是 VEC3")
			}
			var indices *glbAccessorData
			if part.indexAccessor >= 0 {
				indices, accessorError = readGlbAccessor(file, parsed, part.indexAccessor)
				if accessorError != nil {
					return accessorError
				}
				if indices.components != 1 {
					return fmt.Errorf("索引 accessor 必须是 SCALAR")
				}
				if indices.componentType != 5121 && indices.componentType != 5123 && indices.componentType != 5125 {
					return fmt.Errorf("索引 accessor 使用无效 componentType %d", indices.componentType)
				}
			}
			triangleCount := glbModeTriangleCount(part.mode, part.elementCount)
			for face := int64(0); face < triangleCount; face++ {
				if face%4096 == 0 {
					if errorValue := contextValue.Err(); errorValue != nil {
						return errorValue
					}
				}
				elements := glbTriangleElements(part.mode, int(face))
				points := [3]point3{}
				for corner := 0; corner < 3; corner++ {
					vertex := elements[corner]
					if indices != nil {
						value, valueError := indices.value(vertex, 0)
						if valueError != nil || value != math.Trunc(value) {
							return fmt.Errorf("GLB 顶点索引无效")
						}
						vertex = int(value)
					}
					if vertex < 0 || vertex >= position.count {
						return fmt.Errorf("GLB 顶点索引 %d 越界", vertex)
					}
					x, xError := position.value(vertex, 0)
					y, yError := position.value(vertex, 1)
					z, zError := position.value(vertex, 2)
					if xError != nil || yError != nil || zError != nil {
						return fmt.Errorf("读取 GLB POSITION 失败")
					}
					world, transformError := transformPoint3(part.transform, point3{x, y, z})
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

func glbSceneRoots(document map[string]any, nodes []map[string]any) ([]int, error) {
	scenes := objectArray(document["scenes"])
	if len(scenes) > 0 {
		sceneIndex, exists := integerValue(document["scene"])
		if !exists {
			sceneIndex = 0
		}
		if sceneIndex < 0 || sceneIndex >= len(scenes) {
			return nil, fmt.Errorf("GLB 默认 scene 索引无效")
		}
		roots := []int{}
		for _, value := range anyArray(scenes[sceneIndex]["nodes"]) {
			index, ok := integerValue(value)
			if !ok || index < 0 || index >= len(nodes) {
				return nil, fmt.Errorf("GLB scene 根节点索引无效")
			}
			roots = append(roots, index)
		}
		return roots, nil
	}
	children := map[int]bool{}
	for _, node := range nodes {
		for _, value := range anyArray(node["children"]) {
			if child, ok := integerValue(value); ok {
				children[child] = true
			}
		}
	}
	roots := []int{}
	for index := range nodes {
		if !children[index] {
			roots = append(roots, index)
		}
	}
	return roots, nil
}

func glbNodeMatrix(node map[string]any) (matrix4, error) {
	if values := anyArray(node["matrix"]); len(values) > 0 {
		if len(values) != 16 {
			return matrix4{}, fmt.Errorf("matrix 长度不是 16")
		}
		result := matrix4{}
		for index, value := range values {
			number, ok := finiteJSONNumber(value)
			if !ok {
				return matrix4{}, fmt.Errorf("matrix 包含非有限数值")
			}
			result[index] = number
		}
		return result, nil
	}
	translation, errorValue := glbNumberTuple(node["translation"], []float64{0, 0, 0})
	if errorValue != nil {
		return matrix4{}, errorValue
	}
	rotation, errorValue := glbNumberTuple(node["rotation"], []float64{0, 0, 0, 1})
	if errorValue != nil {
		return matrix4{}, errorValue
	}
	scale, errorValue := glbNumberTuple(node["scale"], []float64{1, 1, 1})
	if errorValue != nil {
		return matrix4{}, errorValue
	}
	return composeMatrix4(point3{translation[0], translation[1], translation[2]}, [4]float64{rotation[0], rotation[1], rotation[2], rotation[3]}, point3{scale[0], scale[1], scale[2]}), nil
}

func glbNumberTuple(value any, defaults []float64) ([]float64, error) {
	values := anyArray(value)
	if len(values) == 0 {
		return append([]float64(nil), defaults...), nil
	}
	if len(values) != len(defaults) {
		return nil, fmt.Errorf("TRS 数组长度无效")
	}
	result := make([]float64, len(values))
	for index, value := range values {
		number, ok := finiteJSONNumber(value)
		if !ok {
			return nil, fmt.Errorf("TRS 包含非有限数值")
		}
		result[index] = number
	}
	return result, nil
}

func glbMaterialAppearance(material map[string]any, index int) (string, [4]float64) {
	name := stringValue(material["name"])
	if name == "" {
		name = fmt.Sprintf("Material %d", index+1)
	}
	color := [4]float64{1, 1, 1, 1}
	pbr := objectValue(material["pbrMetallicRoughness"])
	values := anyArray(pbr["baseColorFactor"])
	if len(values) == 4 {
		for component, value := range values {
			if number, ok := finiteJSONNumber(value); ok {
				color[component] = number
			}
		}
	}
	return name, color
}

func glbModeTriangleCount(mode, count int) int64 {
	if mode == 4 {
		return int64(count / 3)
	}
	if (mode == 5 || mode == 6) && count > 2 {
		return int64(count - 2)
	}
	return 0
}

func glbTriangleElements(mode, face int) [3]int {
	if mode == 4 {
		return [3]int{face * 3, face*3 + 1, face*3 + 2}
	}
	if mode == 6 {
		return [3]int{0, face + 1, face + 2}
	}
	if face%2 == 0 {
		return [3]int{face, face + 1, face + 2}
	}
	return [3]int{face + 1, face, face + 2}
}

func readGlbAccessor(file *os.File, parsed *parsedGLB, accessorIndex int) (*glbAccessorData, error) {
	accessors := objectArray(parsed.document["accessors"])
	views := objectArray(parsed.document["bufferViews"])
	buffers := objectArray(parsed.document["buffers"])
	if accessorIndex < 0 || accessorIndex >= len(accessors) {
		return nil, fmt.Errorf("GLB accessor %d 越界", accessorIndex)
	}
	accessor := accessors[accessorIndex]
	if len(objectValue(accessor["sparse"])) > 0 {
		return nil, fmt.Errorf("GLB accessor %d 使用尚未迁移的 sparse 数据", accessorIndex)
	}
	viewIndex, exists := integerValue(accessor["bufferView"])
	if !exists || viewIndex < 0 || viewIndex >= len(views) {
		return nil, fmt.Errorf("GLB accessor %d 缺少有效 bufferView", accessorIndex)
	}
	view := views[viewIndex]
	if _, exists := objectValue(view["extensions"])["EXT_meshopt_compression"]; exists {
		return nil, fmt.Errorf("bufferView %d 使用 EXT_meshopt_compression", viewIndex)
	}
	bufferIndex, exists := integerValue(view["buffer"])
	if !exists || bufferIndex != 0 || bufferIndex >= len(buffers) {
		return nil, fmt.Errorf("GLB bufferView %d 不是内嵌 BIN buffer 0", viewIndex)
	}
	if stringValue(buffers[bufferIndex]["uri"]) != "" {
		return nil, fmt.Errorf("GLB buffer 0 使用外部 URI")
	}
	componentType, exists := integerValue(accessor["componentType"])
	if !exists {
		return nil, fmt.Errorf("accessor %d 缺少 componentType", accessorIndex)
	}
	componentSize := map[int]int{5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[componentType]
	if componentSize == 0 {
		return nil, fmt.Errorf("accessor %d componentType %d 无效", accessorIndex, componentType)
	}
	components := map[string]int{"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}[stringValue(accessor["type"])]
	if components == 0 {
		return nil, fmt.Errorf("accessor %d type 无效", accessorIndex)
	}
	count, exists := integerValue(accessor["count"])
	if !exists || count < 0 {
		return nil, fmt.Errorf("accessor %d count 无效", accessorIndex)
	}
	elementSize := componentSize * components
	stride, strideExists := integerValue(view["byteStride"])
	if !strideExists {
		stride = elementSize
	}
	if stride < elementSize {
		return nil, fmt.Errorf("bufferView %d byteStride 小于元素长度", viewIndex)
	}
	viewOffset, _ := integerValue(view["byteOffset"])
	viewLength, lengthExists := integerValue(view["byteLength"])
	accessorOffset, _ := integerValue(accessor["byteOffset"])
	if !lengthExists || viewOffset < 0 || viewLength < 0 || accessorOffset < 0 {
		return nil, fmt.Errorf("bufferView/accessor 字节范围无效")
	}
	required := 0
	if count > 0 {
		required = (count-1)*stride + elementSize
	}
	if accessorOffset+required > viewLength {
		return nil, fmt.Errorf("accessor %d 越过 bufferView", accessorIndex)
	}
	if int64(viewOffset+accessorOffset+required) > int64(parsed.binaryChunkLength) {
		return nil, fmt.Errorf("accessor %d 越过 GLB BIN 块", accessorIndex)
	}
	data := make([]byte, required)
	if required > 0 {
		section := io.NewSectionReader(file, parsed.binaryChunkOffset+int64(viewOffset+accessorOffset), int64(required))
		if _, errorValue := io.ReadFull(section, data); errorValue != nil {
			return nil, errorValue
		}
	}
	normalized, _ := accessor["normalized"].(bool)
	return &glbAccessorData{data: data, count: count, components: components, componentType: componentType, componentSize: componentSize, stride: stride, normalized: normalized}, nil
}

func (accessor *glbAccessorData) value(item, component int) (float64, error) {
	if item < 0 || item >= accessor.count || component < 0 || component >= accessor.components {
		return 0, fmt.Errorf("accessor 读取越界")
	}
	offset := item*accessor.stride + component*accessor.componentSize
	var value float64
	switch accessor.componentType {
	case 5120:
		value = float64(int8(accessor.data[offset]))
		if accessor.normalized {
			value = math.Max(value/127, -1)
		}
	case 5121:
		value = float64(accessor.data[offset])
		if accessor.normalized {
			value /= 255
		}
	case 5122:
		value = float64(int16(binary.LittleEndian.Uint16(accessor.data[offset : offset+2])))
		if accessor.normalized {
			value = math.Max(value/32767, -1)
		}
	case 5123:
		value = float64(binary.LittleEndian.Uint16(accessor.data[offset : offset+2]))
		if accessor.normalized {
			value /= 65535
		}
	case 5125:
		value = float64(binary.LittleEndian.Uint32(accessor.data[offset : offset+4]))
		if accessor.normalized {
			value /= 4294967295
		}
	case 5126:
		value = float64(math.Float32frombits(binary.LittleEndian.Uint32(accessor.data[offset : offset+4])))
	}
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0, fmt.Errorf("accessor 包含非有限数值")
	}
	return value, nil
}
