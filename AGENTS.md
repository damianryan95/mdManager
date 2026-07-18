# Project Operating Guidance — Token Reduction First

## Purpose

This document defines how AI assistants, coding agents, and human operators should work inside this project while keeping token usage low, avoiding unnecessary context loading, and reducing wasted analysis time.

The core principle is simple:

> Inspect the smallest useful context, make the smallest safe change, and summarise before expanding scope.

This guidance is intended for use with Codex Desktop, Codex, Codex, GitHub Copilot agents, or any AI-assisted development workflow.

---

## 1. Default Working Mode

Always operate in **minimal-context mode** unless explicitly told otherwise.

Before reading files or proposing changes, the assistant should:

1. Identify the specific task or defect.
2. Determine the smallest set of files likely to be relevant.
3. Read only those files first.
4. Avoid broad repository scans.
5. Summarise findings before expanding scope.

Do not assume that more context is better. In this project, broad context usually increases cost, slows the workflow, and introduces irrelevant reasoning.

---

## 2. Repository Access Rules

### Read only what is needed

For each task, prefer exact file paths. If the user provides a file path, start there.

Good examples:

```text
Inspect only:
- edge/packages/professional_services_drivers/energy_meters/satec_pm175/init.lua
- edge/packages/professional_services_drivers/energy_meters/satec_pm175/metadata.json
```

Avoid vague instructions such as:

```text
Review the whole repo.
Look through the project.
Check everything related to this.
```

If broader inspection is needed, the assistant must first explain why and list the specific folders or files it intends to inspect.

---

## 3. Do Not Read These Folders

The following folders should be treated as **off-limits by default** because they are large, generated, duplicated, or low-value for reasoning:

```gitignore
node_modules/
.git/
dist/
build/
coverage/
.cache/
.expo/
.next/
out/
tmp/
temp/
logs/
.DS_Store
```

The assistant should not read, index, search, summarise, or reason over these folders unless the user explicitly requests it and there is a clear technical reason.

---

## 4. Do Not Read These Files by Default

Avoid opening or loading the following unless directly relevant:

```gitignore
*.log
*.lock
package-lock.json
yarn.lock
pnpm-lock.yaml
*.min.js
*.map
*.bundle.js
*.zip
*.tar
*.gz
*.7z
*.pdf
*.png
*.jpg
*.jpeg
*.mp4
*.mov
```

For lock files, generated files, images, PDFs, and binaries, first ask whether they are genuinely required for the current task. If they are needed, inspect only the relevant section or metadata where possible.

---

## 5. Preferred Search Behaviour

When searching, use targeted terms based on the actual problem.

Good examples:

```text
Search for: detectRepeatedAssetsFromPayload
Search for: satec_pm175
Search for: programTemplateUri
Search for: requiredTraits
Search for: launch-discovery-builder
```

Avoid broad searches such as:

```text
Search for: error
Search for: config
Search for: device
Search for: metadata
```

If a broad search returns many results, stop and refine the query rather than loading all results.

---

## 6. File Reading Strategy

Use this order when investigating issues:

1. Read the exact file mentioned by the user.
2. Read directly imported or referenced files only if required.
3. Read metadata/config files in the same package or module.
4. Search for exact symbols or function names.
5. Expand to neighbouring files only if the first pass is insufficient.

Do not start by reading an entire directory tree.

---

## 7. Coding Agent Behaviour

When acting as a coding agent, follow this workflow:

### Step 1 — Scope

State the minimum intended scope.

Example:

```text
I will inspect only the Satec PM175 driver files first, then expand only if the conflict depends on shared driver conventions.
```

### Step 2 — Inspect

Read the smallest useful file set.

### Step 3 — Diagnose

Explain the issue in plain language.

### Step 4 — Patch

Make the smallest safe change.

### Step 5 — Validate

Run only the most relevant checks.

Examples:

```bash
lua -p init.lua
npm test -- --runInBand specific-test-name
git diff -- path/to/file
```

Avoid running full test suites unless needed.

### Step 6 — Summarise

Provide a concise summary of:

- Files changed
- Why they changed
- Validation performed
- Remaining risks or follow-up actions

---

## 8. Git Conflict Handling

For merge conflicts, do not inspect unrelated files.

Use this sequence:

```bash
git status --short
git diff --name-only --diff-filter=U
```

Then inspect only conflicted files.

For each conflicted file:

1. Locate conflict markers.
2. Compare both sides.
3. Preserve the correct implementation.
4. Remove conflict markers.
5. Validate syntax where possible.
6. Stage only resolved files.

Avoid using `git add .` in large repositories because it may stage unwanted files or fail on generated folders such as `node_modules`.

Prefer:

```bash
git add path/to/resolved-file.lua
git add path/to/resolved-metadata.json
```

---

## 9. Avoid Loading `node_modules`

`node_modules` must never be included in AI context.

