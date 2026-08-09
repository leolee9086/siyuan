package filebrowser

import (
	"context"
	"errors"
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
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "deadline-exceeded"
	default:
		return "operation-failed"
	}
}
