//go:build !windows

package windowssmbmount

import "context"

type systemMountDiscoverer struct{}

func (systemMountDiscoverer) Discover(context.Context) ([]Mount, error) {
	return nil, ErrPlatform
}
