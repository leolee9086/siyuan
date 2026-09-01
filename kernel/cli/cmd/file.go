// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"

	"github.com/spf13/cobra"
)

var fileCmd = &cobra.Command{
	Use:   "file",
	Short: "Workspace file operations",
}

func absPath(rel string) (string, error) {
	rel = filepath.Clean(strings.ReplaceAll(rel, "/", string(os.PathSeparator)))
	abs := filepath.Join(util.WorkspaceDir, rel)
	if filepath.Clean(abs) != filepath.Clean(util.WorkspaceDir) && !gulu.File.IsSubPath(util.WorkspaceDir, abs) {
		return "", fmt.Errorf("path escapes workspace: %s", rel)
	}
	if boxID := model.EncryptedRawPathBoxID(abs); boxID != "" {
		return "", fmt.Errorf("path belongs to encrypted notebook [%s]: %s", boxID, rel)
	}
	return abs, nil
}

func workspaceWalkerPath(ctx context.Context, raw string) (*fswalk.Walker, string, error) {
	walker, err := fswalk.New(util.WorkspaceDir)
	if err != nil {
		return nil, "", err
	}
	absolute, err := absPath(raw)
	if err != nil {
		return nil, "", err
	}
	relative, err := walker.RelativePath(ctx, absolute)
	if err != nil {
		return nil, "", err
	}
	return walker, relative, nil
}

func workspaceWalkerRelative(ctx context.Context, walker *fswalk.Walker, raw string) (string, error) {
	absolute, err := absPath(raw)
	if err != nil {
		return "", err
	}
	return walker.RelativePath(ctx, absolute)
}

var fileListCmd = &cobra.Command{
	Use:   "list <path>",
	Short: "List directory contents",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}
		entries, err := walker.ReadDirectory(cmd.Context(), relative, true)
		if err != nil {
			return err
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tSIZE\tISDIR\tMODTIME")
		for _, e := range entries {
			size := ""
			modTime := ""
			size = fmt.Sprintf("%d", e.Size)
			modTime = time.Unix(e.Updated, 0).Format("2006-01-02 15:04")
			fmt.Fprintf(w, "%s\t%s\t%v\t%s\n", e.Name, size, e.IsDir, modTime)
		}
		w.Flush()
		fmt.Printf("\n%d entry(s)\n", len(entries))
		return nil
	},
}

var fileReadCmd = &cobra.Command{
	Use:   "read <path>",
	Short: "Read file content",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}
		document, err := walker.ReadLineRange(cmd.Context(), relative, fswalk.LineRangeQuery{StartLine: 1})
		if err != nil {
			return err
		}
		fmt.Print(document.Text)
		return nil
	},
}

var fileWriteCmd = &cobra.Command{
	Use:   "write <path>",
	Short: "Write file content (stdin or --file)",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}

		if dryRun {
			fmt.Printf("[dry-run] Would write file: %s\n", args[0])
			return nil
		}

		src, _ := cmd.Flags().GetString("file")
		if src != "" {
			if err = writeWorkspaceFileFromSource(cmd.Context(), walker, relative, src); err != nil {
				return err
			}
		} else {
			data, readErr := io.ReadAll(os.Stdin)
			if readErr != nil {
				return readErr
			}
			if err = walker.WriteFileContent(cmd.Context(), relative, data); err != nil {
				return err
			}
		}
		fmt.Println("ok")
		return nil
	},
}

func writeWorkspaceFileFromSource(ctx context.Context, destination *fswalk.Walker,
	destinationRelative, source string) error {
	absolute, err := filepath.Abs(source)
	if err != nil {
		return err
	}
	sourceWalker, err := fswalk.New(filepath.Dir(absolute))
	if err != nil {
		return err
	}
	sourceRelative, err := sourceWalker.RelativePath(ctx, absolute)
	if err != nil {
		return err
	}
	content, err := sourceWalker.ReadLineRange(ctx, sourceRelative, fswalk.LineRangeQuery{StartLine: 1})
	if err != nil {
		return err
	}
	return destination.WriteFileContent(ctx, destinationRelative, []byte(content.Text))
}

