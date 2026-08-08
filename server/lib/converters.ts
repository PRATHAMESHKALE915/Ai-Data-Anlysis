import { PDFDocument } from "pdf-lib";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

async function parsePdf(fileBuffer: Buffer) {
  let pdfParseFn: any;
  try {
    const pdfModule = await import("pdf-parse");
    pdfParseFn = pdfModule.default || pdfModule;
  } catch {
    pdfParseFn = null;
  }

  if (typeof pdfParseFn !== "function") {
    if (typeof pdfParseFn?.default === "function") {
      pdfParseFn = pdfParseFn.default;
    } else if (typeof pdfParseFn?.PDFParse === "function") {
      pdfParseFn = pdfParseFn.PDFParse;
    } else if (typeof pdfParseFn?.PdfParse === "function") {
      pdfParseFn = pdfParseFn.PdfParse;
    }
  }

  const uint8Data = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

  if (typeof pdfParseFn === "function") {
    try {
      return await pdfParseFn(uint8Data);
    } catch (err: any) {
      if (
        err?.message?.includes("Class constructors cannot be invoked without 'new'") ||
        err?.message?.includes("cannot be invoked without 'new'")
      ) {
        // Try class instantiation with { data: uint8Data } or uint8Data
        let instance: any;
        try {
          instance = new pdfParseFn({ data: uint8Data });
        } catch {
          try {
            instance = new pdfParseFn(uint8Data);
          } catch {
            instance = new pdfParseFn(fileBuffer);
          }
        }

        if (instance) {
          if (typeof instance.parse === "function") {
            return await instance.parse();
          }
          if (typeof instance.getText === "function") {
            const text = await instance.getText();
            return { text };
          }
          if (typeof instance.then === "function") {
            return await instance;
          }
          return instance;
        }
      }

      // If Uint8Array failed, fallback to fileBuffer
      try {
        return await pdfParseFn(fileBuffer);
      } catch {
        throw err;
      }
    }
  }

  // Fallback if pdfModule is object with methods
  if (pdfModule && typeof pdfModule.parse === "function") {
    try {
      return await pdfModule.parse(uint8Data);
    } catch {
      return await pdfModule.parse(fileBuffer);
    }
  }

  throw new Error(`pdf-parse module format unsupported (keys: ${Object.keys(pdfModule || {}).join(", ")})`);
}

import { convertImageToTableFile } from "./imageTableExtractor.ts";

function getImageMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

