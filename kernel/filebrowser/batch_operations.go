package filebrowser

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"strings"
)

// DeleteBatch executes the same authorized Delete operation for a bounded set
// of selected addresses. Each item keeps its own error so a missing or
// read-only entry does not erase successful results from the same request.
func (s *Service) DeleteBatch(ctx context.Context, request BatchDeleteRequest) (BatchDeleteResult, error) {
	if len(request.Items) == 0 {
		return BatchDeleteResult{}, ErrBatchItemsEmpty
	}
	if len(request.Items) > 100 {
		return BatchDeleteResult{}, ErrBatchItemsTooLarge
	}

	items := make([]BatchDeleteItemResult, len(request.Items))
	order := make([]int, len(request.Items))
	seen := make(map[string]struct{}, len(request.Items))
	for index, item := range request.Items {
		items[index].Request = item
		path, err := normalizeRelativePath(item.Path)
		if err != nil {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(item.RootID)) + "\x00" + path
		if _, exists := seen[key]; exists {
			return BatchDeleteResult{}, ErrBatchDuplicate
		}
		seen[key] = struct{}{}
		order[index] = index
	}
	sort.SliceStable(order, func(left, right int) bool {
		leftItem, rightItem := request.Items[order[left]], request.Items[order[right]]
		if !strings.EqualFold(leftItem.RootID, rightItem.RootID) {
			return strings.ToLower(leftItem.RootID) < strings.ToLower(rightItem.RootID)
		}
		leftPath, _ := normalizeRelativePath(leftItem.Path)
		rightPath, _ := normalizeRelativePath(rightItem.Path)
		leftDepth := strings.Count(leftPath, "/")
		rightDepth := strings.Count(rightPath, "/")
		if leftDepth != rightDepth {
			return leftDepth > rightDepth
		}
		return leftPath < rightPath
	})

	result := BatchDeleteResult{Items: items}
	for _, index := range order {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		operation, err := s.Delete(ctx, DeleteRequest(items[index].Request))
		if err != nil {
			result.Items[index].Error = &OperationFailure{
				Code: operationFailureCode(err), Message: err.Error(),
			}
			result.FailureCount++
			continue
		}
		result.Items[index].Result = &operation
		result.SuccessCount++
	}
	return result, nil
}

func batchOperationOrder(items []FileRequest) ([]int, error) {
	if len(items) == 0 {
		return nil, ErrBatchItemsEmpty
	}
	if len(items) > 100 {
		return nil, ErrBatchItemsTooLarge
	}
	seen := make(map[string]struct{}, len(items))
	order := make([]int, len(items))
	for index, item := range items {
		path, err := normalizeRelativePath(item.Path)
		if err != nil {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(item.RootID)) + "\x00" + path
		if _, exists := seen[key]; exists {
			return nil, ErrBatchDuplicate
		}
		seen[key] = struct{}{}
		order[index] = index
	}
	sort.SliceStable(order, func(left, right int) bool {
		leftItem, rightItem := items[order[left]], items[order[right]]
		if !strings.EqualFold(leftItem.RootID, rightItem.RootID) {
			return strings.ToLower(leftItem.RootID) < strings.ToLower(rightItem.RootID)
		}
		leftPath, _ := normalizeRelativePath(leftItem.Path)
		rightPath, _ := normalizeRelativePath(rightItem.Path)
		leftDepth := strings.Count(leftPath, "/")
		rightDepth := strings.Count(rightPath, "/")
		if leftDepth != rightDepth {
			return leftDepth > rightDepth
		}
		return leftPath < rightPath
	})
	return order, nil
}

func (s *Service) validateBatchDestination(rootID, path string) (Root, string, error) {
	root, _, normalized, err := s.ValidateRootPath(rootID, path)
	if err != nil {
		return Root{}, "", err
	}
	return root, normalized, nil
}

func batchDestinationPath(directory, source string) string {
	name := filepath.Base(filepath.FromSlash(source))
	return joinOperationPath(directory, name)
}