It is large, noisy, generated, and rarely useful. If a dependency issue is suspected, inspect only:

```text
package.json
relevant import statement
relevant error message
```

Do not inspect package source code unless there is a very specific reason.

If Git attempts to index files inside `node_modules`, confirm that `node_modules/` is present in `.gitignore` and remove it from tracking if required.

---

## 10. Recommended `.gitignore` Entries

The project should include ignore rules similar to the following:

```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/
out/
.next/
coverage/

# Caches
.cache/
.expo/
.tmp/
tmp/
temp/

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS / editor noise
.DS_Store
Thumbs.db
.vscode/.history/

# Environment files
.env
.env.local
.env.*.local
```

---

## 11. Codex Desktop / MCP Guidance

When using Codex Desktop with MCP servers, keep active tools to a minimum.

### Recommended default

Enable only the MCP server required for the current task.

For local code work, this usually means:

```text
filesystem only
```

### Disable unless actively needed

```text
GitHub
Google Drive
Slack
Notion
Browser
Database tools
Memory tools
```

Each active MCP server can add tool definitions, resource lists, or extra context. This can increase token usage even before the visible task begins.

---

## 12. Filesystem MCP Scope

Do not point filesystem MCP at a broad parent directory such as:

```text
C:\Users\<user>\Documents\Development
```

Prefer the smallest working folder:

```text
C:\Users\<user>\Documents\Development\HarkEdgeController\edge\packages\professional_services_drivers\energy_meters\satec_pm175
```

For UI work, point only at the UI package being changed.

For driver work, point only at the driver package unless shared framework files are required.

---

## 13. Prompt Template for Low-Token Operation

Use this at the start of project chats:

```text
Operate in minimal-context mode.
Do not read the whole repository.
Only inspect files directly relevant to the task.
Do not read node_modules, .git, build outputs, dist folders, logs, lock files, generated files, or unrelated packages.
Before expanding scope, explain why and list the exact files or folders you need.
Make the smallest safe change and summarise the files changed, validation performed, and any remaining risks.
```

For coding agents:

```text
You are working in a large repository. Token reduction is a priority.
Start from the exact files or symbols provided.
Use targeted search only.
Avoid broad scans.
Do not open generated or dependency folders.
Patch only the minimum required files.
Run only focused validation commands.
Return a concise change summary and suggested next command.
```

---

## 14. Handover Summaries

At the end of any long task, create a compact handover summary so the next chat can start fresh without carrying the full conversation.

Use this format:

```text
Task:
Files inspected:
Files changed:
Key decisions:
Validation performed:
Open risks:
Recommended next step:
```

Keep handover summaries under 500 words unless the task is unusually complex.

---

## 15. When to Expand Context

Context may be expanded only when one of the following is true:

- The current file references a missing function or shared module.
- A test failure points to another file.
- The user explicitly asks for a wider review.
- The issue cannot be explained from the current file set.
- A change would be unsafe without checking shared conventions.

Before expanding, state:

```text
I need to inspect one additional file because...
```

Then inspect only that file or a tightly scoped set of files.

---

## 16. Validation Strategy

Prefer cheap, focused validation before expensive checks.

Examples:

```bash
# Git status only
git status --short

# View only relevant diff
git diff -- path/to/file

# Lua syntax check
lua -p path/to/init.lua

# TypeScript targeted check
npx tsc --noEmit

# Run a specific test
npm test -- specific-test-name
```

Avoid full builds, full test suites, or full linting unless the task requires them.

---

## 17. Output Style

Responses should be concise and operational.

Preferred structure:

```text
Summary
Files touched
What changed
Validation
Next command
```

Avoid long explanations unless the user asks for detail.

---

## 18. Anti-Patterns to Avoid

Do not:

- Read the whole repository by default.
- Search every file for generic terms.
- Load `node_modules`.
- Use `git add .` in large or messy working trees.
- Paste huge logs into the model.
- Continue long chats indefinitely.
- Keep unused MCP servers enabled.
- Ask the model to review broad folders without a clear target.
- Run full builds before performing targeted checks.
- Summarise large generated files.

---

## 19. Recommended Operator Habits

For each task, provide:

```text
Objective:
Relevant file(s):
Error message:
What changed recently:
What output is needed:
```

Example:

```text
Objective: Fix the merge conflict in the Satec PM175 driver.
Relevant files:
- edge/packages/professional_services_drivers/energy_meters/satec_pm175/init.lua
- edge/packages/professional_services_drivers/energy_meters/satec_pm175/metadata.json
Error: add/add merge conflict.
Output needed: resolved files and exact git commands to finish the merge.
```

This reduces unnecessary discovery and keeps the assistant focused.

---

## 20. Golden Rule

When in doubt, reduce scope first.

The assistant should always prefer:

```text
one task
one file set
one focused change
one concise summary
```

Over:

```text
broad repo scan
large context load
multi-topic investigation
unclear patch scope
```