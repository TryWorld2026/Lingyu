# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Before any uncertain operation:
- If an operation could be risky, ambiguous, or has unclear impact, pause and ask the user before proceeding.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Agent Prompt Sync (Global Rule)

Lingyu 有两套并存的对外提示词入口，互不替代，改动时必须分清自己在改哪个客户端：

| 入口 | 覆盖范围 |
| --- | --- |
| `src/main/ai/systemPrompt.ts` | 旧版 Electron 客户端（v0.4.x）的能力描述 |
| `native/Lingyu.Core/NativePrompt.cs` | 原生 C#/WPF 预览版（`1.0.0-preview.x`）的能力描述 |

提示词全部在本仓库维护，不依赖独立上游账号服务或远端在线提示词。

**When feature scope changes, agent prompts must be updated in the same task.**

- If you add/remove/change any user-facing Lingyu feature, sync the capability description of the client that owns it; a feature added to the native preview must not be claimed in the legacy prompt, and vice versa.
- Treat prompt sync as part of Definition of Done; do not mark the task complete if prompts are stale.
- Verify at minimum: the affected prompt builder mentions the new capability consistently with the shipped UI, and untouched clients still describe their own scope accurately.
- Any change to `native/` that alters what the preview can do must also update `native/Lingyu.Core/NativePrompt.cs` in the same change.
- Version declarations that describe the native preview (`README.md`, `README.zh-CN.md`, `native/README.md`, `NativePrompt.cs`) must match `<Version>` in `native/Directory.Build.props`; `python native/scripts/check-prompt-version.py` enforces this.
- If uncertain which prompts are affected, explicitly ask and confirm before finishing.

## 6. i18n Completeness (UI Change Gate)

**Every user-facing string must have translations. No exceptions.**

After any UI change (new component, new text, modified labels, new feedback messages):
1. Scan all `t('...')` calls in changed files for translation keys.
2. Check both `i18n/zh-CN.json` and `i18n/en-US.json` — every key must exist in both.
3. If a key is missing, add it to both files before marking the task done.
4. Hard-coded Chinese/English strings in UI code are forbidden — wrap them in `t()`.

Verification: `grep -rn "defaultValue" src/renderer/components/<changed-dir>/` should show `t()` wrappers, not raw strings.

## 7. Comment Standards (Code Change Gate)

**All code must comply with [`docs/COMMENT_STANDARDS.md`](docs/COMMENT_STANDARDS.md). No exceptions.**

## 8. Frontend Standards (Code Change Gate)

**All frontend code must comply with [`docs/FRONTEND_STANDARDS.md`](docs/FRONTEND_STANDARDS.md). No exceptions.**

## 9. Plugin Version Bump (Plugin Change Gate)

**Any change that will be published from `plugins/<name>/` requires a version bump in its `package.json`.**

- After modifying files under `plugins/<name>/`, check whether the change alters what `npm publish` ships: `files` in that plugin's `package.json` lists the published paths, and `test/` and lock files are not among them.
- If the published content changes, the version must be incremented; if only `test/`, `package-lock.json` or build-time-only fields change, state that reason explicitly in the commit instead of bumping.
- Follow semver: patch for bug fixes, minor for new features, major for breaking changes.
- The `publish-plugins.yml` workflow skips publish when the version is unchanged — forgetting the bump means the change never ships.

**Creating a new plugin requires registering it in `.github/workflows/publish-plugins.yml`.**

- Add the plugin name to both `publish-npm` and `publish-gpr` job matrices.
- Without registration, the new plugin will never be published to npm or GitHub Packages.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