// MoveBatch moves selected entries into an existing authorized directory.
// Results retain input order while execution handles descendants first.
func (s *Service) MoveBatch(ctx context.Context, request BatchMoveRequest) (BatchOperationResult, error) {
	return s.runBatchTransfer(ctx, request.Items, request.DestinationRootID, request.DestinationPath, "move")
}

// CopyBatch copies selected entries into an existing authorized directory.
// Source filtering and copy semantics remain owned by Copy and fswalk.
func (s *Service) CopyBatch(ctx context.Context, request BatchCopyRequest) (BatchOperationResult, error) {
	return s.runBatchTransfer(ctx, request.Items, request.DestinationRootID, request.DestinationPath, "copy")
}

func (s *Service) runBatchTransfer(ctx context.Context, items []FileRequest, destinationRootID, destinationPath, operation string) (BatchOperationResult, error) {
	order, err := batchOperationOrder(items)
	if err != nil {
		return BatchOperationResult{}, err
	}
	destinationRoot, normalizedDestination, err := s.validateBatchDestination(destinationRootID, destinationPath)
	if err != nil {
		return BatchOperationResult{}, operationError(err)
	}
	result := BatchOperationResult{Items: make([]BatchOperationItemResult, len(items))}
	for index, item := range items {
		result.Items[index].Request = item
	}
	for _, index := range order {
		if err = ctx.Err(); err != nil {
			return result, err
		}
		item := items[index]
		sourcePath, normalizeErr := normalizeRelativePath(item.Path)
		if normalizeErr != nil {
			result.Items[index].Error = &OperationFailure{Code: operationFailureCode(normalizeErr), Message: normalizeErr.Error()}
			result.FailureCount++
			continue
		}
		targetPath := batchDestinationPath(normalizedDestination, sourcePath)
		if operation == "move" {
			transferred, transferErr := s.Move(ctx, MoveRequest{
				SourceRootID: item.RootID, SourcePath: sourcePath,
				DestinationRootID: destinationRoot.ID, DestinationPath: targetPath,
			})
			if transferErr != nil {
				result.Items[index].Error = &OperationFailure{Code: operationFailureCode(transferErr), Message: transferErr.Error()}
				result.FailureCount++
				continue
			}
			result.Items[index].Result = &transferred
			result.SuccessCount++
			continue
		}
		transferred, transferErr := s.Copy(ctx, CopyRequest{
			SourceRootID: item.RootID, SourcePath: sourcePath,
			DestinationRootID: destinationRoot.ID, DestinationPath: targetPath,
		})
		if transferErr != nil {
			result.Items[index].Error = &OperationFailure{Code: operationFailureCode(transferErr), Message: transferErr.Error()}
			result.FailureCount++
			continue
		}
		result.Items[index].Result = &transferred
		result.SuccessCount++
	}
	return result, nil
}

func operationFailureCode(err error) string {
	switch {
	case errors.Is(err, ErrRootNotFound):
		return "root-not-found"
	case errors.Is(err, ErrRootUnavailable):
		return "root-unavailable"
	case errors.Is(err, ErrPathNotFound):
		return "path-not-found"
	case errors.Is(err, ErrPathTraversal):
		return "path-traversal"
	case errors.Is(err, ErrWriteDenied):
		return "write-denied"
	case errors.Is(err, ErrRootMutation):
		return "root-mutation"
	case errors.Is(err, ErrSymlinkRestricted):
		return "symlink-restricted"
	case errors.Is(err, ErrUnsupportedFile):
		return "unsupported-file"
	case errors.Is(err, ErrPathExists):
		return "path-exists"
	case errors.Is(err, ErrDestinationType):
		return "destination-type"
	case errors.Is(err, ErrPathOverlap):
		return "path-overlap"
	case errors.Is(err, ErrNotDirectory):
		return "not-directory"
	case errors.Is(err, ErrNotFile):
		return "not-file"
	case errors.Is(err, ErrInvalidName):
		return "invalid-name"
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "deadline-exceeded"
	default:
		return "operation-failed"
	}
}
