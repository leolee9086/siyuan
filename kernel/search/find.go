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

package search

import (
	"context"
	"path/filepath"
	"runtime"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

type Match struct {
	Path   string
	Target string
}

func FindAllMatchedPaths(root string, targets []string) []string {
	matches := FindAllMatches(root, targets)
	return pathsFromMatches(matches)
}

func FindAllMatchedTargets(root string, targets []string) []string {
	matches := FindAllMatches(root, targets)
	return targetsFromMatches(matches)
}

// FindAllMatches 遍历 root 下的文件，返回所有命中的结果（文件路径 + 命中目标）
// targets 为空或 root 为空时返回 nil
func FindAllMatches(root string, targets []string) []Match {
	if root == "" || len(targets) == 0 {
		return nil
	}

	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil
	}
	walker, err := fswalk.New(absoluteRoot)
	if err != nil {
		return nil
	}
	searched, err := walker.SearchByteTargets(context.Background(), "", fswalk.ByteSearchQuery{
		Targets: targets, ReadWorkers: runtime.NumCPU(),
	})
	if err != nil {
		return nil
	}
	matches := make([]Match, 0, len(searched.Matches))
	for _, match := range searched.Matches {
		matches = append(matches, Match{
			Path: filepath.Join(root, filepath.FromSlash(match.Path)), Target: match.Target,
		})
	}
	return matches
}

// pathsFromMatches 从 Match 列表中返回去重的路径切片（保留首次出现顺序）
func pathsFromMatches(ms []Match) []string {
	if len(ms) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	paths := make([]string, 0)
	for _, m := range ms {
		if _, ok := seen[m.Path]; ok {
			continue
		}
		seen[m.Path] = struct{}{}
		paths = append(paths, m.Path)
	}
	return paths
}

// targetsFromMatches 从 Match 列表中返回去重的目标切片（保留首次出现顺序）
func targetsFromMatches(ms []Match) []string {
	if len(ms) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	targets := make([]string, 0)
	for _, m := range ms {
		if _, ok := seen[m.Target]; ok {
			continue
		}
		seen[m.Target] = struct{}{}
		targets = append(targets, m.Target)
	}
	return targets
}
