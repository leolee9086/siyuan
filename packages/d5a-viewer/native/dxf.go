package d5a

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"math"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode"
)

const dxfMeters = 6

type sceneDocumentMetrics struct {
	NodeCount             int   `json:"nodeCount"`
	MeshNodeCount         int   `json:"meshNodeCount"`
	MeshDefinitionCount   int   `json:"meshDefinitionCount"`
	PrimitiveCount        int   `json:"primitiveCount"`
	TriangleCount         int64 `json:"triangleCount"`
	VertexCount           int64 `json:"vertexCount"`
	MaterialCount         int   `json:"materialCount"`
	TextureCount          int   `json:"textureCount"`
	ImageCount            int   `json:"imageCount"`
	PrimitivesWithNormals int   `json:"primitivesWithNormals"`
	PrimitivesWithUV0     int   `json:"primitivesWithUv0"`
	PrimitivesWithUV1     int   `json:"primitivesWithUv1"`
	AnimationCount        int   `json:"animationCount"`
	SkinCount             int   `json:"skinCount"`
}

type conversionDiagnostic struct {
	Severity string `json:"severity"`
	Code     string `json:"code"`
	Message  string `json:"message"`
	Path     string `json:"path,omitempty"`
}

type conversionCheck struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Status   string `json:"status"`
	Expected any    `json:"expected"`
	Actual   any    `json:"actual"`
	Detail   string `json:"detail,omitempty"`
}

type sceneConversionReport struct {
	SchemaVersion int                    `json:"schemaVersion"`
	DocumentKind  string                 `json:"documentKind"`
	Operation     string                 `json:"operation"`
	Status        string                 `json:"status"`
	SourceFormat  string                 `json:"sourceFormat"`
	TargetFormat  string                 `json:"targetFormat"`
	SourceName    string                 `json:"sourceName"`
	OutputName    string                 `json:"outputName"`
	OutputBytes   int64                  `json:"outputBytes"`
	ElapsedMS     float64                `json:"elapsedMs"`
	Source        sceneDocumentMetrics   `json:"source"`
	RoundTrip     sceneDocumentMetrics   `json:"roundTrip"`
	Checks        []conversionCheck      `json:"checks"`
	Warnings      []conversionDiagnostic `json:"warnings"`
	Input         string                 `json:"input"`
	Output        string                 `json:"output"`
	Report        string                 `json:"report"`
	Runtime       runtimeSummary         `json:"runtime"`
}

type dxfLayer struct {
	name         string
	trueColor    uint32
	transparency uint8
}

type dxfSceneSource struct {
	name          string
	format        string
	metrics       sceneDocumentMetrics
	layers        []dxfLayer
	diagnostics   []conversionDiagnostic
	writeEntities func(context.Context, *dxfEncoder) error
}

type dxfEncoder struct {
	writer    *bufio.Writer
	faceCount int64
	minimum   point3
	maximum   point3
	peak      *runtimePeak
}

type dxfInspection struct {
	FaceCount              int64 `json:"faceCount"`
	DeclaredLayerCount     int   `json:"declaredLayerCount"`
	UsedLayerCount         int   `json:"usedLayerCount"`
	TrueColorCount         int64 `json:"trueColorCount"`
	UnsupportedEntityCount int64 `json:"unsupportedEntityCount"`
	InsertionUnits         int   `json:"insertionUnits"`
	SawEOF                 bool  `json:"sawEof"`
	Bounds                 struct {
		Min point3 `json:"min"`
		Max point3 `json:"max"`
	} `json:"bounds"`
}