var fileDeleteCmd = &cobra.Command{
	Use:   "delete <path>",
	Short: "Delete file or directory",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}

		if dryRun {
			fmt.Printf("[dry-run] Would delete: %s\n", args[0])
			return nil
		}

		_, err = walker.RemoveTree(cmd.Context(), relative)
		if err != nil {
			return err
		}
		fmt.Println("ok")
		return nil
	},
}

var fileRenameCmd = &cobra.Command{
	Use:   "rename <old> <new>",
	Short: "Rename or move file",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, oldRelative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}
		newRelative, err := workspaceWalkerRelative(cmd.Context(), walker, args[1])
		if err != nil {
			return err
		}

		if dryRun {
			fmt.Printf("[dry-run] Would rename/move: %s -> %s\n", args[0], args[1])
			return nil
		}

		if err := walker.Move(cmd.Context(), oldRelative, walker, newRelative); err != nil {
			return err
		}
		fmt.Println("ok")
		return nil
	},
}

var fileCopyCmd = &cobra.Command{
	Use:   "copy <src> <dst>",
	Short: "Copy file or directory",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		if dryRun {
			fmt.Printf("[dry-run] Would copy: %s -> %s\n", args[0], args[1])
			return nil
		}

		if err := copyWorkspacePath(context.Background(), args[0], args[1]); err != nil {
			return err
		}
		fmt.Println("ok")
		return nil
	},
}

func copyWorkspacePath(ctx context.Context, source, destination string) error {
	walker, sourceRelative, err := workspaceWalkerPath(ctx, source)
	if err != nil {
		return err
	}
	destinationRelative, err := workspaceWalkerRelative(ctx, walker, destination)
	if err != nil {
		return err
	}
	_, err = walker.CopyTree(ctx, sourceRelative, walker, destinationRelative, fswalk.CopyTreeQuery{})
	return err
}

var fileGrepCmd = &cobra.Command{
	Use:   "grep --pattern <regex> --path <path>",
	Short: "Search file contents with regex",
	RunE: func(cmd *cobra.Command, args []string) error {
		pattern, _ := cmd.Flags().GetString("pattern")
		if pattern == "" {
			return fmt.Errorf("--pattern is required")
		}
		relPath, _ := cmd.Flags().GetString("path")
		if relPath == "" {
			return fmt.Errorf("--path is required")
		}
		absolute, err := absPath(relPath)
		if err != nil {
			return err
		}
		include, _ := cmd.Flags().GetString("include")
		contextLines, _ := cmd.Flags().GetInt("context")
		max, _ := cmd.Flags().GetInt("limit")
		if max <= 0 {
			max = 200
		}
		results, err := gulu.File.Grep(absolute, include, pattern, contextLines, max)
		if err != nil {
			return err
		}
		switch outputFormat {
		case "json":
			data, _ := json.MarshalIndent(results, "", "  ")
			fmt.Println(string(data))
		default:
			fmt.Printf("Found %d lines:\n\n", len(results))
			for _, result := range results {
				relative, relErr := filepath.Rel(util.WorkspaceDir, result.File)
				if relErr != nil {
					relative = result.File
				}
				sep := ":"
				if result.Context {
					sep = "-:"
				}
				fmt.Printf("%s:%d%s %s\n", relative, result.Line, sep, result.Text)
			}
		}
		return nil
	},
}

var fileFindCmd = &cobra.Command{
	Use:   "find <path>",
	Short: "Find files under a path",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}
		include, _ := cmd.Flags().GetString("include")
		max, _ := cmd.Flags().GetInt("limit")
		if max <= 0 {
			max = 200
		}
		var results []string
		total := 0
		if !isWorkspaceFindPrunedDirectory(filepath.Base(filepath.FromSlash(relative))) {
			_, err = walker.Walk(cmd.Context(), relative, fswalk.WalkOptions{SortEntries: true}, func(entry fswalk.Metadata) error {
				if entry.IsDir {
					if isWorkspaceFindPrunedDirectory(entry.Name) {
						return fs.SkipDir
					}
					return nil
				}
				if !entry.IsRegular || entry.IsSymlink || entry.Restricted {
					return nil
				}
				if include != "" && !matchGlob(entry.Name, include) {
					return nil
				}
				total++
				if len(results) < max {
					results = append(results, filepath.FromSlash(entry.Path))
				}
				if total >= max {
					return fs.SkipAll
				}
				return nil
			})
		}
		if err != nil {
			return err
		}
		switch outputFormat {
		case "json":
			data, _ := json.MarshalIndent(results, "", "  ")
			fmt.Println(string(data))
		default:
			if max < total {
				fmt.Printf("Found %d files (showing first %d):\n\n", total, max)
			} else {
				fmt.Printf("Found %d files:\n\n", len(results))
			}
			for _, r := range results {
				fmt.Println(r)
			}
		}
		return nil
	},
}

