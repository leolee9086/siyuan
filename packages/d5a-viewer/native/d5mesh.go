package d5a

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"unicode/utf16"
)

const (
	protectedD5MeshMarker = 0x206c6c41
	maxD5MeshItems        = 100_000
	maxD5MeshString       = 1_048_576
	legacyVertexStride    = 8
)

var errProtectedD5Mesh = errors.New("D5Mesh 使用受保护的官方素材库载荷")

type d5MeshSummary struct {
	Version               uint32 `json:"version"`
	SourceBytes           int64  `json:"sourceBytes"`
	TriangleCount         int64  `json:"triangleCount"`
	VertexCount           int64  `json:"vertexCount"`
	DescriptorCount       int    `json:"descriptorCount"`
	GeometryGroupCount    int    `json:"geometryGroupCount"`
	MetadataTriangleCount *int64 `json:"metadataTriangleCount,omitempty"`
}

type meshDescriptor struct {
	key          string
	materialName string
	meshName     string
	groupIndex   int
	transform    matrix4
}

type meshGroup struct {
	key       string
	vertices  int64
	triangles int64
	positions []float32
	indices   []uint32
}

type parsedD5Mesh struct {
	summary     d5MeshSummary
	warnings    []string
	descriptors []meshDescriptor
	groups      []meshGroup
}

type binaryStreamReader struct {
	reader io.Reader
	offset int64
	length int64
}

func parseD5MeshStream(source io.Reader, sourceBytes int64) (*parsedD5Mesh, error) {
	return parseD5MeshStreamMode(source, sourceBytes, false)
}

func parseD5MeshGeometryStream(source io.Reader, sourceBytes int64) (*parsedD5Mesh, error) {
	return parseD5MeshStreamMode(source, sourceBytes, true)
}

func parseD5MeshStreamMode(source io.Reader, sourceBytes int64, loadGeometry bool) (*parsedD5Mesh, error) {
	reader := &binaryStreamReader{reader: source, length: sourceBytes}
	versionValue, errorValue := reader.uint32()
	if errorValue != nil {
		return nil, errorValue
	}
	if versionValue == protectedD5MeshMarker {
		return nil, errProtectedD5Mesh
	}
	if versionValue != 9 && versionValue != 10 && versionValue != 11 {
		return nil, fmt.Errorf("D5Mesh 版本 %d 尚未映射；当前支持 9、10、11", versionValue)
	}
	if versionValue == 11 {
		return parseSeparatedD5Mesh(reader, versionValue, sourceBytes, loadGeometry)
	}
	return parseInterleavedD5Mesh(reader, versionValue, sourceBytes, loadGeometry)
}

