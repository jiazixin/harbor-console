package timefmt

import (
	"encoding/json/v2"
	"testing"
	"time"
)

func TestCanonicalUTC(t *testing.T) {
	t.Parallel()
	value := Time(time.Date(2026, 10, 31, 8, 9, 10, 123456789, time.FixedZone("test", 8*60*60)))
	got, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	const want = `"2026-10-31T00:09:10.123Z"`
	if string(got) != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	var decoded Time
	if err := json.Unmarshal(got, &decoded); err != nil {
		t.Fatal(err)
	}
	if Format(time.Time(decoded)) != "2026-10-31T00:09:10.123Z" {
		t.Fatalf("got %s, want canonical UTC", got)
	}
}

func FuzzTimeRoundTrip(f *testing.F) {
	f.Fuzz(func(t *testing.T, text string) {
		var value Time
		if err := value.UnmarshalText([]byte(text)); err != nil {
			return
		}
		actual, err := value.MarshalText()
		if err != nil || string(actual) != text {
			t.Fatalf("got %q, %v, want %q", actual, err, text)
		}
	})
}
