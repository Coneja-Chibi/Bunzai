---
id: reference/security/regex-safety
title: ReDoS defense in the regex engine
audience: dev
summary: Bunzai screens regex structure before matching and bounds replacement and trace allocations, while Studio execution adds a terminable worker. Static screening does not guarantee a native match finishes promptly.
tags: [security, regex, redos, validation, ast]
related: [reference/concepts/regex-engine, reference/concepts/regex-editor, reference/entities/regex]
---

# ReDoS defense in the regex engine

Imported patterns are untrusted data. Native JavaScript matching is synchronous: a clock checked
between matches cannot interrupt a match already running. Bunzai combines conservative structural
admission with bounded allocation; Studio regex execution additionally uses a disposable worker.

@fig pipeline

## Structural admission

`core/regex/validate.ts` owns `validateRule` and `vetPattern`. The parser reads patterns as data;
unsupported syntax fails closed rather than falling back to a weaker textual heuristic. Legacy
Annex-B-only spellings must be rewritten using Unicode-compatible syntax. Pattern and replacement
source each cap at 10,000 characters, and capture groups cap at 128.

The shared AST analyzer in `core/regex/ast/redos.ts` checks nested variable repetitions, overlapping
alternatives, repeated backreferences and sequential repetitions that can consume the same text.
Bounded variable repetitions are included. Single-branch groups and nullable separators cannot hide
a sequential seam. Case folding is conservative even when the caller did not request an i flag.
Both suspicious and dangerous reports are refused for execution, with a culprit span and plain error.
Mandatory disjoint separators retain accepted cases such as `a+,a+$` and `(a+b)+$`.

The analyzer's character sets remain approximate. Rejection can be conservative; acceptance is not
proof of linear time. Static analysis cannot establish a complete execution deadline for every native
regex. The numeric complexity score remains explanatory, rather than a substitute for structural admission.

## Runtime and allocation boundaries

`apply.ts` validates the pattern after find-side macro substitution, before matching. An imported
macro value therefore cannot introduce a pattern that escaped the screen. Unknown macro syntax is
refused if it remains structurally unreadable. The editor's pre-context health report may refuse a
macro template that becomes valid after runtime values are supplied.

`core/regex/limits.ts` owns the allocation ceilings. Text construction and retained changed outputs
cap at 1,000,000 UTF-16 code units. Substitution checks projected length before accepting a value;
replacement expansion checks each emitted fragment and its prospective complete result before
concatenation. Case expansion also checks its actual length. A limit error leaves that rule's input
unchanged and stops later rules with an explicit trace. Earlier completed rules remain visible.

Global matching enumerates only the first match when requested, otherwise at most the match cap
plus one. The cap is at most 1,000; supplied nonfinite limits use the default. Capture-span retention
caps at 100,000 across a set. These bounds prevent the demonstrated prefix/suffix amplification and
all-matches materialization paths; they are logical allocation limits, not measured process-memory guarantees.

The worker reuses shared limits: 200,000 characters for a single request, 1,000,000 input characters
across a batch, and 1,000,000 output characters across the batch. It caps rules at 500 and batch items
at 300. The Studio terminates a worker on timeout, cancellation or completion. A prompt pass whose
worker cannot run fails closed. Static Pages refuses previews that cannot supply ADR-009 isolation.

## Evidence and remaining limits

Public-boundary tests reject the demonstrated polynomial pattern `a+a+a+a+a+$`, grouped and bounded
variants, caseless alternatives, unsupported-parser bypasses and unsafe macro-substituted patterns.
Existing safe controls and template examples run through the same engine. Allocation regressions use
small bounded probes; destructive payloads are never run on the host thread.

The Studio worker boundary and source validators have test evidence. This audit does not establish
packaged WebView isolation, browser compatibility or complete regex safety. Direct core callers,
including Kit's draft regex tool and lore/Skill trigger matching, still have no preemptive deadline
inside one native RegExp call. Native-library vulnerabilities are outside the static analyzer's proof.
Rejected patterns are surfaced through rule traces, the editor Health card and the set inspector;
culprit spans exist in the result but this change adds no new highlighting UI.
