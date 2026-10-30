# SillyTavern sampler sets, system prompts and templates

Settings are copied from files in a SillyTavern `data/default-user` folder (stock content shipped
with SillyTavern, AGPL-3.0), collected 2026-10-05. The three prompt-bearing files named below are
constructed synthetic fixtures: their original free prose and Severian name were replaced. Do not
describe those files as verbatim upstream copies. Other fixture values and format settings retain
their source values unless listed as transformed below.

License: AGPL-3.0 (SillyTavern project, https://github.com/SillyTavern/SillyTavern) for every file below.
Source: https://github.com/SillyTavern/SillyTavern (`default/content`). Two are shortened and marked `[truncated for the fixture]`.

| fixture | source file |
| --- | --- |
| kobold-deterministic.json | KoboldAI Settings/Deterministic.json |
| textgen-simple-1.json | TextGen Settings/Simple-1.json |
| textgen-chatml-with-prompt.json | TextGen Settings/Chatml-with-prompt.json (settings scaffold; embedded prompt replaced with synthetic text) |
| novelai-asper-kayra.json | NovelAI Settings/Asper-Kayra.json |
| novelai-erato-wilder.json | NovelAI Settings/Erato-Wilder.json |
| sysprompt-actor.json, sysprompt-blank.json | sysprompt/Actor.json (prompt replaced), sysprompt/Blank.json |
| sysprompt-severian-no-post-history.json | sysprompt/Severian's prompt 2.json (name and prompt replaced) |
| instruct-chatml-names.json | instruct/ChatML-Names.json |
| context-llama-3-instruct.json | context/Llama 3 Instruct.json |
| reasoning-deepseek.json | reasoning/DeepSeek.json |

The source project and AGPL-3.0 license are credited for the structural settings. The replacement
prompt prose in `sysprompt-actor.json`, `sysprompt-severian-no-post-history.json`, and the embedded
`sysprompt` in `textgen-chatml-with-prompt.json` was written for Bunzai tests. Those fixtures retain
the ST field structure and are not representative copies of upstream prompt content.

The instruct, context and reasoning files are refusal fixtures: Bunzai has no home for them yet.
