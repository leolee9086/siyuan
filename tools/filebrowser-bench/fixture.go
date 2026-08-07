package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type fixtureResult struct {
	Root     string
	Expected snapshot
}

type fixtureBuilder struct {
	root     string
	manifest *accumulator
}

func makeFixture(config fixtureConfig) (fixtureResult, error) {
	root, err := os.MkdirTemp("", "sforge-filebrowser-bench-")
	if err != nil {
		return fixtureResult{}, err
	}
	builder := fixtureBuilder{root: root, manifest: newAccumulator(root, true)}
	shape := strings.ToLower(strings.TrimSpace(config.Shape))
	switch shape {
	case "balanced":
		err = builder.makeBalanced(config.Parents, config.Branches, config.Files)
	case "wide":
		err = builder.makeWide(config.Count)
	case "deep":
		err = builder.makeDeep(config.Depth)
	case "empty":
		err = builder.makeEmpty(config.Count)
	default:
		err = fmt.Errorf("unknown fixture shape %q", config.Shape)
	}
	if err != nil {
		_ = os.RemoveAll(root)
		return fixtureResult{}, err
	}
	return fixtureResult{Root: root, Expected: builder.manifest.snapshot(true)}, nil
}

func (builder fixtureBuilder) makeBalanced(parents, branches, files int) error {
	if parents < 1 || branches < 1 || files < 0 {
		return fmt.Errorf("balanced fixture requires parents and branches above zero and non-negative files")
	}
	for parentIndex := 0; parentIndex < parents; parentIndex++ {
		parent := fmt.Sprintf("目录-%04d", parentIndex)
		if err := builder.makeDirectory(parent); err != nil {
			return err
		}
		for branchIndex := 0; branchIndex < branches; branchIndex++ {
			directory := filepath.Join(parent, fmt.Sprintf("branch-%02d", branchIndex))
			if err := builder.makeDirectory(directory); err != nil {
				return err
			}
			for fileIndex := 0; fileIndex < files; fileIndex++ {
				name := filepath.Join(directory, fmt.Sprintf("file-%04d-资料.txt", fileIndex))
				if err := builder.writeFile(name); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (builder fixtureBuilder) makeWide(count int) error {
	if count < 1 {
		return fmt.Errorf("wide fixture requires a positive count")
	}
	for index := 0; index < count; index++ {
		if err := builder.writeFile(fmt.Sprintf("wide-%05d-资料.txt", index)); err != nil {
			return err
		}
	}
	return nil
}

func (builder fixtureBuilder) makeDeep(depth int) error {
	if depth < 1 {
		return fmt.Errorf("deep fixture requires a positive depth")
	}
	directory := ""
	for index := 0; index < depth; index++ {
		directory = filepath.Join(directory, fmt.Sprintf("level-%03d", index))
		if err := builder.makeDirectory(directory); err != nil {
			return err
		}
		if err := builder.writeFile(filepath.Join(directory, fmt.Sprintf("value-%03d.txt", index))); err != nil {
			return err
		}
	}
	return nil
}

func (builder fixtureBuilder) makeEmpty(count int) error {
	if count < 1 {
		return fmt.Errorf("empty fixture requires a positive count")
	}
	for index := 0; index < count; index++ {
		if err := builder.makeDirectory(fmt.Sprintf("empty-%05d", index)); err != nil {
			return err
		}
	}
	return nil
}

func (builder fixtureBuilder) makeDirectory(relative string) error {
	if err := os.Mkdir(filepath.Join(builder.root, relative), 0755); err != nil {
		return err
	}
	builder.manifest.addRelative(filepath.ToSlash(relative), true)
	return nil
}

func (builder fixtureBuilder) writeFile(relative string) error {
	if err := os.WriteFile(filepath.Join(builder.root, relative), []byte("benchmark"), 0600); err != nil {
		return err
	}
	builder.manifest.addRelative(filepath.ToSlash(relative), false)
	return nil
}
