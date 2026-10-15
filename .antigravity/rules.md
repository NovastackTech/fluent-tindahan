# Token Optimization & Context Rules
- Before scanning raw files across directories, query the `project-graph` MCP server or inspect `graphify-out/obsidian/` to pinpoint exact call chains and dependencies.
- Never spawn recursive research subagents or ingest entire directories if target files can be resolved via the dependency graph.
- Load only the specific source files identified as relevant to the task.
- Consult architectural notes or decision records in `docs/` or `graphify-out/obsidian/` before proposing structural refactors.
