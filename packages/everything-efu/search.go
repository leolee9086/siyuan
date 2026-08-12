package everythingefu

import (
	"context"
	pathpkg "path"
	"strings"
)

type Provider struct {
	source Source
}

func NewProvider(source Source) *Provider {
	return &Provider{source: source}
}

func (p *Provider) Search(ctx context.Context, request SearchRequest) (Page, error) {
	if p == nil || p.source == nil || strings.TrimSpace(request.RootID) == "" || !IsEFUPath(request.Path) {
		return Page{}, ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return Page{}, err
	}
	reader, err := p.source(ctx, request)
	if err != nil {
		if ctx.Err() != nil {
			return Page{}, ctx.Err()
		}
		// The source is owned by kernel authorization. Preserve its typed
		// boundary errors instead of relabeling path traversal as a provider
		// outage.
		return Page{}, err
	}
	if reader == nil {
		return Page{}, ErrUnavailable
	}
	defer reader.Close()
	assets, issues, err := Parse(reader)
	if err != nil {
		return Page{}, err
	}
	offset, limit, err := NormalizePage(request.Offset, request.Limit)
	if err != nil {
		return Page{}, err
	}
	if err = ctx.Err(); err != nil {
		return Page{}, err
	}
	if offset > len(assets) {
		offset = len(assets)
	}
	end := offset + limit
	if end > len(assets) {
		end = len(assets)
	}
	return Page{
		Provider:   ProviderIDValue(),
		Assets:     append([]Asset(nil), assets[offset:end]...),
		Issues:     issues,
		TotalCount: len(assets),
		Offset:     offset,
		Limit:      limit,
		HasMore:    end < len(assets),
	}, nil
}

func IsEFUPath(value string) bool {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	if value == "" || strings.HasSuffix(value, "/") {
		return false
	}
	name := pathpkg.Base(value)
	dot := strings.LastIndexByte(name, '.')
	return dot > 0 && strings.EqualFold(name[dot:], ".efu")
}
