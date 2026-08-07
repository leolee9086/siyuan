package fswalk

import (
	"context"
	"encoding/xml"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const maximumSVGProbeBytes = 4 * 1024 * 1024

// ImageProbe 是根绑定文件的物理属性和可解码图片尺寸。
type ImageProbe struct {
	Name   string
	Path   string
	Size   int64
	Width  int
	Height int
}

// ImageProbeRecord 保留一个已选择文件的物理元数据和图片探测结果。
// 非图片文件仍有 Probe，具体解码错误保存在 Err。
type ImageProbeRecord struct {
	Probe ImageProbe
	Err   error
}

// ImageProbeQuery 声明批量图片探测的遍历、剪枝和文件选择规则。
type ImageProbeQuery struct {
	Walk           WalkOptions
	PruneDirectory func(Metadata) bool
	SelectFile     func(Metadata) bool
	ProbeWorkers   int
}

// ImageProbeResult 汇总批量探测的遍历结果和有界错误。
type ImageProbeResult struct {
	Traversal       Result
	Files           []ImageProbeRecord
	SelectedCount   int
	ProbedCount     int
	FileErrorCount  int
	FileErrors      []PathError
	ErrorsTruncated bool
}

type imageProbeJob struct {
	entry    Metadata
	absolute string
}

// ProbeImage 读取图片头或 SVG 根元素，不向调用方暴露文件路径或 Reader。
// 文件存在但格式不受支持时仍返回 Name、Path 和 Size，便于领域层区分不存在与非图片文件。
func (w *Walker) ProbeImage(ctx context.Context, relative string) (ImageProbe, error) {
	absolute, clean, info, err := w.resolveRegular(relative)
	if err != nil {
		return ImageProbe{}, err
	}
	entry := metadataFromFileInfo(clean, info, 0)
	return w.probeImageAt(ctx, absolute, entry)
}

// ProbeImages 在深模块内完成目录枚举和并发图片头读取。
// 调用方只声明目录剪枝和文件选择，不参与文件打开或读取调度。
func (w *Walker) ProbeImages(ctx context.Context, relative string, query ImageProbeQuery) (ImageProbeResult, error) {
	result := ImageProbeResult{Files: []ImageProbeRecord{}, FileErrors: []PathError{}}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return result, err
	}
	jobs := []imageProbeJob{}
	selectFile := func(entry Metadata, absolute string) error {
		if entry.IsDir {
			if query.PruneDirectory != nil && query.PruneDirectory(entry) {
				return fs.SkipDir
			}
			return nil
		}
		if entry.IsSymlink || entry.Restricted || !entry.IsRegular {
			return nil
		}
		if query.SelectFile != nil && !query.SelectFile(entry) {
			return nil
		}
		jobs = append(jobs, imageProbeJob{entry: entry, absolute: absolute})
		return nil
	}
	if target.info.Mode().IsRegular() {
		entry := metadataFromFileInfo(target.relative, target.info, 0)
		result.Traversal = Result{Path: target.relative, EntryCount: 1, FileCount: 1, Errors: []PathError{}}
		err = selectFile(entry, target.absolute)
	} else if target.info.IsDir() {
		request := newWalkRequest(w.root, target.absolute, target.relative, query.Walk)
		result.Traversal, err = walkWithPath(ctx, request, selectFile)
	} else {
		return result, ErrNotRegularFile
	}
	if err != nil {
		return result, err
	}

	result.SelectedCount = len(jobs)
	result.Files = make([]ImageProbeRecord, len(jobs))
	for index, job := range jobs {
		result.Files[index].Probe = ImageProbe{
			Name: job.entry.Name, Path: job.entry.Path, Size: job.entry.Size,
		}
	}
	if err = w.runImageProbeJobs(ctx, jobs, result.Files, query.ProbeWorkers); err != nil {
		return result, err
	}
	for _, record := range result.Files {
		if record.Err == nil {
			result.ProbedCount++
			continue
		}
		result.FileErrorCount++
		if len(result.FileErrors) < DefaultRetainedErrors {
			result.FileErrors = append(result.FileErrors, PathError{Path: record.Probe.Path, Err: record.Err})
		} else {
			result.ErrorsTruncated = true
		}
	}
	return result, nil
}

