# KOReader Meta Updater & Calibre Sync

A TypeScript CLI tool with two main functions:

1. **📚 Calibre → Folder Sync**: Sync your Calibre library to a folder with customizable filename templates and field mappings, while preserving KOReader metadata
2. **🔄 KOReader Meta Updater**: Fix KOReader metadata when epub files are renamed (legacy functionality)

## 🚀 Calibre Sync (New!)

Sync books from your Calibre library to a target folder with intelligent filename formatting and automatic KOReader metadata preservation.

### Features

- **📋 Template-based Naming**: Use customizable templates like `{#genre} - {author_sort} - {series:|| }{series_index:|| - }{title} ({id})`
- **🗂️ Field Mapping**: Map Calibre field values (e.g., map "Fiction" → "0100 - Fiction" for sorting)
- **🔄 KOReader Integration**: Automatically updates .sdr metadata when files are moved/renamed
- **⚡ Incremental Sync**: Only copies files that have changed
- **🧹 Cleanup**: Removes obsolete files from target directory

### Quick Start

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

### Template System

The template system supports:
- **Simple fields**: `{title}`, `{author_sort}`, `{id}`
- **Conditional content**: `{series:|| }` (show series + " " if series exists)
- **Field mapping**: `{#genre}` applies mappings to transform values
- **Series formatting**: `{series:|| }{series_index:|| - }` handles series gracefully

### Field Mapping

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

### CLI Commands

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

---

## 🔧 KOReader Meta Updater (Legacy)

The original functionality for fixing KOReader metadata when epub files are renamed.

### Features

- 🔄 **Automatic Backup**: Creates timestamped backups of your docsettings directory before making changes
- 🔍 **ID-based Matching**: Matches epub files to sidecar directories using numerical IDs like `(261)` 
- 📝 **Metadata Updates**: Updates the `doc_path` property in `metadata.epub.lua` files
- 📁 **Directory Renaming**: Renames `.sdr` directories to match updated epub filenames
- 🛡️ **Safe Operation**: All changes are reversible thanks to automatic backups

### Usage

```bash
npm start -- --epub-dir ./sample/books --docsettings-dir ./sample/docsettings

# With verbose output
npm start -- --epub-dir ./sample/books --docsettings-dir ./sample/docsettings --verbose
```

### Arguments

- `--epub-dir, -e`: Directory containing your epub files
- `--docsettings-dir, -d`: Directory containing KOReader docsettings
- `--verbose, -v`: Enable verbose output (optional)

### How It Works

1. **Backup Creation**: The tool creates a timestamped backup of your entire docsettings directory in `.backups/`

2. **File Scanning**: 
   - Scans the epub directory for `.epub` files with numerical IDs like `Title (123).epub`
   - Recursively scans the docsettings directory for `.sdr` directories with matching IDs

3. **Matching & Updates**:
   - Matches epub files to sidecar directories using the numerical ID
   - If filenames have changed, renames the `.sdr` directory to match
   - Updates the `doc_path` property in `metadata.epub.lua` to point to the current epub location

---

## Requirements

This project uses Node.js's native TypeScript support introduced in Node.js 23.6. 

## Installation

```bash
npm install
npm start -- --help
```


### Project Structure
```
src/
├── index.ts                    # CLI entry point
└── calibre-sync/              # New Calibre sync functionality
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
