# Card rich-text cleanup

Standalone Node.js utility for migrating `archetype_card` description columns from text to Tiptap JSONB and cleaning imported content.

It converts `**bold text**` to Tiptap bold marks, and turns numbered points into proper continuous ordered lists.

## Run it

```bash
npm install
cp .env.example .env
# add your DATABASE_URL to .env
npm run preview
npm run apply
```

`preview` makes no changes. `apply` runs the schema migration and writes cleaned records in one database transaction.
