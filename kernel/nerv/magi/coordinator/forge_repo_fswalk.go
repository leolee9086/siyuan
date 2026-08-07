package coordinator

import (
	"context"
	"errors"
	"fmt"
	pathpkg "path"
	"path/filepath"
	"strings"

	ignore "github.com/sabhiram/go-gitignore"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

func loadForgeDevRepoGitIgnore(ctx context.Context, walker *fswalk.Walker, enabled bool) *ignore.GitIgnore {
	if !enabled || walker == nil {
		return nil
	}
	content, err := walker.ReadLineRange(ctx, ".gitignore", fswalk.LineRangeQuery{StartLine: 1})
	if err != nil {
		return nil
	}
	text := strings.ReplaceAll(content.Text, "\r\n", "\n")
	return ignore.CompileIgnoreLines(strings.Split(text, "\n")...)
}

type forgeRepoTransformPlan struct {
	walker  *fswalk.Walker
	plan    *fswalk.TextTransformPlan
	preview fswalk.TextTransformPlanResult
}

type forgeTransformCandidate struct {
	Path             string `json:"path"`
	OriginalRevision string `json:"originalRevision"`
}

func planForgeRepoEdit(ctx context.Context, root, relative, oldText, newText string) (forgeRepoTransformPlan, error) {
	walker, err := fswalk.New(root)
	if err != nil {
		return forgeRepoTransformPlan{}, err
	}
	plan, preview, err := walker.PlanTextFileTransform(ctx, relative, maxForgeDevRepoReadBytes,
		func(document fswalk.TextDocument) (fswalk.TextTransformation, error) {
			updated, applied, transformErr := applySearchReplace(document.Text, oldText, newText)
			if errors.Is(transformErr, ErrSearchNotFound) {
				return fswalk.TextTransformation{}, WrapSearchNotFoundError(document.Text, oldText)
			}
			if transformErr != nil {
				return fswalk.TextTransformation{}, transformErr
			}
			return fswalk.TextTransformation{Text: updated, Changed: applied}, nil
		})
	if err != nil {
		switch {
		case errors.Is(err, fswalk.ErrStartUnavailable):
			return forgeRepoTransformPlan{}, fmt.Errorf("目标文件不存在: %s", relative)
		case errors.Is(err, fswalk.ErrNotRegularFile):
			return forgeRepoTransformPlan{}, fmt.Errorf("目标路径是目录，不能编辑: %s", relative)
		}
		return forgeRepoTransformPlan{}, err
	}
	if err = validateSingleEditPlan(relative, preview); err != nil {
		return forgeRepoTransformPlan{}, err
	}
	return forgeRepoTransformPlan{walker: walker, plan: plan, preview: preview}, nil
}

func validateSingleEditPlan(relative string, preview fswalk.TextTransformPlanResult) error {
	if preview.ErrorCount > 0 {
		return preview.Errors[0]
	}
	switch {
	case preview.SkippedLargeCount > 0:
		return fmt.Errorf("文件过大，无法编辑: %s", relative)
	case preview.SkippedBinaryCount > 0:
		return fmt.Errorf("目标不是 UTF-8 文本文件: %s", relative)
	case len(preview.Candidates) != 1:
		return fmt.Errorf("编辑计划没有唯一候选文件: %s", relative)
	default:
		return nil
	}
}

func planForgeRepoBatch(ctx context.Context, root, targetRelative, pattern, filePattern,
	oldText, newText string) (forgeRepoTransformPlan, error) {
	walker, err := fswalk.New(root)
	if err != nil {
		return forgeRepoTransformPlan{}, err
	}
	pattern = filepath.ToSlash(strings.TrimSpace(pattern))
	if pattern == "" || pathpkg.IsAbs(pattern) || filepath.IsAbs(filepath.FromSlash(pattern)) {
		return forgeRepoTransformPlan{}, errors.New("批量替换 pattern 必须是根内相对 glob")
	}
	cleanPattern := pathpkg.Clean(pattern)
	if cleanPattern == ".." || strings.HasPrefix(cleanPattern, "../") {
		return forgeRepoTransformPlan{}, errors.New("批量替换 pattern 不能逸出目标目录")
	}
	pattern = cleanPattern
	scanRelative := forgePatternScanRoot(targetRelative, pattern)
	oldNormalized := normalizeForgeRepoText(oldText)
	plan, preview, err := walker.PlanTextTransform(ctx, scanRelative, fswalk.TextTransformQuery{
		Walk:         fswalk.WalkOptions{SortEntries: true},
		MaxFileBytes: maxForgeDevRepoReadBytes,
		PruneDirectory: func(entry fswalk.Metadata) bool {
			return isBlockedForgeDevRepoPath(entry.Path)
		},
		SelectFile: func(entry fswalk.Metadata) bool {
			if isBlockedForgeDevRepoPath(entry.Path) || !matchesForgeBatchPattern(targetRelative, pattern, entry.Path) {
				return false
			}
			if filePattern == "" {
				return true
			}
			matched, matchErr := pathpkg.Match(filepath.ToSlash(filePattern), entry.Name)
			return matchErr == nil && matched
		},
		Transform: func(document fswalk.TextDocument) (fswalk.TextTransformation, error) {
			if !strings.Contains(document.Text, oldNormalized) {
				return fswalk.TextTransformation{}, nil
			}
			updated, applied, transformErr := applySearchReplace(document.Text, oldText, newText)
			if transformErr != nil {
				return fswalk.TextTransformation{}, transformErr
			}
			return fswalk.TextTransformation{Text: updated, Changed: applied}, nil
		},
	})
	if err != nil {
		return forgeRepoTransformPlan{}, err
	}
	if preview.ErrorCount > 0 {
		return forgeRepoTransformPlan{}, preview.Errors[0]
	}
	return forgeRepoTransformPlan{walker: walker, plan: plan, preview: preview}, nil
}

func forgePatternScanRoot(targetRelative, pattern string) string {
	prefix := pattern
	prefixEndsAtDirectory := false
	if wildcard := strings.IndexAny(prefix, "*?["); wildcard >= 0 {
		prefix = prefix[:wildcard]
		prefixEndsAtDirectory = strings.HasSuffix(prefix, "/")
	}
	prefix = strings.TrimSuffix(prefix, "/")
	if prefix == "" {
		return normalizeForgeRelative(targetRelative)
	}
	if !prefixEndsAtDirectory {
		prefix = pathpkg.Dir(prefix)
	}
	if prefix == "." {
		return normalizeForgeRelative(targetRelative)
	}
	return pathpkg.Join(normalizeForgeRelative(targetRelative), prefix)
}

func matchesForgeBatchPattern(targetRelative, pattern, entryPath string) bool {
	targetRelative = normalizeForgeRelative(targetRelative)
	entryPath = filepath.ToSlash(entryPath)
	candidate := entryPath
	if targetRelative != "." {
		prefix := strings.TrimSuffix(targetRelative, "/") + "/"
		if !strings.HasPrefix(entryPath, prefix) {
			return false
		}
		candidate = strings.TrimPrefix(entryPath, prefix)
	}
	matched, err := pathpkg.Match(pattern, candidate)
	return err == nil && matched
}

func normalizeForgeRelative(relative string) string {
	relative = strings.Trim(filepath.ToSlash(relative), "/")
	if relative == "" || relative == "." {
		return "."
	}
	return pathpkg.Clean(relative)
}

func forgeTransformCandidatePaths(preview fswalk.TextTransformPlanResult) []string {
	paths := make([]string, 0, len(preview.Candidates))
	for _, candidate := range preview.Candidates {
		paths = append(paths, candidate.Path)
	}
	return paths
}

func forgeTransformCandidates(preview fswalk.TextTransformPlanResult) []forgeTransformCandidate {
	candidates := make([]forgeTransformCandidate, 0, len(preview.Candidates))
	for _, candidate := range preview.Candidates {
		candidates = append(candidates, forgeTransformCandidate{
			Path: candidate.Path, OriginalRevision: candidate.OriginalRevision,
		})
	}
	return candidates
}

func forgeApprovedSingleCandidate(payload map[string]interface{}) (forgeTransformCandidate, bool) {
	value, ok := payload["candidate"].(map[string]interface{})
	if !ok {
		return forgeTransformCandidate{}, false
	}
	path, pathOK := value["path"].(string)
	revision, revisionOK := value["originalRevision"].(string)
	if strings.TrimSpace(path) == "" || strings.TrimSpace(revision) == "" || !pathOK || !revisionOK {
		return forgeTransformCandidate{}, false
	}
	return forgeTransformCandidate{Path: path, OriginalRevision: revision}, true
}

func forgeApprovedCandidates(payload map[string]interface{}) ([]forgeTransformCandidate, bool) {
	value, ok := payload["matchedCandidates"]
	if !ok {
		return nil, false
	}
	items, ok := value.([]interface{})
	if !ok {
		return nil, false
	}
	candidates := make([]forgeTransformCandidate, 0, len(items))
	for _, item := range items {
		object, objectOK := item.(map[string]interface{})
		if !objectOK {
			return nil, false
		}
		path, pathOK := object["path"].(string)
		revision, revisionOK := object["originalRevision"].(string)
		if !pathOK || !revisionOK || strings.TrimSpace(path) == "" || strings.TrimSpace(revision) == "" {
			return nil, false
		}
		candidates = append(candidates, forgeTransformCandidate{Path: path, OriginalRevision: revision})
	}
	return candidates, true
}

func sameForgeCandidateRevisions(approved, current []forgeTransformCandidate) bool {
	if len(approved) != len(current) {
		return false
	}
	approvedByPath := make(map[string]string, len(approved))
	for _, candidate := range approved {
		approvedByPath[filepath.ToSlash(candidate.Path)] = candidate.OriginalRevision
	}
	for _, candidate := range current {
		path := filepath.ToSlash(candidate.Path)
		if revision, ok := approvedByPath[path]; !ok || revision != candidate.OriginalRevision {
			return false
		}
	}
	return true
}

func applyForgeTransform(ctx context.Context, planned forgeRepoTransformPlan,
	stopOnError bool) (fswalk.TextTransformApplyResult, error) {
	return planned.walker.ApplyTextTransform(ctx, planned.plan, fswalk.TextApplyPolicy{
		Backup: true, StopOnError: stopOnError,
	})
}
