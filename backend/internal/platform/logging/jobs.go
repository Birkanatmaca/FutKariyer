package logging

import (
	"context"
	"log/slog"
	"runtime/debug"
	"time"
)

// Go runs a long-lived background job and keeps it alive: a panic is logged
// with its stack and the job starts again after a pause, instead of taking
// the whole API down.
func Go(ctx context.Context, name string, run func(context.Context)) {
	go func() {
		for {
			if !once(ctx, name, run) || ctx.Err() != nil {
				return
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(10 * time.Second):
			}
		}
	}()
}

// once runs the job; true means it panicked and should be restarted.
func once(ctx context.Context, name string, run func(context.Context)) (panicked bool) {
	defer func() {
		if recovered := recover(); recovered != nil {
			slog.ErrorContext(ctx, EventJobPanic, "job", name, "panic", panicText(recovered), "stack", string(debug.Stack()))
			panicked = true
		}
	}()
	run(ctx)
	return false
}
