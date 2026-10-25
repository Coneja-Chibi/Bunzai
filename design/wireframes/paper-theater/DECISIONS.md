# Paper theater: decisions and first design pass

2026-10-02. Design-only prototype. The live app is unchanged.

The first visual proposal in this folder was **rejected** as outside
the house style. The replacement atmospheric studies follow the actual Vaudeville
design-system folder: [Vaudeville theater directions](../vaudeville-theater/index.html).
The product decisions below remain recorded; this gallery is not an approved design.

## Immediate authority

The brief asked for a redesign of everything into a cute origami-like paper theater,
then clarified **dark paper**, with a cute puppet-theater entry screen and slightly
gamey paper-adventure title-screen feeling. This supersedes G3 as the immediate
house-design direction. No franchise assets are used.

## Brainstorm decisions recorded

| Item | Decision |
|---|---|
| 1 Chapters and ingest | Approved; needs wireframes. |
| 2 Rigging HUD | Approved. |
| 3 Deterministic replay | Approved. |
| 4 Card time travel | Must include model-driven character editing/growth design. |
| 5 Director's notes | All health functions belong to TrackHare, across content kinds. |
| 6 Choice cards | Approved; needs wireframes. |
| 7 Ledger | Existing related system; deferred. Reconcile before proposing another. |
| 8 Landing | Approved; new theater/movie direction leads the visual redesign. |
| 9 Card rehearsals | Rejected. |
| 10 Archives | Low priority. |
| 11 Scene export | Approved as expected Press behavior. |
| 12 Whole-backup import | Approved as expected import behavior; inspect current gaps. |
| 13 Companion | Existing agent owns this; do not build a second agent. |
| 14 Cost/privacy line | Optional visibility; approved; needs wireframes. |
| 15 Recovery | Repeats number 14. Interpreted as baseline expectation, not a new feature; retain existing recovery. |
| 16 Themes/mods | Approved: visual personalization must be shareable. |
| 17 Expressions | Extension/add-on; approved; needs wireframes. |
| 18 Screen Test | No explicit decision in this reply. Keep unscheduled. |
| 19 Teaching first run | Strongly approved. |
| Branch-aware memory | Baseline contract, not a novelty feature. |
| Chapter/arc summaries | Expected baseline. |
| Additional engineering | All should exist. Reconcile against delivered code before making new tasks. |

These are product/design approvals, not a request to implement every approved feature
ahead of the wireframe pivot. Current work is the design gallery.

## Gallery

Open [index.html](index.html). Dark is the default. The picker navigates 30 studies.
Phone width uses the app container, not viewport breakpoints. The optional daylight
comparison is not the proposed default. Enter on the title screen opens Home.

- Entry: miniature puppet house, folded mascot, curtains, layered scenery, stage apron.
- Home, Library, import, Trash, Scenes and scene page.
- Workbench chassis plus character, lorebook, preset, persona, regex, sprites,
  quick replies and document directions.
- TrackHare all-health, replay, character-growth review, chapters/ingest, choices.
- Press, existing Kit and staged change review.
- Optional cost/privacy, shareable themes/mods, Props/add-ons.
- Setup/teaching, Settings, trusted lock screen, tools, shared parts.

## Coverage and limits

This is a first visual-direction pass, not an exhaustive control/state specification.
Character, lorebook and preset drawings are detailed; secondary editors establish the
shared chassis and name their retained controls. Complete native/platform fields,
individual Settings subpages, all scene-wing contents and specialized dialogs remain
governed by their existing reference/component contracts and prior wireframes.

Ready/empty/loading/error controls demonstrate shared state styling; they are not
screen-specific product copy or final error contracts. Buttons simulate proposals,
never call app routes, never read files, never write the Library, and never send model
requests. All counts and costs are sample data. Actual proof/readiness statements are
not inferred from the mock values.

Original vector cutouts demonstrate paper depth without an asset dependency. Real
character portraits and expression packs must remain usable; the study does not
require converting imported art into this illustrative style.

Colors alias existing live tokens. Production token changes and component adoption
follow approval of the direction. No source/app changes, commits or pushes in this pass.