var fileStatCmd = &cobra.Command{
	Use:   "stat <path>",
	Short: "Show file or directory info",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		walker, relative, err := workspaceWalkerPath(cmd.Context(), args[0])
		if err != nil {
			return err
		}
		entry, err := walker.Inspect(cmd.Context(), relative)
		if err != nil {
			return err
		}
		switch outputFormat {
		case "json":
			data, _ := json.MarshalIndent(map[string]any{
				"path":    args[0],
				"size":    entry.Size,
				"isDir":   entry.IsDir,
				"modTime": time.Unix(entry.Updated, 0).Format("2006-01-02 15:04:05"),
			}, "", "  ")
			fmt.Println(string(data))
		default:
			fmt.Printf("Path:    %s\n", args[0])
			fmt.Printf("Size:    %d\n", entry.Size)
			fmt.Printf("IsDir:   %v\n", entry.IsDir)
			fmt.Printf("ModTime: %s\n", time.Unix(entry.Updated, 0).Format("2006-01-02 15:04:05"))
		}
		return nil
	},
}

func matchGlob(filename, pattern string) bool {
	for _, p := range expandGlobBrace(pattern) {
		if matched, _ := filepath.Match(p, filename); matched {
			return true
		}
	}
	return false
}

func isWorkspaceFindPrunedDirectory(name string) bool {
	return name == ".git" || name == ".svn" || name == ".hg" || strings.HasPrefix(name, ".")
}

func expandGlobBrace(pattern string) []string {
	i := strings.Index(pattern, "{")
	if i < 0 {
		return []string{pattern}
	}
	j := strings.Index(pattern[i:], "}")
	if j < 0 {
		return []string{pattern}
	}
	j += i
	prefix := pattern[:i]
	body := pattern[i+1 : j]
	suffix := pattern[j+1:]
	var result []string
	for opt := range strings.SplitSeq(body, ",") {
		result = append(result, expandGlobBrace(prefix+strings.TrimSpace(opt)+suffix)...)
	}
	return result
}

func init() {
	fileWriteCmd.Flags().String("file", "", "source file path (default: stdin)")

	fileGrepCmd.Flags().String("pattern", "", "regex pattern")
	fileGrepCmd.Flags().String("path", "", "relative path within workspace")
	fileGrepCmd.Flags().String("include", "", "file glob filter, e.g. *.go or *.{ts,tsx}")
	fileGrepCmd.Flags().Int("context", 0, "context lines before and after each match")
	fileGrepCmd.Flags().Int("limit", 200, "maximum matches (0 or negative for unlimited)")

	fileFindCmd.Flags().String("include", "", "file glob filter, e.g. *.go or *.{ts,tsx}")
	fileFindCmd.Flags().Int("limit", 200, "maximum files (0 or negative for unlimited)")

	rootCmd.AddCommand(fileCmd)
	fileCmd.AddCommand(fileListCmd)
	fileCmd.AddCommand(fileReadCmd)
	fileCmd.AddCommand(fileWriteCmd)
	fileCmd.AddCommand(fileDeleteCmd)
	fileCmd.AddCommand(fileRenameCmd)
	fileCmd.AddCommand(fileCopyCmd)
	fileCmd.AddCommand(fileGrepCmd)
	fileCmd.AddCommand(fileFindCmd)
	fileCmd.AddCommand(fileStatCmd)
}
