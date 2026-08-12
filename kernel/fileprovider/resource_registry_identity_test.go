package fileprovider

import (
	"context"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type equalValueSessionProvider struct {
	id      ProviderID
	session *equalValueSession
}

func (p *equalValueSessionProvider) ID() ProviderID {
	return p.id
}

func (p *equalValueSessionProvider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID:           p.id,
		DisplayName:  "同名文件服务",
		Kind:         externalprovider.ProviderKindFileShare,
		SessionMode:  externalprovider.SessionModeAutomatic,
		SessionLabel: "same session",
		Capabilities: []string{externalprovider.CapabilityList},
	}
}

func (p *equalValueSessionProvider) OpenSession(context.Context, externalprovider.SessionRequest) (externalprovider.Session, error) {
	return p.session, nil
}

func (p *equalValueSessionProvider) ValidateSessionRequest(externalprovider.SessionRequest) error {
	return nil
}

type equalValueSession struct {
	provider ProviderID
	closed   bool
}

func (s *equalValueSession) ID() externalprovider.SessionID {
	return "same-session"
}

func (s *equalValueSession) Resources(context.Context, externalprovider.PageRequest) (externalprovider.ResourcePage, error) {
	total := 1
	return externalprovider.ResourcePage{
		Resources: []externalprovider.ResourceDescriptor{{
			ID:           "same-resource",
			Name:         "视频素材",
			Kind:         externalprovider.ProviderKindFileShare,
			ReadOnly:     true,
			Capabilities: []string{externalprovider.CapabilityList},
			Source:       externalprovider.SourceDescriptor{Name: "192.168.31.195", Kind: "endpoint"},
			Ref: externalprovider.ResourceRef{
				Provider: externalprovider.ProviderID(s.provider),
				Session:  s.ID(),
				Resource: "same-resource",
			},
		}},
		Total: &total,
		Limit: 10,
	}, nil
}

func (s *equalValueSession) OpenResource(context.Context, externalprovider.ResourceRef) (externalprovider.Resource, error) {
	return nil, externalprovider.ErrCapability
}

func (s *equalValueSession) Close() error {
	s.closed = true
	return nil
}

func TestProviderRegistryKeepsEqualValuedSessionsIndependent(t *testing.T) {
	registry := NewProviderRegistry(NewAddressRegistry())
	smbSession := &equalValueSession{provider: "windows-smb-mount"}
	dsmSession := &equalValueSession{provider: "synology-file-station"}
	providers := []*equalValueSessionProvider{
		{id: "windows-smb-mount", session: smbSession},
		{id: "synology-file-station", session: dsmSession},
	}
	for _, provider := range providers {
		if err := registry.Register(provider); err != nil {
			t.Fatal(err)
		}
		if _, err := registry.OpenSession(context.Background(), provider.id, externalprovider.SessionRequest{Endpoint: "192.168.31.195"}); err != nil {
			t.Fatalf("provider %q session was merged or rejected: %v", provider.id, err)
		}
	}
	if len(registry.sessions) != 2 {
		t.Fatalf("equal-valued sessions did not retain provider namespaces: %#v", registry.sessions)
	}

	for _, provider := range providers {
		page, err := registry.ListResources(context.Background(), provider.id, "same-session", externalprovider.PageRequest{Limit: 10})
		if err != nil {
			t.Fatalf("provider %q resource listing failed: %v", provider.id, err)
		}
		if len(page.Resources) != 1 || page.Resources[0].Ref.Provider != externalprovider.ProviderID(provider.id) {
			t.Fatalf("provider %q returned a cross-provider resource: %#v", provider.id, page.Resources)
		}
	}

	if err := registry.CloseSession("windows-smb-mount", "same-session"); err != nil {
		t.Fatal(err)
	}
	if !smbSession.closed || dsmSession.closed {
		t.Fatalf("closing one provider affected another provider session: smb=%t dsm=%t", smbSession.closed, dsmSession.closed)
	}
	if _, ok := registry.LookupSession("synology-file-station", "same-session"); !ok {
		t.Fatal("closing SMB removed the equal-valued DSM session")
	}
}