func parseSeparatedD5Mesh(reader *binaryStreamReader, versionValue uint32, sourceBytes int64, loadGeometry bool) (*parsedD5Mesh, error) {
	metadataText, errorValue := reader.countedUTF16()
	if errorValue != nil {
		return nil, errorValue
	}
	metadataTriangle, errorValue := parseMetadataTriangle(metadataText)
	if errorValue != nil {
		return nil, errorValue
	}
	warnings := []string{}
	reserved, errorValue := reader.uint32()
	if errorValue != nil {
		return nil, errorValue
	}
	if reserved != 0 {
		warnings = append(warnings, fmt.Sprintf("Header reserved field is %d, expected 0", reserved))
	}
	descriptorCount, errorValue := reader.boundedCount("descriptor")
	if errorValue != nil {
		return nil, errorValue
	}
	descriptors := make([]meshDescriptor, descriptorCount)
	for index := range descriptors {
		key, readError := reader.countedUTF16()
		if readError != nil {
			return nil, fmt.Errorf("descriptor %d key: %w", index, readError)
		}
		materialName, readError := reader.countedUTF16()
		if readError != nil {
			return nil, fmt.Errorf("descriptor %d material: %w", index, readError)
		}
		transform, readError := reader.matrix4(fmt.Sprintf("descriptor %d transform", index))
		if readError != nil {
			return nil, readError
		}
		descriptors[index] = meshDescriptor{key: key, materialName: materialName, groupIndex: -1, transform: transform}
	}
	groupCount, errorValue := reader.boundedCount("geometry group")
	if errorValue != nil {
		return nil, errorValue
	}
	groups := make([]meshGroup, 0, groupCount)
	for groupIndex := 0; groupIndex < groupCount; groupIndex++ {
		key, readError := reader.countedUTF16()
		if readError != nil {
			return nil, fmt.Errorf("group %d key: %w", groupIndex, readError)
		}
		var positions []float32
		var positionCount uint32
		if loadGeometry {
			positions, readError = reader.countedFloat32(fmt.Sprintf("group %d positions", groupIndex))
			positionCount = uint32(len(positions))
		} else {
			positionCount, readError = reader.skipCountedFloat32(fmt.Sprintf("group %d positions", groupIndex))
		}
		if readError != nil {
			return nil, readError
		}
		normalCount, readError := reader.skipCountedFloat32(fmt.Sprintf("group %d normals", groupIndex))
		if readError != nil {
			return nil, readError
		}
		uvCount, readError := reader.skipCountedFloat32(fmt.Sprintf("group %d UVs", groupIndex))
		if readError != nil {
			return nil, readError
		}
		if _, readError = reader.skipCountedFloat32(fmt.Sprintf("group %d extra attribute", groupIndex)); readError != nil {
			return nil, readError
		}
		if positionCount%3 != 0 {
			return nil, fmt.Errorf("group %d position float count is not divisible by 3", groupIndex)
		}
		vertices := int64(positionCount / 3)
		if normalCount != positionCount {
			return nil, fmt.Errorf("group %d normal count does not match positions", groupIndex)
		}
		if int64(uvCount) != vertices*2 {
			return nil, fmt.Errorf("group %d UV count does not match positions", groupIndex)
		}
		var indices []uint32
		var indexCount uint32
		if loadGeometry {
			indices, readError = reader.readIndices(vertices, fmt.Sprintf("group %d indices", groupIndex))
			indexCount = uint32(len(indices))
		} else {
			indexCount, readError = reader.readAndValidateIndices(vertices, fmt.Sprintf("group %d indices", groupIndex))
		}
		if readError != nil {
			return nil, readError
		}
		if indexCount%3 != 0 {
			return nil, fmt.Errorf("group %d index count is not divisible by 3", groupIndex)
		}
		matched := false
		for descriptorIndex := range descriptors {
			if descriptors[descriptorIndex].key == key {
				descriptors[descriptorIndex].groupIndex = groupIndex
				matched = true
			}
		}
		if !matched {
			warnings = append(warnings, fmt.Sprintf("Geometry group %d has no descriptor for key %s", groupIndex, key))
		}
		groups = append(groups, meshGroup{key: key, vertices: vertices, triangles: int64(indexCount / 3), positions: positions, indices: indices})
	}
	for index, descriptor := range descriptors {
		if descriptor.groupIndex < 0 {
			warnings = append(warnings, fmt.Sprintf("Descriptor %d has no geometry group for key %s", index, descriptor.key))
		}
	}
	return finishD5Mesh(reader, versionValue, sourceBytes, metadataTriangle, descriptors, groups, warnings)
}

