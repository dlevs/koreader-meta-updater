# Calibre Sync

A TypeScript CLI tool that syncs your Calibre library to a folder with customizable filename templates and field mappings, while preserving KOReader metadata.

> [!Warning]
> This project was vibe coded. If it deletes your library, I take no responsibility. Back stuff up first.

## 🚀 Features

- **📋 Template-based Naming**: Use customizable templates like `{#genre} - {author_sort} - {series:|| }{series_index:|| - }{title} ({id})`
- **🗂️ Field Mapping**: Map Calibre field values (e.g., map "Fiction" → "0100 - Fiction" for sorting)
- **🔄 KOReader Integration**: Automatically updates .sdr metadata when files are moved/renamed
- **⚡ Incremental Sync**: Only copies files that have changed
- **🧹 Cleanup**: Removes obsolete files from target directory

## Quick Start

1. **Generate a config file:**
   ```bash
   npm run dev -- config -o my-sync-config.json
   ```

2. **Edit the config to match your setup:**
   ```json
   {
     "calibreLibraryPath": "/path/to/calibre/library",
     "syncTargetPath": "/path/to/sync/folder",
     "koreaderPath": "/path/to/koreader/docsettings",
     "template": "{#genre} - {author_sort} - {series:|| }{series_index:|| - }{title} ({id})",
     "fieldMappings": {
       "#genre": {
         "Fiction": "0100 - Fiction",
         "Fantasy": "0200 - Fantasy"
       }
     }
   }
   ```

3. **Run sync:**
   ```bash
   npm run dev -- sync --config my-sync-config.json
   ```

## Template System

The template system supports:
- **Simple fields**: `{title}`, `{author_sort}`, `{id}`
- **Conditional content**: `{series:|| }` (show series + " " if series exists)
- **Field mapping**: `{#genre}` applies mappings to transform values
- **Series formatting**: `{series:|| }{series_index:|| - }` handles series gracefully

## Field Mapping

Transform Calibre field values before using them in filenames:

```json
{
  "fieldMappings": {
    "#genre": {
      "Fiction": "0100 - Fiction",
      "Science Fiction": "0300 - Science Fiction"
    },
    "#rating": {
      "5": "⭐⭐⭐⭐⭐",
      "4": "⭐⭐⭐⭐"
    }
  }
}
```

## CLI Commands

```bash
# Sync books
npm run dev -- sync [options]

# Generate config file  
npm run dev -- config [options]

# Options for sync:
#   -c, --config <path>           Config file path (default: config/sync-config.json)
#   --calibre-library <path>      Override Calibre library path
#   --sync-target <path>          Override sync target path
#   --koreader-path <path>        Override KOReader path
```

## Requirements

This project uses Node.js's native TypeScript support introduced in Node.js 23.6. 

## Installation

```bash
npm install
npm start -- --help
```

## Project Structure
```
src/
├── index.ts                    # CLI entry point
└── calibre-sync/              # Calibre sync functionality
    ├── types.ts               # Type definitions
    ├── calibre-reader.ts      # Calibre database interface
    ├── template-engine.ts     # Filename template system
    ├── file-operations.ts     # File copy/management
    ├── koreader-manager.ts    # KOReader .sdr handling
    ├── main-sync.ts          # Main sync orchestrator
    └── cli.ts                # CLI interface
```

## Examples

### Example 1: Basic Fiction Library
```json
{
  "template": "{#genre} - {author_sort} - {title} ({id})",
  "fieldMappings": {
    "#genre": {
      "Fiction": "01-Fiction",
      "Non-Fiction": "02-NonFiction"
    }
  }
}
```
Result: `01-Fiction - Asimov, Isaac - Foundation (42).epub`

### Example 2: Series-Aware Organization  
```json
{
  "template": "{author_sort} - {series:|| }{series_index:|| - }{title} ({id})"
}
```
Results:
- `Tolkien, J.R.R. - The Lord of the Rings 1 - The Fellowship of the Ring (123).epub`
- `King, Stephen - The Stand (456).epub` (no series)

## License

ISC
