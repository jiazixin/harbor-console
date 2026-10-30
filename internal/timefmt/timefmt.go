// Package timefmt defines the UTC millisecond timestamp used by console contracts.
package timefmt

import (
	"fmt"
	"time"
)

// Layout is RFC 3339 with exactly three fractional digits and a UTC suffix.
const Layout = "2006-01-02T15:04:05.000Z"

// Time keeps wire timestamps independent of the machine's timezone.
type Time time.Time

// MarshalText returns a UTC timestamp with fixed millisecond precision.
func (t Time) MarshalText() ([]byte, error) { return []byte(Format(time.Time(t))), nil }

// UnmarshalText accepts only the console's canonical UTC millisecond format.
func (t *Time) UnmarshalText(text []byte) error {
	value, err := time.Parse(Layout, string(text))
	if err != nil {
		return fmt.Errorf("parse timestamp: %w", err)
	}
	if Format(value) != string(text) {
		return fmt.Errorf("parse timestamp %q: noncanonical format", text)
	}
	*t = Time(value)
	return nil
}

// Format converts a time to the wire representation without changing its instant.
func Format(value time.Time) string { return value.UTC().Format(Layout) }
