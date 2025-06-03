import type { BookMetadata, FieldMapping } from "./types.ts";

export class TemplateEngine {
  private template: string;
  private fieldMappings: Record<string, Record<string, string>>;

  constructor(
    template: string,
    fieldMappings: Record<string, Record<string, string>>,
  ) {
    this.template = template;
    this.fieldMappings = fieldMappings;
  }

  render(book: BookMetadata & Record<string, any>): string {
    let result = this.template;

    // Apply field mappings first
    const mappedBook = { ...book };
    for (const [fieldName, mappings] of Object.entries(this.fieldMappings)) {
      if (mappedBook[fieldName] && mappings[mappedBook[fieldName]]) {
        mappedBook[fieldName] = mappings[mappedBook[fieldName]];
      }
    }

    // Replace template variables
    result = result.replace(/{([^}]+)}/g, (match, expression) => {
      return this.evaluateExpression(expression, mappedBook);
    });

    // Clean up any remaining empty conditionals
    result = result.replace(/\s*-\s*-\s*/g, " - ");
    result = result.replace(/\s*-\s*$/g, "");
    result = result.replace(/^\s*-\s*/, "");
    result = result.replace(/\s+/g, " ").trim();

    return result;
  }

  private evaluateExpression(
    expression: string,
    book: BookMetadata & Record<string, any>,
  ): string {
    // Handle conditional expressions like {series:|| }
    if (expression.includes(":")) {
      const [field, condition] = expression.split(":", 2);
      const fieldValue = field && this.getFieldValue(field, book);

      if (!fieldValue) {
        return "";
      }

      // Handle different condition types
      if (condition?.startsWith("||")) {
        // Conditional suffix: show field + suffix if field exists
        const suffix = condition.substring(2).trim();
        return fieldValue + suffix;
      } else if (condition?.endsWith("||")) {
        // Conditional prefix: show prefix + field if field exists
        const prefix = condition.substring(0, condition.length - 2).trim();
        return prefix + fieldValue;
      } else {
        // Format specifier or default value
        return fieldValue;
      }
    }

    // Simple field reference
    return this.getFieldValue(expression, book);
  }

  private getFieldValue(
    fieldName: string,
    book: BookMetadata & Record<string, any>,
  ): string {
    const cleanFieldName = fieldName.replace(/^#/, ""); // Remove # prefix if present

    switch (cleanFieldName) {
      case "title":
        return book.title || "";
      case "author_sort":
        return book.author_sort || "";
      case "authors":
        return book.authors || "";
      case "series":
        return book.series || "";
      case "series_index":
        return book.series_index ? String(book.series_index) : "";
      case "id":
        return String(book.id);
      default:
        // Handle custom fields
        return book[cleanFieldName] ? String(book[cleanFieldName]) : "";
    }
  }

  // Utility method to extract unique field names from template
  static extractFieldNames(template: string): string[] {
    const matches = template.match(/{([^}]+)}/g) || [];
    const fields = new Set<string>();

    for (const match of matches) {
      const expression = match.slice(1, -1); // Remove { }
      let fieldName = expression.split(":")[0]; // Get field name before any conditions
      fieldName = fieldName?.replace(/^#/, ""); // Remove # prefix

      if (!fieldName) {
        throw new Error(`Invalid template: ${match}`);
      }

      fields.add(fieldName);
    }

    return Array.from(fields);
  }
}

// Helper function to create safe filenames
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .substring(0, 255); // Limit length
}
