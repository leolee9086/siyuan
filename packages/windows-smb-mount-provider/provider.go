package windowssmbmount

import (
	"context"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func (p *Provider) Health(ctx context.Context) (externalprovider.HealthStatus, error) {
	if p == nil || p.discoverer == nil {
		return externalprovider.HealthStatus{Available: false}, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return externalprovider.HealthStatus{Available: false}, err
	}
	mounts, err := p.discoverer.Discover(ctx)
	if err != nil {
		return externalprovider.HealthStatus{Available: false, Message: err.Error()}, mapSystemError(err)
	}
	return externalprovider.HealthStatus{Available: len(mounts) > 0, Message: "mapped SMB shares discovered"}, nil
}
