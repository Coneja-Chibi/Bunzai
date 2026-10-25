# Painterly book cover layers

The collection contains 60 semantic transparent PNG ornaments and ten opaque painterly papers.
Each design has a quiet center for a title. The app renders titles as text, allowing edits without
regenerating artwork. Any ornament can be combined with any paper.

`designs/<slug>/layer.png` and `backgrounds/<slug>/layer.png` are the reusable assets. Their adjacent
`asset.json` files carry the labels and categories. Derive the browser catalog with:

```sh
bun scripts/book-cover-catalog.ts
```

The Library's lorebook menu provides **Design book cover**. Choices are per-book Studio preferences;
they do not alter original or exported lorebook content. Existing imported artwork stays the default
when present. Books without artwork receive a stable cover from this collection. **Use original art**
removes the composition and restores the book's original artwork or plain placeholder.

The reference is the approved Library proposal under
[jewel-pages](../../../design/wireframes/premiere-home/jewel-pages/01-library.png).
[Generation instructions](PROMPTS.md) record the shared prompt; each folder retains its specific prompt.

The [interactive collection](../../../design/wireframes/premiere-home/jewel-pages/book-covers.html)
offers the full set with editable title and PNG download links. Local loopback preview is required.