func parseInterleavedD5Mesh(reader *binaryStreamReader, versionValue uint32, sourceBytes int64, loadGeometry bool) (*parsedD5Mesh, error) {
	metadataText, errorValue := reader.countedUTF8()
	if errorValue != nil {
		return nil, errorValue
	}
	metadataTriangle, errorValue := parseMetadataTriangle(metadataText)
	if errorValue != nil {
		return nil, errorValue
	}
	warnings := []string{}
	groupCount, errorValue := reader.boundedCount("geometry group")
	if errorValue != nil {
		return nil, errorValue
	}
	groups := make([]meshGroup, 0, groupCount)
	firstGroupByKey := map[string]int{}
	for groupIndex := 0; groupIndex < groupCount; groupIndex++ {
		key, readError := reader.countedUTF8()
		if readError != nil {
			return nil, fmt.Errorf("group %d key: %w", groupIndex, readError)
		}
		vertexCount, readError := reader.uint32()
		if readError != nil {
			return nil, readError
		}
		floatCount, valid := checkedMultiply(uint64(vertexCount), legacyVertexStride)
		if !valid {
			return nil, fmt.Errorf("group %d interleaved vertex count overflows", groupIndex)
		}
		var positions []float32
		if loadGeometry {
			positions, readError = reader.interleavedPositions(vertexCount, legacyVertexStride, fmt.Sprintf("group %d interleaved vertices", groupIndex))
		} else {
			readError = reader.skipFloat32(floatCount, fmt.Sprintf("group %d interleaved vertices", groupIndex))
		}
		if readError != nil {
			return nil, readError
		}
		var indices []uint32
		var indexCount uint32
		if loadGeometry {
			indices, readError = reader.readIndices(int64(vertexCount), fmt.Sprintf("group %d indices", groupIndex))
			indexCount = uint32(len(indices))
		} else {
			indexCount, readError = reader.readAndValidateIndices(int64(vertexCount), fmt.Sprintf("group %d indices", groupIndex))
		}
		if readError != nil {
			return nil, readError
		}
		if indexCount%3 != 0 {
			return nil, fmt.Errorf("group %d index count is not divisible by 3", groupIndex)
		}
		if _, exists := firstGroupByKey[key]; !exists {
			firstGroupByKey[key] = groupIndex
		}
		groups = append(groups, meshGroup{key: key, vertices: int64(vertexCount), triangles: int64(indexCount / 3), positions: positions, indices: indices})
	}
	descriptors := []meshDescriptor{}
	if reader.remaining() > 0 {
		descriptorCount, readError := reader.boundedCount("instance descriptor")
		if readError != nil {
			return nil, readError
		}
		descriptors = make([]meshDescriptor, descriptorCount)
		for index := range descriptors {
			key, itemError := reader.countedUTF8()
			if itemError != nil {
				return nil, itemError
			}
			trailingName, itemError := reader.countedUTF8()
			if itemError != nil {
				return nil, itemError
			}
			groupIndex := -1
			transformCount := uint64(9)
			if versionValue == 9 {
				transformCount = 16
				if index < len(groups) {
					groupIndex = index
				}
			} else if matching, exists := firstGroupByKey[key]; exists {
				groupIndex = matching
			}
			values, itemError := reader.float64Values(transformCount, fmt.Sprintf("descriptor %d transform", index))
			if itemError != nil {
				return nil, itemError
			}
			transform := identityMatrix4()
			materialName := trailingName
			meshName := ""
			if versionValue == 9 {
				copy(transform[:], values)
				meshName = trailingName
				if groupIndex >= 0 {
					materialName = groups[groupIndex].key
				}
			} else {
				transform = legacyTRSMatrix(values)
			}
			descriptors[index] = meshDescriptor{key: key, materialName: materialName, meshName: meshName, groupIndex: groupIndex, transform: transform}
		}
		if versionValue == 9 && len(descriptors) != len(groups) {
			warnings = append(warnings, fmt.Sprintf("Version 9 has %d descriptors for %d geometry groups", len(descriptors), len(groups)))
		}
		if versionValue == 10 && reader.remaining() >= 4 {
			terminal, itemError := reader.uint32()
			if itemError != nil {
				return nil, itemError
			}
			if terminal != 0 {
				warnings = append(warnings, fmt.Sprintf("Version 10 terminal field is %d, expected 0", terminal))
			}
		}
		for index, descriptor := range descriptors {
			if descriptor.groupIndex < 0 {
				warnings = append(warnings, fmt.Sprintf("Descriptor %d has no geometry group for key %s", index, descriptor.key))
			}
		}
	}
	return finishD5Mesh(reader, versionValue, sourceBytes, metadataTriangle, descriptors, groups, warnings)
}

