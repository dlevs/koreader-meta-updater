export interface BookMetadata {
  id: number;
  title: string;
  author_sort: string;
  authors?: string;
  series?: string;
  series_index?: number;
  [key: string]: any;
}

const genreMappings = {
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

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFilename(book: BookMetadata): string {
  const parts: string[] = [];

  // Add mapped genre
  if (book["#genre"]) {
    const mappedGenre =
      genreMappings[book["#genre"] as keyof typeof genreMappings];
    parts.push(mappedGenre ?? book["#genre"]);
  }

  // Add author
  if (book.author_sort) {
    parts.push(book.author_sort);
  }

  // Add series info
  if (book.series) {
    const seriesPart = book.series_index
      ? `${book.series} ${book.series_index}`
      : book.series;
    parts.push(seriesPart);
  }

  // Add title and ID
  parts.push(`${book.title} (${book.id})`);

  return sanitizeFilename(parts.join(" - "));
}

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

  buildFilename,
};
