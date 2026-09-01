// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package conf

type Bazaar struct {
	Trust         bool                 `json:"trust"`
	PetalDisabled bool                 `json:"petalDisabled"`
	Sources       []*BazaarSource      `json:"sources"`
	Publish       *BazaarPublish       `json:"publish"`
	Security      *BazaarSecurity      `json:"security"`
	Hub           *BazaarHubPreference `json:"hub"`
}

type BazaarSource struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	Token        string `json:"token"`
	Enabled      bool   `json:"enabled"`
	AllowInstall bool   `json:"allowInstall"`
	OpenInTab    bool   `json:"openInTab"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

type BazaarPublish struct {
	Enabled                    bool                   `json:"enabled"`
	RequireAuth                bool                   `json:"requireAuth"`
	AuthToken                  string                 `json:"authToken"`
	MinExpose                  bool                   `json:"minExpose"`
	AllowOfficialNameCollision bool                   `json:"allowOfficialNameCollision"`
	Rules                      []*BazaarPublishRule   `json:"rules"`
	Records                    []*BazaarPublishRecord `json:"records"`
}

type BazaarPublishRule struct {
	PackageType string `json:"packageType"`
	PackageName string `json:"packageName"`
	Enabled     bool   `json:"enabled"`
}

type BazaarPublishRecord struct {
	PackageType  string `json:"packageType"`
	PackageName  string `json:"packageName"`
	Version      string `json:"version"`
	ArtifactID   string `json:"artifactId"`
	PublishedAt  int64  `json:"publishedAt"`
	ChecksumSHA  string `json:"checksumSHA"`
	DisplayName  string `json:"displayName"`
	Description  string `json:"description"`
	Author       string `json:"author"`
	OfficialName bool   `json:"officialName"`
}

type BazaarSecurity struct {
	EnableRateLimit   bool `json:"enableRateLimit"`
	RequestsPerMinute int  `json:"requestsPerMinute"`
	Burst             int  `json:"burst"`
	WindowSeconds     int  `json:"windowSeconds"`
}

type BazaarHubPreference struct {
	DefaultSourceID string `json:"defaultSourceID"`
	ShowOfficial    bool   `json:"showOfficial"`
}

func NewBazaarSource() *BazaarSource {
	return &BazaarSource{
		Enabled:      true,
		AllowInstall: true,
		OpenInTab:    true,
	}
}

func NewBazaarPublish() *BazaarPublish {
	return &BazaarPublish{
		Enabled:                    false,
		RequireAuth:                true,
		MinExpose:                  true,
		AllowOfficialNameCollision: false,
		Rules:                      []*BazaarPublishRule{},
		Records:                    []*BazaarPublishRecord{},
	}
}

func NewBazaarSecurity() *BazaarSecurity {
	return &BazaarSecurity{
		EnableRateLimit:   true,
		RequestsPerMinute: 120,
		Burst:             30,
		WindowSeconds:     60,
	}
}

func NewBazaarHubPreference() *BazaarHubPreference {
	return &BazaarHubPreference{
		ShowOfficial: true,
	}
}

func (b *Bazaar) Normalize() {
	if nil == b.Sources {
		b.Sources = []*BazaarSource{}
	}

	if nil == b.Publish {
		b.Publish = NewBazaarPublish()
	}
	if nil == b.Publish.Rules {
		b.Publish.Rules = []*BazaarPublishRule{}
	}
	if nil == b.Publish.Records {
		b.Publish.Records = []*BazaarPublishRecord{}
	}

	if nil == b.Security {
		b.Security = NewBazaarSecurity()
	}
	if 1 > b.Security.RequestsPerMinute {
		b.Security.RequestsPerMinute = 120
	}
	if 1 > b.Security.Burst {
		b.Security.Burst = 30
	}
	if 1 > b.Security.WindowSeconds {
		b.Security.WindowSeconds = 60
	}

	if nil == b.Hub {
		b.Hub = NewBazaarHubPreference()
	}
}

func NewBazaar() *Bazaar {
	ret := &Bazaar{
		Trust:         false,
		PetalDisabled: false,
		Sources:       []*BazaarSource{},
		Publish:       NewBazaarPublish(),
		Security:      NewBazaarSecurity(),
		Hub:           NewBazaarHubPreference(),
	}
	ret.Normalize()
	return ret
}
