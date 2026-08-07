package main

import (
	"context"
	"runtime"
	"time"
)

func runGoReport(ctx context.Context, implementation walkImplementation, root string,
	warmups, iterations int) implementationReport {
	report := implementationReport{Name: implementation.Name, Version: implementation.Version}
	validation, err := measureGo(ctx, implementation, root, true)
	report.Validation = validation
	if err != nil {
		report.Error = err.Error()
		return report
	}
	for index := 0; index < warmups; index++ {
		if _, err = implementation.Run(ctx, root, false); err != nil {
			report.Error = err.Error()
			return report
		}
	}
	report.Samples = make([]measurement, 0, iterations)
	for index := 0; index < iterations; index++ {
		value, runErr := measureGo(ctx, implementation, root, false)
		if runErr != nil {
			report.Error = runErr.Error()
			return report
		}
		report.Samples = append(report.Samples, value)
	}
	return report
}

func measureGo(ctx context.Context, implementation walkImplementation, root string,
	digest bool) (measurement, error) {
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	started := time.Now()
	result, err := implementation.Run(ctx, root, digest)
	elapsed := time.Since(started)
	runtime.ReadMemStats(&after)
	return measurement{
		ElapsedNanoseconds: elapsed.Nanoseconds(), AllocatedBytes: after.TotalAlloc - before.TotalAlloc,
		AllocationKnown: true, HeapDeltaBytes: int64(after.HeapAlloc) - int64(before.HeapAlloc), Snapshot: result,
	}, err
}
