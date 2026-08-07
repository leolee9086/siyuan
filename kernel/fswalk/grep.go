package fswalk

import (
	"bufio"
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// GrepQuery 声明与 gulu.File.Grep 等价的正则、文件筛选、上下文和结果边界。
type GrepQuery struct {
	IncludeGlob  string
	Pattern      string
	MaxResults   int
	ContextLines int
}

// GrepResult 汇总一个 grep 工作流的根相对匹配结果。
type GrepResult struct {
	Traversal         Result
	Matches           []GrepMatch
	MatchLimitReached bool
}

// GrepMatch 保留旧 grep 对匹配行与上下文行的区分。
type GrepMatch struct {
	Path    string
	Number  int
	Text    string
	Context bool
}

// GrepText 保留 gulu.File.Grep 的正则、文件选择、顺序、上下文、上限和静默文件错误语义。
// 相对入口可以经过根内链接，但最终对象和所有已打开文件仍必须留在绑定根内。
func (w *Walker) GrepText(ctx context.Context, relative string, query GrepQuery) (GrepResult, error) {
	expression, err := regexp.Compile(query.Pattern)
	if err != nil {
		return GrepResult{}, err
	}
	maxResults := query.MaxResults
	if maxResults <= 0 {
		maxResults = 64
	}
	target, err := w.resolveGrepTarget(ctx, relative)
	if err != nil {
		return GrepResult{}, err
	}
	result := GrepResult{}
	if !target.info.IsDir() {
		entry := metadataFromFileInfo(target.relative, target.info, 0)
		if err = w.grepFile(ctx, entry, target.absolute, expression, query.ContextLines,
			maxResults, &result.Matches); err != nil {
			return result, err
		}
		result.Traversal = Result{Path: target.relative, EntryCount: 1, FileCount: 1}
		result.MatchLimitReached = len(result.Matches) >= maxResults
		return result, nil
	}

	if grepSkipsDirectory(target.info.Name()) || grepRootIsLinkLike(target.absolute) {
		result.Traversal = Result{Path: target.relative}
		return result, nil
	}
	result.Traversal, err = w.grepDirectory(ctx, target.absolute, target.relative, 0, query,
		expression, maxResults, &result.Matches)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return result, err
		}
		// filepath.WalkDir 的回调会吞掉根目录和子目录读取错误。
		result.Traversal.addWalkError(target.relative, err, DefaultRetainedErrors)
	}
	result.MatchLimitReached = len(result.Matches) >= maxResults
	return result, nil
}

func (w *Walker) resolveGrepTarget(ctx context.Context, relative string) (boundTarget, error) {
	if w == nil || w.root == "" {
		return boundTarget{}, ErrRootUnavailable
	}
	if err := ctx.Err(); err != nil {
		return boundTarget{}, err
	}
	clean, err := normalizeRelative(relative)
	if err != nil {
		return boundTarget{}, err
	}
	absolute := filepath.Clean(filepath.Join(w.root, filepath.FromSlash(clean)))
	if !sameOrWithin(w.root, absolute) {
		return boundTarget{}, ErrPathTraversal
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return boundTarget{}, err
	}
	resolved, err := resolvePathTarget(absolute)
	if err != nil {
		return boundTarget{}, err
	}
	if !sameOrWithin(w.root, resolved) {
		return boundTarget{}, ErrPathTraversal
	}
	return boundTarget{absolute: absolute, relative: clean, info: info}, nil
}

func grepRootIsLinkLike(absolute string) bool {
	info, err := os.Lstat(absolute)
	if err != nil {
		return true
	}
	linkLike, err := pathComponentIsLinkLike(absolute, info)
	return err != nil || linkLike
}

// grepDirectory 按 filepath.WalkDir 的深度优先、原始文件名词法顺序提交目录项。
func (w *Walker) grepDirectory(ctx context.Context, absolute, relative string, depth int,
	query GrepQuery, expression *regexp.Regexp, maxResults int, matches *[]GrepMatch) (Result, error) {
	result := Result{Path: relative, Errors: []PathError{}}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	entries, err := readGrepDirectorySnapshot(ctx, absolute)
	if err != nil {
		return result, err
	}
	result.ScannedDirectoryCount = 1
	sortGrepMetadata(entries)
	for _, item := range entries {
		if err = ctx.Err(); err != nil {
			return result, err
		}
		entry := Metadata{
			Name: item.Name, Path: joinRelative(relative, item.Name), IsDir: item.IsDir,
			IsSymlink: item.IsSymlink, IsRegular: item.IsRegular, Restricted: item.Restricted,
			Hidden: item.Hidden, Size: item.Size, Updated: item.Updated, Depth: depth + 1,
		}
		result.EntryCount++
		if entry.IsDir {
			result.DirectoryCount++
			if grepSkipsDirectory(entry.Name) || entry.IsSymlink || entry.Restricted {
				continue
			}
			child, childErr := w.grepDirectory(ctx, filepath.Join(absolute, item.Name), entry.Path,
				depth+1, query, expression, maxResults, matches)
			mergeGrepTraversal(&result, child)
			if childErr != nil {
				if errors.Is(childErr, context.Canceled) || errors.Is(childErr, context.DeadlineExceeded) {
					return result, childErr
				}
				result.addWalkError(entry.Path, childErr, DefaultRetainedErrors)
			}
			if len(*matches) >= maxResults {
				return result, nil
			}
			continue
		}
		result.FileCount++
		if entry.IsSymlink || entry.Restricted || !entry.IsRegular ||
			(query.IncludeGlob != "" && !grepMatchesInclude(entry.Name, query.IncludeGlob)) {
			continue
		}
		if err = w.grepFile(ctx, entry, filepath.Join(absolute, item.Name), expression,
			query.ContextLines, maxResults, matches); err != nil {
			return result, err
		}
		if len(*matches) >= maxResults {
			return result, nil
		}
	}
	return result, nil
}