export async function convertFile(
  type: string,
  fileBuffer: Buffer,
  originalName: string,
  extraFiles?: Express.Multer.File[],
  userInstruction?: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName;

  switch (type) {
    case "image-to-excel": {
      const mimeType = getImageMimeType(originalName);
      const res = await convertImageToTableFile(fileBuffer, mimeType, "excel", userInstruction || "");
      return {
        buffer: res.buffer,
        fileName: `${baseName}.xlsx`,
        mimeType: res.mimeType,
      };
    }

    case "image-to-word": {
      const mimeType = getImageMimeType(originalName);
      const res = await convertImageToTableFile(fileBuffer, mimeType, "word", userInstruction || "");
      return {
        buffer: res.buffer,
        fileName: `${baseName}.docx`,
        mimeType: res.mimeType,
      };
    }
    case "pdf-to-excel": {
      const pdfData = await parsePdf(fileBuffer);
      const text = pdfData.text || "";
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

      const rows: string[][] = [];
      lines.forEach((line) => {
        // split by tabs or 2+ consecutive spaces
        const cells = line.split(/\t+|\s{2,}/).map((c) => c.trim());
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length === 0) {
        rows.push(["Extracted Content", text]);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return {
        buffer: Buffer.from(excelBuffer),
        fileName: `${baseName}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    case "excel-to-pdf": {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const doc = new jsPDF({ orientation: "landscape" });

      let isFirstSheet = true;
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length > 0) {
          if (!isFirstSheet) {
            doc.addPage();
          }
          isFirstSheet = false;

          doc.setFontSize(14);
          doc.text(`Sheet: ${sheetName}`, 14, 15);

          const head = rows[0] ? [rows[0].map(String)] : [];
          const body = rows.slice(1).map((row) => row.map((cell) => (cell !== undefined && cell !== null ? String(cell) : "")));

          (autoTable as any)(doc, {
            startY: 20,
            head,
            body,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 133, 244] },
          });
        }
      });

      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    case "word-to-pdf": {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = result.value || "";
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(baseName, 14, 20);

      doc.setFontSize(10);
      const splitLines = doc.splitTextToSize(text, 180);
      let cursorY = 30;

      for (let i = 0; i < splitLines.length; i++) {
        if (cursorY > 280) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(splitLines[i], 14, cursorY);
        cursorY += 6;
      }

      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    case "ppt-to-pdf": {
      const zip = await JSZip.loadAsync(fileBuffer);
      const slideFiles = Object.keys(zip.files).filter((f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml"));
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
        return numA - numB;
      });

      const doc = new jsPDF({ orientation: "landscape" });

      if (slideFiles.length === 0) {
        doc.setFontSize(16);
        doc.text(`Presentation: ${baseName}`, 20, 30);
        doc.setFontSize(12);
        doc.text("Converted Slide Deck", 20, 50);
      } else {
        for (let idx = 0; idx < slideFiles.length; idx++) {
          if (idx > 0) doc.addPage();
          const slideXml = await zip.files[slideFiles[idx]].async("text");
          // Extract text inside <a:t> tags
          const textMatches = slideXml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
          const slideText = textMatches
            .map((m) => m.replace(/<[^>]+>/g, "").trim())
            .filter(Boolean);

          // Draw slide frame
          doc.setDrawColor(200, 200, 200);
          doc.setFillColor(250, 250, 252);
          doc.roundedRect(10, 10, 277, 190, 4, 4, "FD");

          doc.setFontSize(16);
          doc.setTextColor(30, 41, 59);
          doc.text(`Slide ${idx + 1}`, 20, 25);

          doc.setFontSize(11);
          doc.setTextColor(51, 65, 85);

          let y = 40;
          slideText.forEach((txt) => {
            if (y < 185) {
              const wrapped = doc.splitTextToSize(txt, 250);
              doc.text(wrapped, 25, y);
              y += wrapped.length * 7 + 3;
            }
          });
        }
      }

      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    case "image-to-pdf": {
      const pdfDoc = await PDFDocument.create();

      const allBuffers = [fileBuffer];
      if (extraFiles && extraFiles.length > 0) {
        extraFiles.forEach((f) => allBuffers.push(f.buffer));
      }

      for (const imgBuf of allBuffers) {
        let image;
        try {
          image = await pdfDoc.embedPng(imgBuf);
        } catch {
          try {
            image = await pdfDoc.embedJpg(imgBuf);
          } catch (e) {
            continue;
          }
        }

        if (image) {
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      return {
        buffer: Buffer.from(pdfBytes),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    case "pdf-to-image": {
      const pdfData = await parsePdf(fileBuffer);
      const text = pdfData.text || "";
      const doc = new jsPDF({ orientation: "portrait" });

      doc.setFillColor(245, 247, 250);
      doc.rect(0, 0, 210, 297, "F");

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(`PDF Rendered View: ${baseName}`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const splitLines = doc.splitTextToSize(text || "PDF Document Content", 180);
      let cursorY = 35;

      for (let i = 0; i < Math.min(splitLines.length, 40); i++) {
        doc.text(splitLines[i], 14, cursorY);
        cursorY += 6;
      }

      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}_preview.pdf`,
        mimeType: "application/pdf",
      };
    }

    default:
      throw new Error(`Unsupported conversion type: ${type}`);
  }
}