// DecodeImage 在绑定根内解码图片，并把内存图像交给纯消费回调。
// 回调不会获得文件路径、文件句柄或 Reader。
func (w *Walker) DecodeImage(ctx context.Context, relative string,
	visitor func(ImageProbe, image.Image) error) (ImageProbe, error) {
	absolute, clean, info, err := w.resolveRegular(relative)
	if err != nil {
		return ImageProbe{}, err
	}
	probe := ImageProbe{Name: info.Name(), Path: clean, Size: info.Size()}
	file, currentInfo, err := w.openBoundRegular(ctx, absolute)
	if err != nil {
		return probe, err
	}
	decoded, _, decodeErr := image.Decode(contextReadCloser{ctx: ctx, Reader: file})
	closeErr := file.Close()
	probe.Name = currentInfo.Name()
	probe.Size = currentInfo.Size()
	if decodeErr != nil {
		return probe, decodeErr
	}
	if closeErr != nil {
		return probe, closeErr
	}
	bounds := decoded.Bounds()
	probe.Width = bounds.Dx()
	probe.Height = bounds.Dy()
	if err = ctx.Err(); err != nil {
		return probe, err
	}
	if visitor != nil {
		err = visitor(probe, decoded)
	}
	return probe, err
}

func (w *Walker) runImageProbeJobs(ctx context.Context, jobs []imageProbeJob,
	records []ImageProbeRecord, requestedWorkers int) error {
	if len(jobs) == 0 {
		return ctx.Err()
	}
	workers := normalizeWorkers(requestedWorkers)
	if workers > len(jobs) {
		workers = len(jobs)
	}
	var next atomic.Uint64
	var wait sync.WaitGroup
	for range workers {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for {
				if ctx.Err() != nil {
					return
				}
				index := int(next.Add(1) - 1)
				if index >= len(jobs) {
					return
				}
				records[index].Probe, records[index].Err = w.probeImageAt(ctx, jobs[index].absolute, jobs[index].entry)
			}
		}()
	}
	wait.Wait()
	return ctx.Err()
}

func (w *Walker) probeImageAt(ctx context.Context, absolute string, entry Metadata) (ImageProbe, error) {
	probe := ImageProbe{Name: entry.Name, Path: entry.Path, Size: entry.Size}
	file, currentInfo, err := w.openBoundRegular(ctx, absolute)
	if err != nil {
		return probe, err
	}
	defer file.Close()
	probe.Name = currentInfo.Name()
	probe.Size = currentInfo.Size()
	if strings.EqualFold(filepath.Ext(entry.Path), ".svg") {
		probe.Width, probe.Height, err = decodeSVGDimensions(io.LimitReader(contextReadCloser{
			ctx: ctx, Reader: file,
		}, maximumSVGProbeBytes+1))
		return probe, err
	}
	configuration, _, err := image.DecodeConfig(contextReadCloser{ctx: ctx, Reader: file})
	if err != nil {
		return probe, err
	}
	probe.Width = configuration.Width
	probe.Height = configuration.Height
	return probe, nil
}

type contextReadCloser struct {
	ctx context.Context
	io.Reader
}

func (r contextReadCloser) Read(buffer []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.Reader.Read(buffer)
}

func decodeSVGDimensions(reader io.Reader) (int, int, error) {
	type svgRoot struct {
		Width   string `xml:"width,attr"`
		Height  string `xml:"height,attr"`
		ViewBox string `xml:"viewBox,attr"`
	}
	var root svgRoot
	if err := xml.NewDecoder(reader).Decode(&root); err != nil {
		return 0, 0, err
	}
	width := parseImageDimension(root.Width)
	height := parseImageDimension(root.Height)
	if (width == 0 || height == 0) && root.ViewBox != "" {
		parts := strings.Fields(root.ViewBox)
		if len(parts) == 4 {
			if width == 0 {
				width = parseImageDimension(parts[2])
			}
			if height == 0 {
				height = parseImageDimension(parts[3])
			}
		}
	}
	return width, height, nil
}

func parseImageDimension(value string) int {
	value = strings.TrimSpace(strings.TrimSuffix(value, "px"))
	dimension, _ := strconv.ParseFloat(value, 64)
	return int(dimension)
}
