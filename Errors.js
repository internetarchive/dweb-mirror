
errors = {};

// Use this when the code logic has been broken - e.g. something is called with an undefined parameter, its preferable to console.assert
// Typically this is an error, that should have been caught higher up.
class IntentionallyUnimplementedError extends Error {
    constructor(message) {
        super(message || "Intentionally unimplemented");
        this.name = "IntentionallyUnimplementedError"
    }
}
class ToBeImplementedError extends Error {
    constructor(message) {
        super(message || "To be implemented");
        this.name = "ToBeImplementedError"
    }
}

errors.IntentionallyUnimplementedError = IntentionallyUnimplementedError;
