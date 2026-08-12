package externalprovidercontract

import (
	"errors"
	"strings"
)

const (
	MaxPageLimit  = 10000
	MaxCursorSize = 8192
	MaxPathSize   = 32768
	MaxNameSize   = 1024
	MaxSortTerms  = 16
)

func ValidateDescriptor(descriptor Descriptor) error {
	if strings.TrimSpace(string(descriptor.ID)) == "" || strings.TrimSpace(descriptor.DisplayName) == "" ||
		strings.TrimSpace(descriptor.Kind) == "" {
		return ErrInvalidRequest
	}
	switch descriptor.SessionMode {
	case SessionModeNone:
		if strings.TrimSpace(descriptor.SessionLabel) != "" || descriptor.SessionConfig != nil {
			return ErrInvalidRequest
		}
	case SessionModeAutomatic:
		if strings.TrimSpace(descriptor.SessionLabel) == "" || descriptor.SessionConfig != nil {
			return ErrInvalidRequest
		}
	case SessionModeConfigured:
		if strings.TrimSpace(descriptor.SessionLabel) == "" {
			return ErrInvalidRequest
		}
		if err := validateSessionConfig(descriptor.SessionConfig); err != nil {
			return err
		}
	default:
		return ErrInvalidRequest
	}
	seen := make(map[string]struct{}, len(descriptor.Capabilities))
	for _, capability := range descriptor.Capabilities {
		capability = strings.TrimSpace(capability)
		if capability == "" {
			return ErrInvalidRequest
		}
		if _, exists := seen[capability]; exists {
			return ErrInvalidRequest
		}
		seen[capability] = struct{}{}
	}
	return nil
}

