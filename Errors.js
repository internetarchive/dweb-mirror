
errors = {};

// Use this when the code logic has been broken - e.g. something is called with an undefined parameter, its preferable to console.assert
// Typically this is an error, that should have been caught higher up.
class IntentionallyUnimplementedError extends Error {
    constructor(message) {
        super(message || "Intentionally unimplemented");
        this.name = "IntentionallyUnimplementedError"
    }
}
errors.IntentionallyUnimplementedError = IntentionallyUnimplementedError;

class ToBeImplementedError extends Error {
    constructor(message) {
        super(message || "To be implemented");
        this.name = "ToBeImplementedError"
    }
}
errors.ToBeImplementedError = ToBeImplementedError;

class MissingDirectoryError extends Error {
    constructor(message) {
        super(message || "Directory is missing");
        this.name = "MissingDirectoryError"
    }
}
errors.MissingDirectoryError = MissingDirectoryError;

class NoLocalCopy extends Error {
    constructor(message) {
        super(message || "No local copy");
        this.name = "NoLocalCopy"
    }
}
errors.NoLocalCopy = NoLocalCopy;

class FileNotFoundError extends Error {
    constructor(message) {
        super(message || "File not found");
        this.name = "FileNotFound"
    }
}
errors.FileNotFoundError = FileNotFoundError;
exports = module.exports = errors;