func finishD5Mesh(reader *binaryStreamReader, versionValue uint32, sourceBytes int64, metadataTriangle *int64, descriptors []meshDescriptor, groups []meshGroup, warnings []string) (*parsedD5Mesh, error) {
	instances := make([]int64, len(groups))
	for _, descriptor := range descriptors {
		if descriptor.groupIndex >= 0 && descriptor.groupIndex < len(groups) {
			instances[descriptor.groupIndex]++
		}
	}
	var triangles int64
	var vertices int64
	for index, group := range groups {
		instanceCount := instances[index]
		if instanceCount < 1 {
			instanceCount = 1
		}
		triangles += group.triangles * instanceCount
		vertices += group.vertices * instanceCount
	}
	if remaining := reader.remaining(); remaining != 0 {
		warnings = append(warnings, fmt.Sprintf("%d trailing bytes were not parsed", remaining))
		if errorValue := reader.skip(uint64(remaining), "trailing bytes"); errorValue != nil {
			return nil, errorValue
		}
	}
	if metadataTriangle != nil && *metadataTriangle != triangles {
		warnings = append(warnings, fmt.Sprintf("Metadata reports %d triangles; geometry contains %d", *metadataTriangle, triangles))
	}
	return &parsedD5Mesh{
		summary: d5MeshSummary{
			Version: versionValue, SourceBytes: sourceBytes, TriangleCount: triangles, VertexCount: vertices,
			DescriptorCount: len(descriptors), GeometryGroupCount: len(groups), MetadataTriangleCount: metadataTriangle,
		},
		warnings:    warnings,
		descriptors: descriptors,
		groups:      groups,
	}, nil
}

func parseMetadataTriangle(text string) (*int64, error) {
	var metadata map[string]any
	if errorValue := json.Unmarshal([]byte(text), &metadata); errorValue != nil {
		return nil, fmt.Errorf("D5Mesh metadata JSON 无效: %w", errorValue)
	}
	value, exists := metadata["triangleCount"].(float64)
	if !exists || math.IsNaN(value) || math.IsInf(value, 0) || value != math.Trunc(value) {
		return nil, nil
	}
	result := int64(value)
	return &result, nil
}

func (reader *binaryStreamReader) remaining() int64 {
	return reader.length - reader.offset
}

func (reader *binaryStreamReader) read(bytes []byte, label string) error {
	if int64(len(bytes)) > reader.remaining() {
		return fmt.Errorf("读取 %s 需要 %d 字节，当前位置只剩 %d 字节 (offset 0x%x)", label, len(bytes), reader.remaining(), reader.offset)
	}
	if _, errorValue := io.ReadFull(reader.reader, bytes); errorValue != nil {
		return fmt.Errorf("读取 %s 失败: %w", label, errorValue)
	}
	reader.offset += int64(len(bytes))
	return nil
}

func (reader *binaryStreamReader) uint32() (uint32, error) {
	buffer := [4]byte{}
	if errorValue := reader.read(buffer[:], "uint32"); errorValue != nil {
		return 0, errorValue
	}
	return binary.LittleEndian.Uint32(buffer[:]), nil
}

func (reader *binaryStreamReader) boundedCount(label string) (int, error) {
	count, errorValue := reader.uint32()
	if errorValue != nil {
		return 0, errorValue
	}
	if count > maxD5MeshItems {
		return 0, fmt.Errorf("%s count %d exceeds %d", label, count, maxD5MeshItems)
	}
	return int(count), nil
}

func (reader *binaryStreamReader) countedUTF8() (string, error) {
	length, errorValue := reader.uint32()
	if errorValue != nil {
		return "", errorValue
	}
	if length > maxD5MeshString {
		return "", fmt.Errorf("UTF-8 string length %d exceeds %d", length, maxD5MeshString)
	}
	buffer := make([]byte, length)
	if errorValue = reader.read(buffer, "UTF-8 string"); errorValue != nil {
		return "", errorValue
	}
	return string(buffer), nil
}

