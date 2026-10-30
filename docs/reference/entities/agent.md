---
id: reference/entities/agent
title: Agent entity
audience: dev
summary: A reusable Library Agent owns instructions, optional model settings and links to Tools and Skills.
tags: [entity, agent, canonical]
related: [reference/entities/promptbook, reference/entities/skill, reference/entities/tool]
---

# Agent entity

`src/entities/agent/` owns the canonical Agent body: name, description, instructions, optional model,
temperature and history-message count, plus Tool and Skill reference IDs. The Workbench editor uses
the existing revision-checked piece session. Native Bunzai JSON preserves this body and its IDs;
linked pieces must travel separately. Credentials and executable scripts are not Agent fields.

A Promptbook phase selects one Library Agent. Its instructions join the phase's preset blocks;
its Tools and Skills use the existing scene runtime and permission gates. A phase's explicit model
selection takes precedence over the Agent model, which takes precedence over the scene connection.
Zero history messages means no stored history; the current message remains available.

Final Cut's saved-agent list uses the same canonical pieces through `src/studio/agent-library.ts`.
Legacy active records migrate by exact identity only after a complete escrow comparison verifies
the preserved original. A collision leaves the source untouched. Bank records and deleted legacy
tombstones stay in their existing document. Saves require the expected revision, and deletes check
that revision inside the storage mutation. A stale editor cannot overwrite or delete newer work.

Final Cut currently loads Agent instructions and model settings into its pass as a template. Its
pass retains its own preset; it does not execute the Agent's linked Tools and Skills. Director seats
also have no new Agent integration. Migration and revision safety have isolated memory/SQLite test
evidence; live UI and packaged execution remain unverified in this change.