func ValidatePageRequest(request PageRequest) error {
	if request.Limit < 0 || request.Limit > MaxPageLimit || len(request.Cursor) > MaxCursorSize {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateResourceRef(ref ResourceRef) error {
	if strings.TrimSpace(string(ref.Provider)) == "" || strings.TrimSpace(string(ref.Session)) == "" || strings.TrimSpace(string(ref.Resource)) == "" {
		return ErrInvalidRequest
	}
	if strings.IndexByte(ref.Path, 0) >= 0 || len(ref.Path) > MaxPathSize {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateSortTerms(terms []SortTerm) error {
	if len(terms) > MaxSortTerms {
		return ErrInvalidRequest
	}
	for _, term := range terms {
		if strings.TrimSpace(term.Field) == "" || len(term.Field) > MaxNameSize {
			return ErrInvalidRequest
		}
	}
	return nil
}

func ValidateListRequest(request ListRequest) error {
	if err := ValidateResourceRef(request.Parent); err != nil {
		return err
	}
	if err := ValidatePageRequest(request.Page); err != nil {
		return err
	}
	return ValidateSortTerms(request.Sort)
}

func ValidateStatRequest(request StatRequest) error {
	if err := ValidateResourceRef(request.Target); err != nil {
		return err
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateByteRange(value *ByteRange) error {
	if value == nil {
		return nil
	}
	if value.Start < 0 || (value.End != 0 && value.End < value.Start) {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateOpenRequest(request OpenRequest) error {
	if err := ValidateResourceRef(request.Target); err != nil {
		return err
	}
	if err := ValidateByteRange(request.Range); err != nil {
		return err
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidatePreconditions(value Preconditions) error {
	if len(value.IfMatch) > MaxNameSize || len(value.IfNoneMatch) > MaxNameSize || len(value.VersionID) > MaxNameSize {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateEntry(entry Entry) error {
	if strings.TrimSpace(entry.ID) == "" || strings.TrimSpace(entry.Name) == "" || len(entry.Name) > MaxNameSize {
		return ErrResponse
	}
	if strings.IndexByte(entry.Name, 0) >= 0 || strings.IndexByte(entry.Path, 0) >= 0 || entry.Size < 0 {
		return ErrResponse
	}
	if err := ValidateResourceRef(entry.Ref); err != nil {
		return ErrResponse
	}
	switch entry.Kind {
	case EntryKindFile, EntryKindDirectory, EntryKindObject, EntryKindBucket:
	default:
		return ErrResponse
	}
	if entry.IsDir != (entry.Kind == EntryKindDirectory || entry.Kind == EntryKindBucket) {
		return ErrResponse
	}
	return nil
}

func ValidateDirectoryPage(page DirectoryPage) error {
	if err := ValidateResourceRef(page.Parent); err != nil {
		return ErrResponse
	}
	if page.Limit < 0 || page.Limit > MaxPageLimit || page.Total < 0 {
		return ErrResponse
	}
	for _, entry := range page.Entries {
		if err := ValidateEntry(entry); err != nil {
			return err
		}
	}
	return nil
}

func ValidateResourcePage(page ResourcePage) error {
	if page.Limit < 0 || page.Limit > MaxPageLimit || len(page.NextCursor) > MaxCursorSize {
		return ErrResponse
	}
	if page.Total != nil && *page.Total < 0 {
		return ErrResponse
	}
	for _, resource := range page.Resources {
		if strings.TrimSpace(string(resource.ID)) == "" || strings.TrimSpace(resource.Name) == "" {
			return ErrResponse
		}
		if err := ValidateSourceDescriptor(resource.Source); err != nil {
			return ErrResponse
		}
		seenAliases := make(map[string]struct{}, len(resource.Aliases))
		for _, alias := range resource.Aliases {
			kind := strings.TrimSpace(alias.Kind)
			label := strings.TrimSpace(alias.Label)
			if kind == "" || label == "" || len(label) > MaxNameSize || strings.IndexByte(label, 0) >= 0 {
				return ErrResponse
			}
			key := kind + "\x00" + label
			if _, exists := seenAliases[key]; exists {
				return ErrResponse
			}
			seenAliases[key] = struct{}{}
		}
		if err := ValidateResourceRef(resource.Ref); err != nil {
			return ErrResponse
		}
	}
	return nil
}

func ValidateSourceDescriptor(source SourceDescriptor) error {
	if strings.TrimSpace(source.Name) == "" || strings.TrimSpace(source.Kind) == "" {
		return ErrResponse
	}
	if len(source.Name) > MaxNameSize || strings.IndexByte(source.Name, 0) >= 0 {
		return ErrResponse
	}
	return nil
}

func ValidateCreateRequest(request CreateRequest) error {
	if err := ValidateResourceRef(request.Parent); err != nil {
		return err
	}
	if err := ValidateName(request.Name); err != nil {
		return err
	}
	if request.Size < -1 {
		return ErrInvalidRequest
	}
	if request.Kind != EntryKindFile && request.Kind != EntryKindDirectory && request.Kind != EntryKindObject {
		return ErrInvalidRequest
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateUpdateRequest(request UpdateRequest) error {
	if err := ValidateResourceRef(request.Target); err != nil {
		return err
	}
	if request.NewName != "" {
		if err := ValidateName(request.NewName); err != nil {
			return err
		}
	}
	if request.Size < -1 {
		return ErrInvalidRequest
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateDeleteRequest(request DeleteRequest) error {
	if len(request.Targets) == 0 {
		return ErrInvalidRequest
	}
	for _, target := range request.Targets {
		if err := ValidateResourceRef(target); err != nil {
			return err
		}
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateCopyRequest(request CopyRequest) error {
	if err := ValidateResourceRef(request.Source); err != nil {
		return err
	}
	if err := ValidateResourceRef(request.Destination); err != nil {
		return err
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateMoveRequest(request MoveRequest) error {
	if err := ValidateResourceRef(request.Source); err != nil {
		return err
	}
	if err := ValidateResourceRef(request.Destination); err != nil {
		return err
	}
	return ValidatePreconditions(request.Preconditions)
}

func ValidateWatchRequest(request WatchRequest) error {
	if err := ValidateResourceRef(request.Root); err != nil {
		return err
	}
	if len(request.ResumeFrom) > MaxCursorSize {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateName(name string) error {
	if strings.TrimSpace(name) == "" || len(name) > MaxNameSize || strings.IndexByte(name, 0) >= 0 {
		return ErrInvalidRequest
	}
	if name == "." || name == ".." || strings.ContainsAny(name, "/\\") {
		return ErrInvalidRequest
	}
	return nil
}

func ValidateMutationResult(result MutationResult) error {
	if strings.TrimSpace(result.Operation) == "" || result.Count < 0 {
		return ErrResponse
	}
	if result.OperationRef != nil && strings.TrimSpace(result.OperationRef.ID) == "" {
		return ErrResponse
	}
	if result.OperationRef != nil && result.OperationRef.ID != strings.TrimSpace(result.OperationRef.ID) {
		return ErrResponse
	}
	if len(result.Failures) > 0 && len(result.Entries) == 0 && result.OperationRef == nil && result.Count == 0 {
		return errors.Join(ErrResponse, ErrInvalidRequest)
	}
	for _, entry := range result.Entries {
		if err := ValidateEntry(entry); err != nil {
			return err
		}
	}
	return nil
}