func (reader *binaryStreamReader) countedUTF16() (string, error) {
	length, errorValue := reader.uint32()
	if errorValue != nil {
		return "", errorValue
	}
	if length > maxD5MeshString {
		return "", fmt.Errorf("UTF-16 string length %d exceeds %d", length, maxD5MeshString)
	}
	byteLength, valid := checkedMultiply(uint64(length), 2)
	if !valid {
		return "", fmt.Errorf("UTF-16 string length overflows")
	}
	buffer := make([]byte, byteLength)
	if errorValue = reader.read(buffer, "UTF-16 string"); errorValue != nil {
		return "", errorValue
	}
	units := make([]uint16, length)
	for index := range units {
		units[index] = binary.LittleEndian.Uint16(buffer[index*2 : index*2+2])
	}
	return string(utf16.Decode(units)), nil
}

func (reader *binaryStreamReader) skipCountedFloat32(label string) (uint32, error) {
	count, errorValue := reader.uint32()
	if errorValue != nil {
		return 0, errorValue
	}
	if errorValue = reader.skipFloat32(uint64(count), label); errorValue != nil {
		return 0, errorValue
	}
	return count, nil
}

func (reader *binaryStreamReader) countedFloat32(label string) ([]float32, error) {
	count, errorValue := reader.uint32()
	if errorValue != nil {
		return nil, errorValue
	}
	byteLength, valid := checkedMultiply(uint64(count), 4)
	if !valid || byteLength > uint64(reader.remaining()) {
		return nil, fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	values := make([]float32, count)
	buffer := make([]byte, 256*1024)
	for first := 0; first < len(values); {
		itemCount := len(buffer) / 4
		if remaining := len(values) - first; remaining < itemCount {
			itemCount = remaining
		}
		chunk := buffer[:itemCount*4]
		if errorValue = reader.read(chunk, label); errorValue != nil {
			return nil, errorValue
		}
		for local := 0; local < itemCount; local++ {
			values[first+local] = math.Float32frombits(binary.LittleEndian.Uint32(chunk[local*4 : local*4+4]))
		}
		first += itemCount
	}
	return values, nil
}

func (reader *binaryStreamReader) float64Values(count uint64, label string) ([]float64, error) {
	byteLength, valid := checkedMultiply(count, 4)
	if !valid || byteLength > uint64(reader.remaining()) {
		return nil, fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	buffer := make([]byte, byteLength)
	if errorValue := reader.read(buffer, label); errorValue != nil {
		return nil, errorValue
	}
	values := make([]float64, count)
	for index := range values {
		values[index] = float64(math.Float32frombits(binary.LittleEndian.Uint32(buffer[index*4 : index*4+4])))
	}
	return values, nil
}

func (reader *binaryStreamReader) matrix4(label string) (matrix4, error) {
	values, errorValue := reader.float64Values(16, label)
	if errorValue != nil {
		return matrix4{}, errorValue
	}
	result := identityMatrix4()
	copy(result[:], values)
	return result, nil
}

func (reader *binaryStreamReader) interleavedPositions(vertexCount uint32, stride uint64, label string) ([]float32, error) {
	floatCount, valid := checkedMultiply(uint64(vertexCount), stride)
	if !valid {
		return nil, fmt.Errorf("%s float count overflows", label)
	}
	byteLength, valid := checkedMultiply(floatCount, 4)
	if !valid || byteLength > uint64(reader.remaining()) {
		return nil, fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	positions := make([]float32, uint64(vertexCount)*3)
	vertexBytes := int(stride * 4)
	verticesPerChunk := (256 * 1024) / vertexBytes
	if verticesPerChunk < 1 {
		verticesPerChunk = 1
	}
	buffer := make([]byte, verticesPerChunk*vertexBytes)
	for first := 0; first < int(vertexCount); {
		count := verticesPerChunk
		if remaining := int(vertexCount) - first; remaining < count {
			count = remaining
		}
		chunk := buffer[:count*vertexBytes]
		if errorValue := reader.read(chunk, label); errorValue != nil {
			return nil, errorValue
		}
		for local := 0; local < count; local++ {
			source := local * vertexBytes
			target := (first + local) * 3
			positions[target] = math.Float32frombits(binary.LittleEndian.Uint32(chunk[source : source+4]))
			positions[target+1] = math.Float32frombits(binary.LittleEndian.Uint32(chunk[source+4 : source+8]))
			positions[target+2] = math.Float32frombits(binary.LittleEndian.Uint32(chunk[source+8 : source+12]))
		}
		first += count
	}
	return positions, nil
}

func (reader *binaryStreamReader) skipFloat32(count uint64, label string) error {
	byteLength, valid := checkedMultiply(count, 4)
	if !valid {
		return fmt.Errorf("%s float count overflows", label)
	}
	return reader.skip(byteLength, label)
}

func (reader *binaryStreamReader) skip(byteLength uint64, label string) error {
	if byteLength > uint64(math.MaxInt64) || int64(byteLength) > reader.remaining() {
		return fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	written, errorValue := io.CopyN(io.Discard, reader.reader, int64(byteLength))
	reader.offset += written
	if errorValue != nil {
		return fmt.Errorf("跳过 %s 失败: %w", label, errorValue)
	}
	return nil
}

func (reader *binaryStreamReader) readAndValidateIndices(vertices int64, label string) (uint32, error) {
	count, errorValue := reader.uint32()
	if errorValue != nil {
		return 0, errorValue
	}
	byteLength, valid := checkedMultiply(uint64(count), 4)
	if !valid || byteLength > uint64(reader.remaining()) {
		return 0, fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	buffer := make([]byte, 64*1024)
	remaining := int64(byteLength)
	indexOffset := uint32(0)
	for remaining > 0 {
		readLength := int64(len(buffer))
		if remaining < readLength {
			readLength = remaining
		}
		chunk := buffer[:readLength]
		if errorValue = reader.read(chunk, label); errorValue != nil {
			return 0, errorValue
		}
		for offset := 0; offset < len(chunk); offset += 4 {
			value := binary.LittleEndian.Uint32(chunk[offset : offset+4])
			if int64(value) >= vertices {
				return 0, fmt.Errorf("%s index %d at %d exceeds vertex count %d", label, value, indexOffset, vertices)
			}
			indexOffset++
		}
		remaining -= readLength
	}
	return count, nil
}

func (reader *binaryStreamReader) readIndices(vertices int64, label string) ([]uint32, error) {
	count, errorValue := reader.uint32()
	if errorValue != nil {
		return nil, errorValue
	}
	byteLength, valid := checkedMultiply(uint64(count), 4)
	if !valid || byteLength > uint64(reader.remaining()) {
		return nil, fmt.Errorf("%s requires %d bytes, only %d remain", label, byteLength, reader.remaining())
	}
	indices := make([]uint32, count)
	buffer := make([]byte, 256*1024)
	for first := 0; first < len(indices); {
		itemCount := len(buffer) / 4
		if remaining := len(indices) - first; remaining < itemCount {
			itemCount = remaining
		}
		chunk := buffer[:itemCount*4]
		if errorValue = reader.read(chunk, label); errorValue != nil {
			return nil, errorValue
		}
		for local := 0; local < itemCount; local++ {
			value := binary.LittleEndian.Uint32(chunk[local*4 : local*4+4])
			index := first + local
			if int64(value) >= vertices {
				return nil, fmt.Errorf("%s index %d at %d exceeds vertex count %d", label, value, index, vertices)
			}
			indices[index] = value
		}
		first += itemCount
	}
	return indices, nil
}

func checkedMultiply(value uint64, stride uint64) (uint64, bool) {
	if stride != 0 && value > math.MaxUint64/stride {
		return 0, false
	}
	return value * stride, true
}
