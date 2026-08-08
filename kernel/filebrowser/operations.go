package filebrowser

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

// operationRoot authorizes one root-relative operation path and returns a
// fixed fswalk Walker. The absolute path never leaves this package.
func (s *Service) operationRoot(rootID, relative string, write bool) (Root, *fswalk.Walker, string, error) {
	root, err := s.rootByID(rootID)
	if err != nil {
		return Root{}, nil, "", err
	}
	if !root.Exists || !root.Capabilities.Browse {
		return Root{}, nil, "", ErrRootUnavailable
	}
	normalized, err := normalizeRelativePath(relative)
	if err != nil {
		return Root{}, nil, "", err
	}
	capabilities := root.CapabilitiesForPath(normalized)
	if !capabilities.Browse {
		return Root{}, nil, "", ErrRootUnavailable
	}
	if write && !capabilities.Write {
		return Root{}, nil, "", ErrWriteDenied
	}
	resolvedRoot, exists := resolveDirectory(root.Path)
	if !exists {
		return Root{}, nil, "", ErrRootUnavailable
	}
	walker, err := fswalk.New(resolvedRoot)
	if err != nil {
		return Root{}, nil, "", adaptFileOperationError(err)
	}
	return root, walker, normalized, nil
}

func joinOperationPath(parent, name string) string {
	if parent == "" {
		return name
	}
	return filepath.ToSlash(filepath.Join(filepath.FromSlash(parent), name))
}

func parentOperationPath(path string) string {
	path = strings.Trim(path, "/")
	if index := strings.LastIndex(path, "/"); index >= 0 {
		return path[:index]
	}
	return ""
}

func validateOperationName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\\`) || strings.ContainsRune(name, 0) {
		return "", ErrInvalidName
	}
	return name, nil
}

func operationError(err error) error {
	return adaptFileOperationError(err)
}

// CreateDirectory creates one directory without implicitly creating parents.
func (s *Service) CreateDirectory(ctx context.Context, request CreateDirectoryRequest) (FileOperationResult, error) {
	root, walker, path, err := s.operationRoot(request.RootID, request.Path, true)
	if err != nil {
		return FileOperationResult{}, operationError(err)
	}
	if path == "" {
		return FileOperationResult{}, ErrInvalidName
	}
	if err = walker.CreateDirectory(ctx, path); err != nil {
		return FileOperationResult{}, operationError(err)
	}
	return FileOperationResult{Operation: "create-directory", RootID: root.ID, Path: path}, nil
}

// Rename changes only the final name, keeping the source parent stable.
func (s *Service) Rename(ctx context.Context, request RenameRequest) (FileOperationResult, error) {
	root, walker, sourcePath, err := s.operationRoot(request.RootID, request.Path, true)
	if err != nil {
		return FileOperationResult{}, operationError(err)
	}
	if sourcePath == "" {
		return FileOperationResult{}, ErrInvalidName
	}
	name, err := validateOperationName(request.NewName)
	if err != nil {
		return FileOperationResult{}, err
	}
	destinationPath := joinOperationPath(parentOperationPath(sourcePath), name)
	if _, _, _, err = s.operationRoot(request.RootID, destinationPath, true); err != nil {
		return FileOperationResult{}, operationError(err)
	}
	if err = walker.Rename(ctx, sourcePath, destinationPath); err != nil {
		return FileOperationResult{}, operationError(err)
	}
	return FileOperationResult{Operation: "rename", RootID: root.ID, Path: destinationPath}, nil
}

// Copy delegates traversal, filtering, atomic replacement and cancellation to
// fswalk.CopyTree while keeping source and destination capabilities separate.
func (s *Service) Copy(ctx context.Context, request CopyRequest) (FileOperationResult, error) {
	sourceRoot, sourceWalker, sourcePath, err := s.operationRoot(request.SourceRootID, request.SourcePath, false)
	if err != nil {
		return FileOperationResult{}, operationError(err)
	}
	destinationRoot, destinationWalker, destinationPath, err := s.operationRoot(request.DestinationRootID, request.DestinationPath, true)
	if err != nil {
		return FileOperationResult{}, operationError(err)
	}
	result, err := sourceWalker.CopyTree(ctx, sourcePath, destinationWalker, destinationPath, fswalk.CopyTreeQuery{})
	if err != nil {
		return FileOperationResult{}, operationError(err)
	}
	return FileOperationResult{
		Operation: "copy", SourceRootID: sourceRoot.ID, SourcePath: sourcePath,
		DestinationRootID: destinationRoot.ID, DestinationPath: destinationPath,
		CopiedFileCount: result.CopiedFileCount, CopiedDirectoryCount: result.CopiedDirectoryCount,
		CreatedDirectoryCount: result.CreatedDirectoryCount, CopiedBytes: result.CopiedBytes,
	}, nil
}
