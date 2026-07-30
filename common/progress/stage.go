package progress

import (
	"fmt"
	"time"
)

// stage shows how long a step of unknown size has been running, such as a
// single long-running SQL statement. Such a step prints nothing until it
// returns, which reads as a hang.
type stage struct {
	line      line
	name      string
	startTime time.Time
}

// startStage puts an elapsed-time line for name on screen. complete removes it.
func startStage(name string) *stage {
	termMu.Lock()
	defer termMu.Unlock()

	s := &stage{name: name, startTime: time.Now()}
	s.line.start(s.render)
	return s
}

// complete takes the stage line off the screen.
func (s *stage) complete() {
	termMu.Lock()
	defer termMu.Unlock()

	s.line.remove()
}

// render builds the stage line. Must be called with termMu held.
func (s *stage) render() string {
	// Truncated so the count starts at 0s and steps by whole seconds.
	return fmt.Sprintf("%s... %s", s.name, formatDuration(time.Since(s.startTime).Truncate(time.Second)))
}
