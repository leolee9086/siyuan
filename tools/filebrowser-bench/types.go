package main

import (
	"context"
	"time"
)

type snapshot struct {
	Entries     uint64 `json:"entries"`
	Files       uint64 `json:"files"`
	Directories uint64 `json:"directories"`
	Errors      uint64 `json:"errors"`
	ErrorsKnown bool   `json:"errorsKnown"`
	Digest      string `json:"digest,omitempty"`
}

type measurement struct {
	ElapsedNanoseconds int64    `json:"elapsedNanoseconds"`
	AllocatedBytes     uint64   `json:"allocatedBytes,omitempty"`
	AllocationKnown    bool     `json:"allocationKnown"`
	HeapDeltaBytes     int64    `json:"heapDeltaBytes"`
	Snapshot           snapshot `json:"snapshot"`
}

type implementationReport struct {
	Name            string        `json:"name"`
	Version         string        `json:"version"`
	Validation      measurement   `json:"validation"`
	Samples         []measurement `json:"samples"`
	Error           string        `json:"error,omitempty"`
	PathSetMatches  *bool         `json:"pathSetMatchesTarget,omitempty"`
	TypeCountsMatch *bool         `json:"typeCountsMatchTarget,omitempty"`
	ErrorCountMatch *bool         `json:"knownErrorCountMatchesTarget,omitempty"`
	Stable          *bool         `json:"samplesStable,omitempty"`
}

type fixtureConfig struct {
	Shape    string `json:"shape"`
	Parents  int    `json:"parents,omitempty"`
	Branches int    `json:"branches,omitempty"`
	Files    int    `json:"files,omitempty"`
	Count    int    `json:"count,omitempty"`
	Depth    int    `json:"depth,omitempty"`
}

type benchmarkReport struct {
	CreatedAt        time.Time              `json:"createdAt"`
	Root             string                 `json:"root"`
	Fixture          bool                   `json:"fixture"`
	FixtureConfig    *fixtureConfig         `json:"fixtureConfig,omitempty"`
	Expected         *snapshot              `json:"expected,omitempty"`
	ComparisonTarget string                 `json:"comparisonTarget,omitempty"`
	Warmups          int                    `json:"warmups"`
	Iterations       int                    `json:"iterations"`
	Reports          []implementationReport `json:"reports"`
}

type walkImplementation struct {
	Name    string
	Version string
	Run     func(context.Context, string, bool) (snapshot, error)
}
