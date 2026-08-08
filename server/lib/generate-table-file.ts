// generate-table-file.ts
//
// Takes the JSON returned by the image-to-table extraction call (see
// image-to-table-system-prompt.md) and deterministically builds a real
// .xlsx (via SheetJS/xlsx) or .docx (via the `docx` npm package) file.
// The AI never touches file generation — only extraction.
//
// npm install xlsx docx

import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Table as DocxTable,
  TableRow,
  TableCell,
  Paragraph,
  HeadingLevel,
  WidthType,
} from 'docx';

export interface ExtractedTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  sort_applied: string | null;
}

export interface ExtractionResult {
  tables: ExtractedTable[];
  extraction_confidence: 'high' | 'medium' | 'low';
  notes: string;
}

// ---------- Excel generation ----------

export function generateXlsxBuffer(extraction: ExtractionResult): Buffer {
  const workbook = XLSX.utils.book_new();

  extraction.tables.forEach((table, i) => {
    const sheetData = [table.columns, ...table.rows.map((row) => row.map((cell) => cell ?? ''))];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-width columns based on content length (basic heuristic)
    worksheet['!cols'] = table.columns.map((col, colIdx) => {
      const maxLen = Math.max(
        col.length,
        ...table.rows.map((row) => String(row[colIdx] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    const sheetName = (table.title || `Table ${i + 1}`).slice(0, 31); // Excel sheet name limit
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || `Sheet${i + 1}`);
  });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// ---------- Word generation ----------

export async function generateDocxBuffer(extraction: ExtractionResult): Promise<Buffer> {
  const sections: (Paragraph | DocxTable)[] = [];

  extraction.tables.forEach((table) => {
    sections.push(
      new Paragraph({
        text: table.title || 'Extracted Table',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    );

    const headerRow = new TableRow({
      children: table.columns.map(
        (col) =>
          new TableCell({
            width: { size: 100 / table.columns.length, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: col, heading: HeadingLevel.HEADING_4 })],
          })
      ),
      tableHeader: true,
    });

    const bodyRows = table.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                width: { size: 100 / table.columns.length, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ text: cell === null ? '' : String(cell) })],
              })
          ),
        })
    );

    sections.push(
      new DocxTable({
        rows: [headerRow, ...bodyRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  });

  if (extraction.extraction_confidence !== 'high') {
    sections.push(
      new Paragraph({
        text: `Note: extraction confidence was "${extraction.extraction_confidence}". ${extraction.notes}`,
        spacing: { before: 200 },
      })
    );
  }

  const doc = new Document({
    sections: [{ children: sections }],
  });

  return Packer.toBuffer(doc);
}

// ---------- Orchestrator used by the API route ----------

export type OutputFormat = 'excel' | 'word';

export async function generateFileFromExtraction(
  extraction: ExtractionResult,
  format: OutputFormat
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (format === 'excel') {
    return {
      buffer: generateXlsxBuffer(extraction),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }
  const buffer = await generateDocxBuffer(extraction);
  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  };
}

/**
 * Parses the user's free-text instruction to detect which format they want.
 * Falls back to null if neither is clearly requested, so the caller can ask.
 */
export function detectRequestedFormat(userText: string): OutputFormat | null {
  const t = userText.toLowerCase();
  if (/\bexcel\b|\bxlsx\b|\bspreadsheet\b/.test(t)) return 'excel';
  if (/\bword\b|\bdocx\b|\bdoc\b/.test(t)) return 'word';
  return null;
}
