# Calibre Sync

A TypeScript CLI tool that syncs your Calibre library to a folder with smart filename generation and genre mapping, while preserving KOReader metadata.

> [!Warning]
> This project was vibe coded. If it deletes your library, I take no responsibility. Back stuff up first.

## 🚀 Features

- **📚 Multi-Format Support**: Handles EPUB, CBZ, PDF formats
- **🗂️ Smart Naming**: Generates filenames like `0100 - Fiction - Asimov, Isaac - Foundation 1 - Second Foundation (42)`
- **🔄 KOReader Integration**: Automatically updates .sdr metadata when files are moved/renamed
- **⚡ Incremental Sync**: Only copies files that have changed
- **🧹 Cleanup**: Removes obsolete files from target directory

## Quick Start

1. **Edit the configuration in `src/config.ts`**
2. **Run sync:**
   ```bash
   npm run dev -- sync
   ```

## Configuration

Edit `src/config.ts` to configure your paths and preferences:

```typescript
export const config = {
  paths: {
    calibreLibrary: "/Users/username/Calibre Library",
    syncTarget: "/Users/username/Downloads/Books",
    koreaderSettings: "/Users/username/Downloads/docsettings",
  },

  files: {
    supportedExtensions: [".epub", ".cbz", ".pdf"],
    backupSdrFiles: true,
  },

  buildFilename,
};
```

The `buildFilename` function automatically generates names like:

- `0100 - Fiction - Tolkien, J.R.R. - The Lord of the Rings 1 - The Fellowship of the Ring (123).epub`
- `1000 - Non-Fiction - Hawking, Stephen - A Brief History of Time (456).pdf`

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
├── config.ts                   # Configuration & filename builder
└── calibre-sync/              # Calibre sync functionality
    ├── types.ts               # Type definitions
    ├── calibre-client.ts      # Calibre database interface
    ├── file-operations.ts     # File copy/management
    ├── koreader-manager.ts    # KOReader .sdr handling
    ├── main-sync.ts          # Main sync orchestrator
    └── cli.ts                # CLI interface
```

## License

ISC
