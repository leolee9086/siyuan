package llm

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
)

type ProfileManager struct {
	mu           sync.RWMutex
	activeID     string
	activeClient Client
	onChange     func(name string)
}

var globalPool = &ProfileManager{}

func InitPool() error {
	store := model.GetProfileStore()
	if store == nil {
		return fmt.Errorf("profile store not initialized")
	}

	p, err := store.GetActive()
	if err != nil {
		return fmt.Errorf("get active profile: %w", err)
	}
	if p == nil {
		return nil
	}

	client := newClientFromProfile(p)
	globalPool.mu.Lock()
	globalPool.activeID = p.ID
	globalPool.activeClient = client
	globalPool.mu.Unlock()

	return nil
}

func GetActiveClient() Client {
	globalPool.mu.RLock()
	defer globalPool.mu.RUnlock()
	return globalPool.activeClient
}

func GetActiveProfileID() string {
	globalPool.mu.RLock()
	defer globalPool.mu.RUnlock()
	return globalPool.activeID
}

func SwitchProfile(profileID string) error {
	store := model.GetProfileStore()
	if store == nil {
		return fmt.Errorf("profile store not initialized")
	}

	p, err := store.Get(profileID)
	if err != nil {
		return fmt.Errorf("get profile: %w", err)
	}
	if p == nil {
		return fmt.Errorf("profile not found: %s", profileID)
	}
	if !p.Enabled {
		return fmt.Errorf("profile is disabled: %s", p.Name)
	}

	if err := store.SetActive(profileID); err != nil {
		return fmt.Errorf("set active: %w", err)
	}

	model.SyncProfileToConf(p)

	client := newClientFromProfile(p)

	globalPool.mu.Lock()
	globalPool.activeID = profileID
	globalPool.activeClient = client
	onChange := globalPool.onChange
	globalPool.mu.Unlock()

	if onChange != nil {
		onChange(p.Name)
	}

	return nil
}

func RegisterOnChange(fn func(name string)) {
	globalPool.mu.Lock()
	defer globalPool.mu.Unlock()
	globalPool.onChange = fn
}

type ModelSelectOpts struct {
	Model      string
	Modalities []string
}

func SelectClient(opts ModelSelectOpts) (Client, string, error) {
	store := model.GetProfileStore()
	if store == nil {
		return nil, "", fmt.Errorf("profile store not initialized")
	}

	profiles, err := store.List()
	if err != nil {
		return nil, "", err
	}

	type candidate struct {
		profile  *model.Profile
		pm       *model.ProfileModel
		priority int
	}

	var candidates []candidate
	highestPriority := -1

	for _, p := range profiles {
		if !p.Enabled {
			continue
		}
		models, err := store.ListModels(p.ID)
		if err != nil {
			continue
		}
		for _, m := range models {
			if !m.Enabled {
				continue
			}
			if opts.Model != "" && m.Model != opts.Model {
				continue
			}
			if opts.Model == "" && p.Model != "" && p.Model != m.Model {
				continue
			}
			if len(opts.Modalities) > 0 {
				var caps struct {
					Modalities []string `json:"modalities"`
				}
				if err := json.Unmarshal([]byte(m.Capabilities), &caps); err != nil {
					continue
				}
				if !hasAllModalities(caps.Modalities, opts.Modalities) {
					continue
				}
			}
			candidates = append(candidates, candidate{
				profile:  p,
				pm:       m,
				priority: p.Priority,
			})
			if p.Priority > highestPriority {
				highestPriority = p.Priority
			}
		}
	}

	if len(candidates) == 0 {
		return nil, "", fmt.Errorf("no profile found for model=%q modalities=%v",
			opts.Model, opts.Modalities)
	}

	var best []candidate
	for _, c := range candidates {
		if c.priority == highestPriority {
			best = append(best, c)
		}
	}

	chosen := best[rand.Intn(len(best))]
	client := newClientFromProfile(chosen.profile)

	modelName := chosen.pm.Model
	if chosen.pm.SendAs != "" {
		modelName = chosen.pm.SendAs
	}

	return client, modelName, nil
}

func hasAllModalities(available, required []string) bool {
	for _, r := range required {
		found := false
		for _, a := range available {
			if strings.EqualFold(a, r) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func newClientFromProfile(p *model.Profile) Client {
	apiProxy := p.APIProxy
	if model.Conf != nil {
		apiProxy = conf.EffectiveProxyURLWithOverride(model.Conf.System, apiProxy)
	}
	cfg := &Config{
		Provider:    p.Provider,
		APIKey:      p.APIKey,
		APIBaseURL:  p.BaseURL,
		APIProxy:    apiProxy,
		APIModel:    p.Model,
		MaxTokens:   p.MaxTokens,
		Temperature: p.Temperature,
		Timeout:     p.TimeoutMs / 1000,
		UserAgent:   p.UserAgent,
		APIVersion:  p.APIVersion,
	}
	return NewClient(cfg)
}