func convertCommand(argv []string) error {
	args, errorValue := parseArguments(argv, []string{"input", "output", "format", "report"}, []string{"overwrite", "json", "quiet"})
	if errorValue != nil {
		return errorValue
	}
	input := args.one("input")
	if input == "" && len(args.positionals) > 0 {
		input = args.positionals[0]
	}
	if input == "" {
		return fmt.Errorf("请提供待转换的 .d5a 或 .glb 文件")
	}
	if len(args.positionals) > 1 {
		return fmt.Errorf("场景转换只接受一个输入文件")
	}
	output := args.one("output")
	if output == "" {
		return fmt.Errorf("--output 需要值")
	}
	input, errorValue = filepath.Abs(input)
	if errorValue != nil {
		return errorValue
	}
	output, errorValue = filepath.Abs(output)
	if errorValue != nil {
		return errorValue
	}
	sourceFormat, errorValue := sceneFormat(input)
	if errorValue != nil {
		return errorValue
	}
	targetFormat := strings.ToLower(strings.TrimPrefix(args.one("format"), "."))
	if targetFormat == "" {
		targetFormat = strings.TrimPrefix(strings.ToLower(filepath.Ext(output)), ".")
	}
	if targetFormat != "dxf" || !strings.EqualFold(filepath.Ext(output), ".dxf") {
		return fmt.Errorf("Go 原生 convert 当前要求输出扩展名与 --format 均为 dxf")
	}
	reportPath := args.one("report")
	if reportPath == "" {
		reportPath = output + ".fidelity.json"
	}
	reportPath, errorValue = filepath.Abs(reportPath)
	if errorValue != nil {
		return errorValue
	}
	if strings.EqualFold(output, reportPath) {
		return fmt.Errorf("场景输出与保真报告路径必须不同")
	}
	if !args.flags["overwrite"] {
		if pathExists(output) {
			return fmt.Errorf("输出已存在：%s；使用 --overwrite 覆盖", output)
		}
		if pathExists(reportPath) {
			return fmt.Errorf("输出已存在：%s；使用 --overwrite 覆盖", reportPath)
		}
	}
	started := time.Now()
	contextValue, stop := signalContext()
	defer stop()
	source, errorValue := loadDxfSceneSource(contextValue, input, sourceFormat)
	if errorValue != nil {
		return errorValue
	}
	report, errorValue := writeAndVerifyDxf(contextValue, input, output, reportPath, source, args.flags["overwrite"], started)
	if errorValue != nil {
		return errorValue
	}
	if args.flags["json"] {
		return printJSON(report)
	}
	fmt.Printf("%s -> %s: %s\n", filepath.Base(input), filepath.Base(output), report.Status)
	fmt.Printf("%s -> DXF / %d 字节 / %.1f ms\n", strings.ToUpper(sourceFormat), report.OutputBytes, report.ElapsedMS)
	for _, check := range report.Checks {
		fmt.Printf("%s: %s\n", check.Label, check.Status)
	}
	for _, warning := range report.Warnings {
		fmt.Printf("警告: %s\n", warning.Message)
	}
	fmt.Printf("保真报告 %s\n", reportPath)
	return nil
}

func signalContext() (context.Context, context.CancelFunc) {
	return signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
}

func loadDxfSceneSource(contextValue context.Context, input, format string) (*dxfSceneSource, error) {
	if format == "d5a" {
		return loadD5aDxfSource(contextValue, input)
	}
	return loadGlbDxfSource(contextValue, input)
}

