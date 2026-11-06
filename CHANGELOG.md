# Changelog

## 2026-11-06

- Show the last matching dashboard immediately and refresh sessions incrementally in the background. Cache aggregated rows and prepared dashboards beside the store; caches are disposable and invalidate on store, implementation, timezone, day or option changes as appropriate.
- Index usage/task ownership by file to avoid scanning the entire history for each session reset. Reuse discovered file metadata and handle same-size transcript edits.
- Add omp, omo and Prime Agent as enabled defaults for new configurations, using the Pi parser with separate source/session identities and support for `reasoningTokens`. Existing source lists are preserved.
- Add an Agent filter, including OpenCode, alongside Provider and Model. Lifetime metrics and the activity heatmap remain unfiltered.
- Read OpenCode's current `session_message` / `session_v2` schema, nested model identifiers and session directories; include separately stored reasoning in output exactly once.
