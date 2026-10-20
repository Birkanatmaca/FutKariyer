package application

import "sync/atomic"

var versionValue atomic.Value

// SetVersion records the running build for the panel.
func SetVersion(v string) { versionValue.Store(v) }