func writeAndVerifyDxf(
	contextValue context.Context,
	input, output, reportPath string,
	source *dxfSceneSource,
	overwrite bool,
	started time.Time,
) (*sceneConversionReport, error) {
	peak := &runtimePeak{}
	peak.sample()
	if errorValue := os.MkdirAll(filepath.Dir(output), 0o755); errorValue != nil {
		return nil, errorValue
	}
	temporary, errorValue := os.CreateTemp(filepath.Dir(output), filepath.Base(output)+".*.partial.dxf")
	if errorValue != nil {
		return nil, errorValue
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		_ = temporary.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()
	encoder := newDxfEncoder(temporary)
	encoder.peak = peak
	if errorValue = encoder.writePreamble(source.name, source.layers); errorValue != nil {
		return nil, errorValue
	}
	if errorValue = source.writeEntities(contextValue, encoder); errorValue != nil {
		return nil, errorValue
	}
	if errorValue = encoder.finish(); errorValue != nil {
		return nil, errorValue
	}
	if errorValue = temporary.Sync(); errorValue != nil {
		return nil, errorValue
	}
	if errorValue = temporary.Close(); errorValue != nil {
		return nil, errorValue
	}
	inspection, errorValue := inspectDxf(temporaryPath)
	if errorValue != nil {
		return nil, fmt.Errorf("DXF 回读失败: %w", errorValue)
	}
	checks := []conversionCheck{
		{ID: "triangles", Label: "三角面数量", Status: checkStatus(inspection.FaceCount == source.metrics.TriangleCount), Expected: source.metrics.TriangleCount, Actual: inspection.FaceCount},
		{ID: "dxf-layer-table", Label: "DXF 图层声明", Status: checkStatus(inspection.DeclaredLayerCount >= inspection.UsedLayerCount), Expected: fmt.Sprintf("%d 个已用图层均有声明", inspection.UsedLayerCount), Actual: fmt.Sprintf("%d 个声明图层", inspection.DeclaredLayerCount)},
		{ID: "dxf-units", Label: "DXF 米制单位", Status: checkStatus(inspection.InsertionUnits == dxfMeters), Expected: dxfMeters, Actual: inspection.InsertionUnits},
		{ID: "dxf-eof", Label: "DXF 结束标记", Status: checkStatus(inspection.SawEOF), Expected: true, Actual: inspection.SawEOF},
	}
	for _, check := range checks {
		if check.Status == "fail" {
			return nil, fmt.Errorf("DXF 保真门禁失败: %s", check.Label)
		}
	}
	metadata, errorValue := os.Stat(temporaryPath)
	if errorValue != nil {
		return nil, errorValue
	}
	if errorValue = replaceFile(temporaryPath, output, overwrite); errorValue != nil {
		return nil, errorValue
	}
	committed = true
	roundTrip := sceneDocumentMetrics{
		NodeCount: 1, MeshNodeCount: inspection.UsedLayerCount, MeshDefinitionCount: inspection.UsedLayerCount,
		PrimitiveCount: inspection.UsedLayerCount, TriangleCount: inspection.FaceCount,
	}
	status := "pass"
	if len(source.diagnostics) > 0 {
		status = "warning"
	}
	report := &sceneConversionReport{
		SchemaVersion: 1, DocumentKind: "scene", Operation: "convert", Status: status,
		SourceFormat: source.format, TargetFormat: "dxf", SourceName: filepath.Base(input), OutputName: filepath.Base(output),
		OutputBytes: metadata.Size(), ElapsedMS: float64(time.Since(started).Microseconds()) / 1000,
		Source: source.metrics, RoundTrip: roundTrip, Checks: checks, Warnings: source.diagnostics,
		Input: input, Output: output, Report: reportPath, Runtime: runtimeSinceWithPeak(started, peak),
	}
	if errorValue = writeJSONAtomically(reportPath, report); errorValue != nil {
		return nil, errorValue
	}
	return report, nil
}

func checkStatus(value bool) string {
	if value {
		return "pass"
	}
	return "fail"
}

func newDxfEncoder(writer io.Writer) *dxfEncoder {
	return &dxfEncoder{
		writer:  bufio.NewWriterSize(writer, 1024*1024),
		minimum: point3{math.Inf(1), math.Inf(1), math.Inf(1)},
		maximum: point3{math.Inf(-1), math.Inf(-1), math.Inf(-1)},
	}
}

func (encoder *dxfEncoder) writePreamble(name string, layers []dxfLayer) error {
	text := "999\r\nD5 Asset Studio ASCII DXF export\r\n"
	text += "999\r\n" + singleLine(name) + "\r\n"
	text += "0\r\nSECTION\r\n2\r\nHEADER\r\n"
	text += "9\r\n$ACADVER\r\n1\r\nAC1024\r\n"
	text += "9\r\n$DWGCODEPAGE\r\n3\r\nUTF-8\r\n"
	text += "9\r\n$INSUNITS\r\n70\r\n6\r\n"
	text += "9\r\n$MEASUREMENT\r\n70\r\n1\r\n0\r\nENDSEC\r\n"
	text += "0\r\nSECTION\r\n2\r\nTABLES\r\n"
	text += "0\r\nTABLE\r\n2\r\nLTYPE\r\n70\r\n1\r\n"
	text += "0\r\nLTYPE\r\n100\r\nAcDbSymbolTableRecord\r\n100\r\nAcDbLinetypeTableRecord\r\n2\r\nCONTINUOUS\r\n70\r\n0\r\n3\r\nSolid line\r\n72\r\n65\r\n73\r\n0\r\n40\r\n0\r\n0\r\nENDTAB\r\n"
	text += fmt.Sprintf("0\r\nTABLE\r\n2\r\nLAYER\r\n70\r\n%d\r\n", len(layers)+1)
	if _, errorValue := encoder.writer.WriteString(text); errorValue != nil {
		return errorValue
	}
	if errorValue := encoder.writeLayer(dxfLayer{name: "0", trueColor: 0xffffff}); errorValue != nil {
		return errorValue
	}
	for _, layer := range layers {
		if errorValue := encoder.writeLayer(layer); errorValue != nil {
			return errorValue
		}
	}
	_, errorValue := encoder.writer.WriteString("0\r\nENDTAB\r\n0\r\nENDSEC\r\n0\r\nSECTION\r\n2\r\nENTITIES\r\n")
	return errorValue
}

func (encoder *dxfEncoder) writeLayer(layer dxfLayer) error {
	text := "0\r\nLAYER\r\n100\r\nAcDbSymbolTableRecord\r\n100\r\nAcDbLayerTableRecord\r\n"
	text += "2\r\n" + layer.name + "\r\n70\r\n0\r\n62\r\n7\r\n420\r\n" + strconv.FormatUint(uint64(layer.trueColor), 10) + "\r\n"
	if layer.transparency > 0 {
		text += "440\r\n" + strconv.FormatUint(uint64(0x02000000|uint32(layer.transparency)), 10) + "\r\n"
	}
	text += "6\r\nCONTINUOUS\r\n"
	_, errorValue := encoder.writer.WriteString(text)
	return errorValue
}

func (encoder *dxfEncoder) writeFace(layer dxfLayer, a, b, c point3) error {
	buffer := make([]byte, 0, 512)
	buffer = append(buffer, "0\r\n3DFACE\r\n100\r\nAcDbEntity\r\n8\r\n"...)
	buffer = append(buffer, layer.name...)
	buffer = append(buffer, "\r\n420\r\n"...)
	buffer = strconv.AppendUint(buffer, uint64(layer.trueColor), 10)
	buffer = append(buffer, "\r\n100\r\nAcDbFace\r\n"...)
	points := [4]point3{a, b, c, c}
	for vertex, point := range points {
		for component := 0; component < 3; component++ {
			buffer = strconv.AppendInt(buffer, int64(10+vertex+component*10), 10)
			buffer = append(buffer, '\r', '\n')
			value := point[component]
			if math.Abs(value) < 1e-12 {
				value = 0
			}
			buffer = strconv.AppendFloat(buffer, value, 'g', 12, 64)
			buffer = append(buffer, '\r', '\n')
			if value < encoder.minimum[component] {
				encoder.minimum[component] = value
			}
			if value > encoder.maximum[component] {
				encoder.maximum[component] = value
			}
		}
	}
	if _, errorValue := encoder.writer.Write(buffer); errorValue != nil {
		return errorValue
	}
	encoder.faceCount++
	if encoder.peak != nil && encoder.faceCount%4096 == 0 {
		encoder.peak.sample()
	}
	return nil
}

func (encoder *dxfEncoder) finish() error {
	if encoder.faceCount == 0 {
		return fmt.Errorf("DXF 没有可写出的三角面")
	}
	if _, errorValue := encoder.writer.WriteString("0\r\nENDSEC\r\n0\r\nEOF\r\n"); errorValue != nil {
		return errorValue
	}
	return encoder.writer.Flush()
}

type dxfEntityState struct {
	typeName string
	layer    string
	points   [4]point3
	present  [4][3]bool
}

func inspectDxf(path string) (*dxfInspection, error) {
	file, errorValue := os.Open(path)
	if errorValue != nil {
		return nil, errorValue
	}
	defer file.Close()
	result := &dxfInspection{InsertionUnits: -1}
	result.Bounds.Min = point3{math.Inf(1), math.Inf(1), math.Inf(1)}
	result.Bounds.Max = point3{math.Inf(-1), math.Inf(-1), math.Inf(-1)}
	declaredLayers := map[string]bool{}
	usedLayers := map[string]bool{}
	section := ""
	headerVariable := ""
	awaitingSection := false
	var entity *dxfEntityState
	flushEntity := func() error {
		if entity == nil {
			return nil
		}
		if section == "TABLES" && entity.typeName == "LAYER" {
			if entity.layer != "" {
				declaredLayers[strings.ToLower(entity.layer)] = true
			}
		} else if section == "ENTITIES" {
			if entity.typeName == "3DFACE" {
				for vertex := 0; vertex < 3; vertex++ {
					for component := 0; component < 3; component++ {
						if !entity.present[vertex][component] {
							return fmt.Errorf("3DFACE 缺少顶点组码")
						}
						value := entity.points[vertex][component]
						if value < result.Bounds.Min[component] {
							result.Bounds.Min[component] = value
						}
						if value > result.Bounds.Max[component] {
							result.Bounds.Max[component] = value
						}
					}
				}
				result.FaceCount++
				usedLayers[strings.ToLower(entity.layer)] = true
			} else if entity.typeName != "" {
				result.UnsupportedEntityCount++
			}
		}
		entity = nil
		return nil
	}
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	var codeLine string
	haveCode := false
	for scanner.Scan() {
		line := strings.TrimSuffix(scanner.Text(), "\r")
		if !haveCode {
			codeLine = strings.TrimPrefix(strings.TrimSpace(line), "\ufeff")
			haveCode = true
			continue
		}
		code, parseError := strconv.Atoi(strings.TrimSpace(codeLine))
		if parseError != nil {
			return nil, fmt.Errorf("无效 DXF 组码 %s", codeLine)
		}
		value := strings.TrimSpace(line)
		haveCode = false
		if code == 0 {
			if errorValue = flushEntity(); errorValue != nil {
				return nil, errorValue
			}
			typeName := strings.ToUpper(value)
			switch typeName {
			case "SECTION":
				awaitingSection = true
			case "ENDSEC":
				section = ""
			case "EOF":
				result.SawEOF = true
			case "TABLE", "ENDTAB":
			default:
				entity = &dxfEntityState{typeName: typeName}
			}
			continue
		}
		if awaitingSection && code == 2 {
			section = strings.ToUpper(value)
			awaitingSection = false
			continue
		}
		if section == "HEADER" {
			if code == 9 {
				headerVariable = strings.ToUpper(value)
			} else if headerVariable == "$INSUNITS" && code == 70 {
				result.InsertionUnits, errorValue = strconv.Atoi(value)
				if errorValue != nil {
					return nil, fmt.Errorf("DXF $INSUNITS 不是整数")
				}
			}
		}
		if code == 420 {
			result.TrueColorCount++
		}
		if entity == nil {
			continue
		}
		if code == 2 || code == 8 {
			entity.layer = value
			continue
		}
		for component, base := range []int{10, 20, 30} {
			if code < base || code > base+3 {
				continue
			}
			vertex := code - base
			coordinate, coordinateError := strconv.ParseFloat(value, 64)
			if coordinateError != nil || math.IsNaN(coordinate) || math.IsInf(coordinate, 0) {
				return nil, fmt.Errorf("DXF 顶点坐标无效")
			}
			entity.points[vertex][component] = coordinate
			entity.present[vertex][component] = true
		}
	}
	if errorValue = scanner.Err(); errorValue != nil {
		return nil, errorValue
	}
	if haveCode && strings.TrimSpace(codeLine) != "" {
		return nil, fmt.Errorf("DXF 最后一个组码缺少值")
	}
	if errorValue = flushEntity(); errorValue != nil {
		return nil, errorValue
	}
	if !result.SawEOF {
		return nil, fmt.Errorf("DXF 缺少 EOF 结束标记")
	}
	if result.FaceCount == 0 {
		return nil, fmt.Errorf("DXF ENTITIES 中没有 3DFACE 几何")
	}
	result.DeclaredLayerCount = len(declaredLayers)
	result.UsedLayerCount = len(usedLayers)
	for layer := range usedLayers {
		if layer != "0" && !declaredLayers[layer] {
			return nil, fmt.Errorf("DXF 实体使用未声明图层 %s", layer)
		}
	}
	return result, nil
}

func appendDiagnostic(target *[]conversionDiagnostic, diagnostic conversionDiagnostic) {
	for _, current := range *target {
		if current.Severity == diagnostic.Severity && current.Code == diagnostic.Code && current.Path == diagnostic.Path && current.Message == diagnostic.Message {
			return
		}
	}
	*target = append(*target, diagnostic)
}

func makeDxfLayer(requested string, color [4]float64, used map[string]bool) dxfLayer {
	base := sanitizeLayerName(requested)
	name := base
	for suffix := 2; used[strings.ToLower(name)]; suffix++ {
		tag := "_" + strconv.Itoa(suffix)
		name = truncateRunes(base, 255-len([]rune(tag))) + tag
	}
	used[strings.ToLower(name)] = true
	trueColor := uint32(linearColorByte(color[0]))<<16 | uint32(linearColorByte(color[1]))<<8 | uint32(linearColorByte(color[2]))
	opacity := clampFloat(color[3], 0, 1)
	return dxfLayer{name: name, trueColor: trueColor, transparency: uint8(math.Round((1 - opacity) * 255))}
}

func sanitizeLayerName(value string) string {
	invalid := "<>/\\\"`:;?*|=,"
	cleaned := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) || strings.ContainsRune(invalid, character) {
			return '_'
		}
		return character
	}, singleLine(value))
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		cleaned = "Part"
	}
	return truncateRunes(cleaned, 255)
}

func singleLine(value string) string {
	cleaned := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) {
			return ' '
		}
		return character
	}, value)
	return truncateRunes(strings.TrimSpace(cleaned), 255)
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func linearColorByte(value float64) uint8 {
	linear := clampFloat(value, 0, 1)
	srgb := linear * 12.92
	if linear > 0.0031308 {
		srgb = 1.055*math.Pow(linear, 1.0/2.4) - 0.055
	}
	return uint8(math.Round(clampFloat(srgb, 0, 1) * 255))
}

func clampFloat(value, minimum, maximum float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return minimum
	}
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}
