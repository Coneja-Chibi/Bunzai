# Teaching fixtures

Three deliberately boring SillyTavern presets. They exist so a reader, or Kit, can see what each kind
of prompt block looks like without wading through a 300-block community preset.

All original neutral prose. Nothing here is derived from anyone else's preset.

| Fixture | Shows |
| --- | --- |
| `minimal.preset.json` | The smallest honest preset: a couple of system blocks, the engine's marker slots, chat history. The baseline everything else is compared against. |
| `tracker.preset.json` | A status readout assembled from variables: `setvar` writes, a `getvar` manifest, and where such a block sits in the order. |
| `utility.preset.json` | Output length, language and formatting dials, plus a toggle gate that enables or disables a block. |

Each renders clean through the real engine. That is checkable rather than asserted:

```
preset_verify engine=sillytavern preset=samples/sillytavern/fixtures/minimal.preset.json
```

A fixture that stops resolving is a broken fixture, so keep them clean.

## Why these three

The examples cover direct prompt text, variable writes and reads, and optional settings. They are
small teaching cases, not evidence of how often those patterns occur in community presets.
