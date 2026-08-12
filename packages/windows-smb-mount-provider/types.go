// Package windowssmbmount adapts SMB shares already connected in the current
// Windows logon session to the external provider contract.
package windowssmbmount

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const (
	ProviderID       = "windows-smb-mount"
	DefaultPageLimit = 200
	MaxListEntries   = 100000
)

var (
	ErrClosed          = errors.New("windows SMB mount session is closed")
	ErrNoMappedShares  = errors.New("no SMB shares are mapped in the current Windows session")
	ErrPlatform        = errors.New("Windows SMB mount discovery is supported on Windows only")
	ErrInvalidEndpoint = errors.New("Windows SMB mount endpoint is invalid")
)

// Mount is one current-logon alias for an SMB tree connect. RemoteName and
// LocalName never cross the browser operation-address boundary.
type Mount struct {
	LocalName  string
	RemoteName string
}

type MountDiscoverer interface {
	Discover(context.Context) ([]Mount, error)
}

type FileInfo struct {
	Name      string
	Size      int64
	Mode      fs.FileMode
	ModTime   time.Time
	IsDir     bool
	MediaType string
}

type FileSystem interface {
	ReadDir(context.Context, string) ([]FileInfo, error)
	Stat(context.Context, string) (FileInfo, error)
	Open(context.Context, string) (io.ReadCloser, error)
	Create(context.Context, string, io.Reader, int64, fs.FileMode) error
	Rename(context.Context, string, string) error
	Remove(context.Context, string, bool) error
	Copy(context.Context, string, string, bool) error
}

type FileSystemFactory func(root string) FileSystem

type Config struct {
	Discoverer  MountDiscoverer
	FileSystems FileSystemFactory
}

type Provider struct {
	discoverer  MountDiscoverer
	fileSystems FileSystemFactory
}

func NewProvider(config Config) *Provider {
	discoverer := config.Discoverer
	if discoverer == nil {
		discoverer = systemMountDiscoverer{}
	}
	factory := config.FileSystems
	if factory == nil {
		factory = newOSFileSystem
	}
	return &Provider{discoverer: discoverer, fileSystems: factory}
}

func (p *Provider) ID() externalprovider.ProviderID {
	return externalprovider.ProviderID(ProviderID)
}

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID: p.ID(), DisplayName: "Windows SMB shares", Kind: externalprovider.ProviderKindFileShare,
		SessionMode: externalprovider.SessionModeAutomatic, SessionLabel: "当前 Windows 会话",
		Capabilities: []string{
			externalprovider.CapabilityList, externalprovider.CapabilityStat,
			externalprovider.CapabilityOpen, externalprovider.CapabilityRead,
			externalprovider.CapabilityWrite, externalprovider.CapabilityCreate,
			externalprovider.CapabilityUpdate, externalprovider.CapabilityDelete,
			externalprovider.CapabilityCopy, externalprovider.CapabilityMove,
			externalprovider.CapabilityPaging, externalprovider.CapabilityHealth,
		},
	}
}
