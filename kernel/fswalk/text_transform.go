package fswalk

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"
	"sync"
)

// TextTransformation 是纯文本变换函数的返回值。
type TextTransformation struct {
	Text    string
	Changed bool
}

// TextTransformer 不执行 I/O，只根据模块提供的文本快照计算替换结果。
type TextTransformer func(TextDocument) (TextTransformation, error)

// TextTransformQuery 只描述批量文本变换的筛选、读取边界和纯变换规则。
type TextTransformQuery struct {
	Walk           WalkOptions
	MaxFileBytes   int64
	PruneDirectory func(Metadata) bool
	SelectFile     func(Metadata) bool
	Transform      TextTransformer
}

// TextTransformCandidate 是规划阶段可审阅的根相对候选。
type TextTransformCandidate struct {
	Path             string `json:"path"`
	OriginalRevision string `json:"originalRevision"`
	OriginalBytes    int64  `json:"originalBytes"`
	ReplacementBytes int64  `json:"replacementBytes"`
	Updated          int64  `json:"updated"`
}

// TextTransformPlanResult 汇总规划阶段的候选、跳过原因和有界错误。
type TextTransformPlanResult struct {
	Traversal          Result
	SelectedFileCount  int
	ScannedFileCount   int
	UnchangedFileCount int
	SkippedLargeCount  int
	SkippedBinaryCount int
	ErrorCount         int
	Errors             []PathError
	ErrorsTruncated    bool
	Candidates         []TextTransformCandidate
}

type plannedTextTransform struct {
	path             string
	originalHash     [sha256.Size]byte
	replacementHash  [sha256.Size]byte
	originalBytes    int64
	replacementBytes int64
}

// TextTransformPlan 是根绑定且单次执行的不可变计划。字段不向领域层开放。
type TextTransformPlan struct {
	mu           sync.Mutex
	owner        *Walker
	transform    TextTransformer
	maxFileBytes int64
	maxErrors    int
	files        []plannedTextTransform
	applied      bool
}

// TextApplyPolicy 声明备份和失败停止策略，具体写入始终由 fswalk 执行。
type TextApplyPolicy struct {
	Backup      bool
	StopOnError bool
}

// TextTransformApplyResult 汇总实际提交结果。
type TextTransformApplyResult struct {
	Changed         []string
	ErrorCount      int
	Errors          []PathError
	ErrorsTruncated bool
}

// PlanTextTransform 枚举、读取并规划一个根相对文件或目录的文本变换。
func (w *Walker) PlanTextTransform(ctx context.Context, relative string,
	query TextTransformQuery) (*TextTransformPlan, TextTransformPlanResult, error) {
	if query.Transform == nil {
		return nil, TextTransformPlanResult{}, errors.New("text transformer is required")
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return nil, TextTransformPlanResult{}, err
	}
	return w.planTextTransformTarget(ctx, target, query)
}

// PlanTextFileTransform 规划单个根相对普通文件，目录不会被隐式扩展为批量编辑。
func (w *Walker) PlanTextFileTransform(ctx context.Context, relative string, maxFileBytes int64,
	transform TextTransformer) (*TextTransformPlan, TextTransformPlanResult, error) {
	if transform == nil {
		return nil, TextTransformPlanResult{}, errors.New("text transformer is required")
	}
	target, err := w.resolveTarget(relative)
	if err != nil {
		return nil, TextTransformPlanResult{}, err
	}
	if !target.info.Mode().IsRegular() {
		return nil, TextTransformPlanResult{}, ErrNotRegularFile
	}
	return w.planTextTransformTarget(ctx, target, TextTransformQuery{
		MaxFileBytes: maxFileBytes,
		Transform:    transform,
	})
}