func mergeGrepTraversal(parent *Result, child Result) {
	parent.FileCount += child.FileCount
	parent.DirectoryCount += child.DirectoryCount
	parent.EntryCount += child.EntryCount
	parent.ScannedDirectoryCount += child.ScannedDirectoryCount
	parent.ErrorCount += child.ErrorCount
	for _, pathErr := range child.Errors {
		if len(parent.Errors) < DefaultRetainedErrors {
			parent.Errors = append(parent.Errors, pathErr)
		} else {
			parent.ErrorsTruncated = true
		}
	}
	parent.ErrorsTruncated = parent.ErrorsTruncated || child.ErrorsTruncated
}

func (r *Result) addWalkError(path string, err error, maxErrors int) {
	r.ErrorCount++
	if len(r.Errors) < maxErrors {
		r.Errors = append(r.Errors, PathError{Path: path, Err: err})
	} else {
		r.ErrorsTruncated = true
	}
}

func (w *Walker) grepFile(ctx context.Context, entry Metadata, absolute string, expression *regexp.Regexp,
	contextLines, maxResults int, matches *[]GrepMatch) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	file, err := os.Open(absolute)
	if err != nil {
		return nil
	}
	defer file.Close()
	if err = verifyOpenedFileWithinRoot(w.root, file); err != nil {
		if errors.Is(err, ErrPathTraversal) {
			return err
		}
		return nil
	}

	before := make([]grepBufferedLine, 0, contextLines+1)
	afterRemaining := 0
	emit := func(number int, text string, isContext bool) bool {
		if len(*matches) >= maxResults {
			return false
		}
		*matches = append(*matches, GrepMatch{
			Path: entry.Path, Number: number, Text: text, Context: isContext,
		})
		return len(*matches) < maxResults
	}
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	lineNumber := 0
	for scanner.Scan() {
		if err = ctx.Err(); err != nil {
			return err
		}
		if len(*matches) >= maxResults {
			return nil
		}
		lineNumber++
		line := scanner.Text()
		if expression.MatchString(line) {
			for _, buffered := range before {
				if !emit(buffered.number, buffered.text, true) {
					return nil
				}
			}
			before = before[:0]
			if !emit(lineNumber, line, false) {
				return nil
			}
			afterRemaining = contextLines
		} else if afterRemaining > 0 {
			if !emit(lineNumber, line, true) {
				return nil
			}
			afterRemaining--
		} else {
			before = append(before, grepBufferedLine{number: lineNumber, text: line})
			if len(before) > contextLines {
				copy(before, before[1:])
				before = before[:len(before)-1]
			}
		}
	}
	return nil
}

func grepSkipsDirectory(name string) bool {
	return name == ".git" || name == ".svn" || name == ".hg" || strings.HasPrefix(name, ".")
}

func grepMatchesInclude(filename, includeGlob string) bool {
	for _, pattern := range expandGrepBrace(includeGlob) {
		if matched, _ := filepath.Match(pattern, filename); matched {
			return true
		}
	}
	return false
}

func expandGrepBrace(pattern string) []string {
	start := strings.Index(pattern, "{")
	if start < 0 {
		return []string{pattern}
	}
	end := strings.Index(pattern[start:], "}")
	if end < 0 {
		return []string{pattern}
	}
	end += start
	result := []string{}
	for _, option := range strings.Split(pattern[start+1:end], ",") {
		result = append(result, expandGrepBrace(
			pattern[:start]+strings.TrimSpace(option)+pattern[end+1:])...)
	}
	return result
}

func sortGrepMetadata(entries []Metadata) {
	sort.SliceStable(entries, func(left, right int) bool {
		return entries[left].Name < entries[right].Name
	})
}

type grepBufferedLine struct {
	number int
	text   string
}
