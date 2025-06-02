# KOReader Meta Updater

A TypeScript CLI tool that allows you to rename your epub files without losing your reading progress and bookmarks. When you rename books in your library, KOReader loses track of the associated metadata stored in `.sdr` directories. This tool automatically reconnects renamed epub files to their KOReader sidecar files using numerical IDs, preserving all your reading progress, annotations, and settings.

## Features

- 🔄 **Automatic Backup**: Creates timestamped backups of your docsettings directory before making changes
- 🔍 **ID-based Matching**: Matches epub files to sidecar directories using numerical IDs like `(261)` 
- 📝 **Metadata Updates**: Updates the `doc_path` property in `metadata.epub.lua` files
- 📁 **Directory Renaming**: Renames `.sdr` directories to match updated epub filenames
- 🛡️ **Safe Operation**: All changes are reversible thanks to automatic backups

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the project:
   ```bash
   bun run build
   ```

## Usage

```bash
bun start -- --epub-dir ./sample/books --docsettings-dir ./sample/docsettings

# With verbose output
bun start -- --epub-dir ./sample/books --docsettings-dir ./sample/docsettings --verbose

# Dry run mode (see what would change without making modifications)
bun start -- --epub-dir ./sample/books --docsettings-dir ./sample/docsettings --dry-run --verbose
```

### Arguments

- `--epub-dir, -e`: Directory containing your epub files
- `--docsettings-dir, -d`: Directory containing KOReader docsettings
- `--verbose, -v`: Enable verbose output (optional)
- `--dry-run`: Show what would be changed without making any modifications (optional)

### Example

```bash
# Normal operation
bun start -- -e "./sample/books" -d "./sample/docsettings" -v

# Dry run to preview changes
bun start -- -e "./sample/books" -d "./sample/docsettings" --dry-run -v
```

## How It Works

1. **Backup Creation**: The tool creates a timestamped backup of your entire docsettings directory in `.backups/`

2. **File Scanning**: 
   - Scans the epub directory for `.epub` files with numerical IDs like `Title (123).epub`
   - Recursively scans the docsettings directory for `.sdr` directories with matching IDs

3. **Matching & Updates**:
   - Matches epub files to sidecar directories using the numerical ID
   - If filenames have changed, renames the `.sdr` directory to match
   - Updates the `doc_path` property in `metadata.epub.lua` to point to the current epub location

## File Structure Example

### Before
```
books/
├── Non-Fiction - Ruffhead, Steven - Writings (261).epub

docsettings/Books/
├── Ruffhead, Steven - Writings (261).sdr/
    └── metadata.epub.lua  # Contains old doc_path
```

### After
```
books/
├── Non-Fiction - Ruffhead, Steven - Writings (261).epub

docsettings/Books/
├── Ruffhead, Steven - Writings (261).sdr/  # Renamed if needed
    └── metadata.epub.lua  # Updated doc_path

.backups/
├── docsettings-backup-2024-01-15T10-30-45-123Z/  # Automatic backup
```

## ID Extraction Logic

The tool extracts numerical IDs from filenames using the pattern `(number)` before the file extension:
- `Book Title (123).epub` → ID: `123`
- `Author Name - Book (456).sdr` → ID: `456`

## Safety Features

- **Automatic Backups**: Every run creates a timestamped backup (skipped in dry-run mode)
- **Error Handling**: Gracefully handles missing files or permission errors
- **Dry-run Mode**: Use `--dry-run` to preview changes without making any modifications
- **Reversible Operations**: All changes can be undone using the backups

## Development

### Building
```bash
bun run build
```

### Project Structure
```
src/
├── index.ts           # CLI entry point
└── koreader-fixer.ts  # Main logic
```

## License

ISC

## Contributing

Feel free to open issues or submit pull requests for improvements! 
