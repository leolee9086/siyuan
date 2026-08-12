package externalprovidercontract

import "testing"

func TestValidateDescriptorSessionConfig(t *testing.T) {
	valid := Descriptor{
		ID: "dav", DisplayName: "DAV", Kind: ProviderKindFileShare,
		SessionMode: SessionModeConfigured, SessionLabel: "DAV session",
		SessionConfig: &SessionConfig{
			ReadOnly: true, EndpointTransport: EndpointTransportHTTPSOrConfirmedPrivateHTTP,
			Fields: []SessionField{
				{Target: SessionFieldTargetEndpoint, Key: "endpoint", Label: "Endpoint", Input: SessionFieldInputURL, Required: true},
				{Target: SessionFieldTargetCredential, Key: "username", Label: "Username", Input: SessionFieldInputText},
				{Target: SessionFieldTargetCredential, Key: "password", Label: "Password", Input: SessionFieldInputPassword},
			},
		},
		Capabilities: []string{CapabilityList},
	}
	if err := ValidateDescriptor(valid); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name   string
		mutate func(*Descriptor)
	}{
		{name: "configured without schema", mutate: func(value *Descriptor) { value.SessionConfig = nil }},
		{name: "automatic with schema", mutate: func(value *Descriptor) { value.SessionMode = SessionModeAutomatic }},
		{name: "duplicate field", mutate: func(value *Descriptor) {
			value.SessionConfig.Fields = append(value.SessionConfig.Fields, value.SessionConfig.Fields[0])
		}},
		{name: "secret default", mutate: func(value *Descriptor) { value.SessionConfig.Fields[2].DefaultValue = "secret" }},
		{name: "missing dependency", mutate: func(value *Descriptor) { value.SessionConfig.Fields[1].RequiredWith = []string{"missing"} }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value := valid
			config := *valid.SessionConfig
			config.Fields = append([]SessionField(nil), valid.SessionConfig.Fields...)
			value.SessionConfig = &config
			test.mutate(&value)
			if err := ValidateDescriptor(value); err == nil {
				t.Fatal("invalid session config was accepted")
			}
		})
	}
}
