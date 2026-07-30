package progress

import (
	"fmt"
	"os"
	"sync"
	"time"
)

// eraseLine puts the cursor back at column 0 and clears the row. Every display
// in this package is gated on ShouldShowProgress, which is what keeps the escape
// away from anything that would not interpret it.
const eraseLine = "\r\x1b[K"

var (
	// termMu serializes every stderr write made by this package and guards the
	// state of the line currently on screen. Code holding it must not log: a
	// log record goes through Stderr, which takes termMu itself.
	termMu sync.Mutex
	// active is the line drawn on screen, if any.
	active *line
)

// line is a single self-updating stderr line, refreshed once a second from a
// render function. Only one line is on screen at a time.
type line struct {
	content string
	stop    chan struct{} // signals the refresh goroutine to stop
	done    chan struct{} // signals the refresh goroutine has stopped
}

// start draws the line and keeps refreshing it until stopRefresh.
// render is called with termMu held. Must be called with termMu held.
func (l *line) start(render func() string) {
	// A restart would otherwise strand the running refresh goroutine: it holds
	// the only reference to the channel that stops it.
	l.stopRefresh()

	active = l
	l.update(render())

	// Capture channels for the goroutine to avoid a race with stopRefresh
	// setting them to nil.
	l.stop = make(chan struct{})
	l.done = make(chan struct{})
	stop, done := l.stop, l.done
	go l.refreshLoop(render, stop, done)
}

func (l *line) refreshLoop(render func() string, stop, done chan struct{}) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	defer close(done)

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			termMu.Lock()
			l.update(render())
			termMu.Unlock()
		}
	}
}

// stopRefresh waits for the refresh goroutine to exit. Must be called with
// termMu held. Temporarily releases the lock to avoid deadlock.
func (l *line) stopRefresh() {
	if l.stop == nil {
		return
	}
	stop, done := l.stop, l.done
	l.stop = nil
	l.done = nil

	termMu.Unlock()
	close(stop)
	<-done
	termMu.Lock()
}

// remove erases the line and stops updating it.
// Must be called with termMu held.
func (l *line) remove() {
	l.stopRefresh()
	l.write(eraseLine)
	l.detach()
}

// complete leaves final on screen as a row of its own and stops updating it.
// Must be called with termMu held.
func (l *line) complete(final string) {
	l.stopRefresh()
	l.update(final)
	l.write("\n")
	l.detach()
}

// detach releases the row this line holds. Must be called with termMu held.
func (l *line) detach() {
	l.content = ""
	if active == l {
		active = nil
	}
}

// update replaces the on-screen content. Must be called with termMu held.
func (l *line) update(content string) {
	l.content = content
	l.write(l.text())
}

// write puts s on the terminal, but only while this line still holds the row:
// once another line has taken it, that row is no longer this one's to paint.
// Must be called with termMu held.
func (l *line) write(s string) {
	if active != l {
		return
	}
	fmt.Fprint(os.Stderr, s)
}

// text is the line as it appears on screen: a cleared row holding the content.
// Must be called with termMu held.
func (l *line) text() string {
	return eraseLine + l.content
}