func (w *Walker) planTextTransformTarget(ctx context.Context, target boundTarget,
	query TextTransformQuery) (*TextTransformPlan, TextTransformPlanResult, error) {
	maxErrors := query.Walk.MaxErrors
	if maxErrors <= 0 {
		maxErrors = DefaultRetainedErrors
	}
	plan := &TextTransformPlan{
		owner: w, transform: query.Transform, maxFileBytes: query.MaxFileBytes,
		maxErrors: maxErrors, files: []plannedTextTransform{},
	}
	result := TextTransformPlanResult{Errors: []PathError{}, Candidates: []TextTransformCandidate{}}
	visit := func(entry Metadata, absolute string) error {
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
		result.SelectedFileCount++
		file, readErr := w.readText(ctx, entry.Path, absolute, query.MaxFileBytes)
		if readErr != nil {
			if errors.Is(readErr, context.Canceled) {
				return readErr
			}
			result.addPlanningError(entry.Path, readErr, maxErrors)
			return nil
		}
		result.ScannedFileCount++
		transformation, transformErr := query.Transform(file.document())
		if transformErr != nil {
			result.addPlanningError(entry.Path, transformErr, maxErrors)
			return nil
		}
		if !transformation.Changed {
			result.UnchangedFileCount++
			return nil
		}
		replacement := file.encode(transformation.Text)
		if bytes.Equal(file.original, replacement) {
			result.UnchangedFileCount++
			return nil
		}
		planned := plannedTextTransform{
			path: entry.Path, originalHash: sha256.Sum256(file.original),
			replacementHash: sha256.Sum256(replacement),
			originalBytes:   int64(len(file.original)), replacementBytes: int64(len(replacement)),
		}
		plan.files = append(plan.files, planned)
		result.Candidates = append(result.Candidates, TextTransformCandidate{
			Path: entry.Path, OriginalRevision: hex.EncodeToString(planned.originalHash[:]),
			OriginalBytes:    planned.originalBytes,
			ReplacementBytes: planned.replacementBytes, Updated: entry.Updated,
		})
		return nil
	}

	var walkErr error
	if target.info.Mode().IsRegular() {
		entry := metadataFromFileInfo(target.relative, target.info, 0)
		walkErr = visit(entry, target.absolute)
		result.Traversal = Result{Path: target.relative, EntryCount: 1, FileCount: 1}
	} else {
		request := newWalkRequest(w.root, target.absolute, target.relative, query.Walk)
		result.Traversal, walkErr = walkWithPath(ctx, request, visit)
	}
	if walkErr != nil {
		return nil, result, walkErr
	}
	return plan, result, nil
}

func (r *TextTransformPlanResult) addPlanningError(path string, err error, maxErrors int) {
	switch {
	case errors.Is(err, ErrTextFileTooLarge):
		r.SkippedLargeCount++
		return
	case errors.Is(err, ErrBinaryText), errors.Is(err, ErrInvalidUTF8):
		r.SkippedBinaryCount++
		return
	}
	r.ErrorCount++
	if len(r.Errors) < maxErrors {
		r.Errors = append(r.Errors, PathError{Path: path, Err: err})
	} else {
		r.ErrorsTruncated = true
	}
}

// ApplyTextTransform 重新校验计划中的文件，然后创建备份并原子替换。
func (w *Walker) ApplyTextTransform(ctx context.Context, plan *TextTransformPlan,
	policy TextApplyPolicy) (TextTransformApplyResult, error) {
	if plan == nil || plan.owner != w {
		return TextTransformApplyResult{}, ErrTransformPlanOwner
	}
	plan.mu.Lock()
	if plan.applied {
		plan.mu.Unlock()
		return TextTransformApplyResult{}, ErrTransformPlanApplied
	}
	plan.applied = true
	plan.mu.Unlock()

	result := TextTransformApplyResult{Changed: []string{}, Errors: []PathError{}}
	for _, candidate := range plan.files {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		if err := w.applyTextCandidate(ctx, plan, candidate, policy); err != nil {
			result.addApplyError(candidate.path, err, plan.maxErrors)
			if policy.StopOnError {
				break
			}
			continue
		}
		result.Changed = append(result.Changed, candidate.path)
	}
	return result, nil
}

func (w *Walker) applyTextCandidate(ctx context.Context, plan *TextTransformPlan,
	candidate plannedTextTransform, policy TextApplyPolicy) error {
	absolute, relative, info, err := w.resolveRegular(candidate.path)
	if err != nil {
		return err
	}
	file, err := w.readText(ctx, relative, absolute, plan.maxFileBytes)
	if err != nil {
		return err
	}
	if int64(len(file.original)) != candidate.originalBytes || sha256.Sum256(file.original) != candidate.originalHash {
		return ErrFileChanged
	}
	transformation, err := plan.transform(file.document())
	if err != nil {
		return err
	}
	if !transformation.Changed {
		return ErrTransformChanged
	}
	replacement := file.encode(transformation.Text)
	if int64(len(replacement)) != candidate.replacementBytes ||
		sha256.Sum256(replacement) != candidate.replacementHash {
		return ErrTransformChanged
	}
	if policy.Backup {
		if err = w.writeAtomic(ctx, absolute+".bak", file.original, info.Mode()); err != nil {
			return err
		}
	}
	return w.writeAtomic(ctx, absolute, replacement, info.Mode())
}

func (r *TextTransformApplyResult) addApplyError(path string, err error, maxErrors int) {
	r.ErrorCount++
	if len(r.Errors) < maxErrors {
		r.Errors = append(r.Errors, PathError{Path: path, Err: err})
	} else {
		r.ErrorsTruncated = true
	}
}
