# Privacy-redacted historical artifacts

These four files preserve previously recorded results or source snapshots while removing a personally identifying deployment hostname. `redacted-host.invalid` is a deliberate placeholder, **not a tested or usable service endpoint**. Dates, cryptographic identities, transaction observations and other original contents remain unchanged.

Each JSON receipt contains a `privacyRedaction` notice. The historical Markdown and TypeScript files are inert `.source.txt` evidence with a notice prepended. Their old operational instructions describe the original observation; they are not current setup guidance.

[REDACTION_MAP.json](REDACTION_MAP.json) records each original commit/path/hash and corresponding redacted file/hash. It contains no link to the identifying originals. The map was prepared before publication; `publishedRedactionCommit: null` records that capture state. The implementation register's eventual immutable bindings identify the commit where these redacted copies were actually published.

This is a current-source privacy correction. Existing public Git commits, cached pages and copies made by others have not been erased. No new deployment or endpoint test is implied. Use the repository's current MCP setup documentation for current connection instructions.
