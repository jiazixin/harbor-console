package app

// String prevents request credentials from leaking through formatting or logs.
func (r connectRequest) String() string { return "connectRequest{credentials:[redacted]}" }

// GoString also redacts Go-syntax formatting used in diagnostics.
func (r connectRequest) GoString() string { return r.String() }

// String hides the session token and upstream credentials.
func (s session) String() string { return "session{credentials:[redacted]}" }

// GoString also redacts Go-syntax formatting used in diagnostics.
func (s session) GoString() string { return s.String() }

// String hides upstream credentials and the connection identifier.
func (c harborConnection) String() string { return "harborConnection{credentials:[redacted]}" }

// GoString also redacts Go-syntax formatting used in diagnostics.
func (c harborConnection) GoString() string { return c.String() }
