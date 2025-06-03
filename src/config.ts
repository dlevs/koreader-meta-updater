import type { BookMetadata } from "./calibre-sync/types";

// TODO: Import a type for this
export const config = {
  paths: {
    calibreLibrary: "/Users/daniellevett/Calibre Library",
    syncTarget: "/Users/daniellevett/Downloads/Books",
    koreaderSettings: "/Users/daniellevett/Downloads/docsettings",
  },
  files: {
    supportedExtensions: [".epub", ".cbz", ".pdf"],
    backupSdrFiles: true,
  },
  buildFilename(book: BookMetadata): string {
    return [
      genreMappings[book["#genre"]] ?? book["#genre"],
      book.author_sort,
      book.series ? `${book.series} ${book.series_index}` : book.series,
      `${book.title} (${book.id})`,
    ]
      .filter(Boolean)
      .join(" - ");
  },
};

const genreMappings: Record<string, string> = {
  Fiction: "0100 - Fiction",
  Fantasy: "0200 - Fantasy",
  "Science Fiction": "0300 - Science Fiction",
  Mystery: "0400 - Mystery",
  Romance: "0500 - Romance",
  Thriller: "0600 - Thriller",
  "Historical Fiction": "0700 - Historical Fiction",
  "Literary Fiction": "0800 - Literary Fiction",
  "Young Adult": "0900 - Young Adult",
  "Non-Fiction": "1000 - Non-Fiction",
  Biography: "1100 - Biography",
  History: "1200 - History",
  Science: "1300 - Science",
  Technology: "1400 - Technology",
  "Self-Help": "1500 - Self-Help",
  Business: "1600 - Business",
  Reference: "1700 - Reference",
};
