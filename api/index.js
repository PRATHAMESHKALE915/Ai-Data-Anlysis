var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

// server/lib/agentClient.ts
var API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
async function createInteraction(opts) {
  const agentName = opts.agentName ?? "antigravity-preview-05-2026";
  const payload = {
    agent: agentName,
    input: [
      {
        type: "text",
        text: opts.prompt
      }
    ],
    stream: true
  };
  if (opts.environmentId) {
    payload.environment = { env_id: opts.environmentId };
  } else {
    const allowlist = [
      {
        domain: "generativelanguage.googleapis.com",
        transform: { "x-goog-api-key": process.env.GEMINI_API_KEY }
      }
    ];
    if (opts.gcsToken) {
      allowlist.push({
        domain: "storage.googleapis.com",
        transform: {
          "Authorization": `Bearer ${opts.gcsToken}`
        }
      });
    }
    allowlist.push({ domain: "*" });
    const envConfig = {
      type: "remote",
      sources: opts.inlineSources ?? [],
      network: {
        allowlist
      }
    };
    payload.environment = envConfig;
  }
  if (opts.previousInteractionId) {
    payload.previous_interaction_id = opts.previousInteractionId;
  }
  const response = await fetch(`${API_BASE_URL}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      "x-server-timeout": "600",
      "Api-Revision": "2026-05-20",
      "x-goog-api-client": "applet-ai-data-analyst/1.0.0"
    },
    body: JSON.stringify(payload),
    signal: opts.signal
  });
  return response;
}
function parseSseLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const dataStr = trimmed.slice(5).trimStart();
  if (dataStr === "[DONE]") {
    return { type: "done" };
  }
  try {
    return parseAgentEvent(JSON.parse(dataStr));
  } catch {
    return null;
  }
}
async function* streamInteraction(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    console.error(`[streamInteraction] Error: response.body.getReader() is undefined!`);
    yield { type: "error", message: "No response body" };
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunkCount++;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseSseLine(line);
        if (!event) continue;
        yield event;
        if (event.type === "done") return;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseSseLine(buffer);
      if (event) yield event;
    }
  } catch (err) {
    console.error(`[streamInteraction] Exception caught in read loop:`, err);
    yield { type: "error", message: `Stream read exception: ${err.message}` };
  } finally {
    reader.releaseLock();
  }
}
function parseAgentEvent(event) {
  const eventType = event.event_type;
  if (eventType === "interaction.created") {
    const nestedData = event.data;
    return {
      type: "interaction",
      interaction: event.interaction ?? nestedData?.interaction ?? event
    };
  }
  if (eventType === "step.delta") {
    const delta = event.delta;
    if (!delta) return null;
    const resultVal = delta.result !== void 0 ? delta.result : delta.response;
    if (resultVal !== void 0 && resultVal !== null) {
      let resultStr = "";
      if (typeof resultVal === "object") {
        resultStr = JSON.stringify(resultVal);
      } else {
        resultStr = String(resultVal);
      }
      return {
        type: "tool_result",
        name: delta.name,
        result: resultStr
      };
    }
    let argumentsObj = delta.arguments || delta.call?.arguments;
    if (typeof argumentsObj === "string") {
      try {
        argumentsObj = JSON.parse(argumentsObj);
      } catch (e) {
      }
    }
    const callName = delta.name || delta.call?.name || (delta.type === "code_execution_call" ? "code_execution_call" : void 0);
    if (callName || argumentsObj) {
      return {
        type: "tool_call",
        name: callName || "code_execution_call",
        arguments: argumentsObj ?? {}
      };
    }
    let extractedText = "";
    let isThinking = false;
    if (delta.type === "thought_summary" || delta.type === "thinking" || delta.type === "thought" || delta.type === "thought_delta") {
      isThinking = true;
    }
    if (typeof delta.text === "string") {
      extractedText = delta.text;
    } else if (typeof delta.thought === "string") {
      extractedText = delta.thought;
      isThinking = true;
    } else if (typeof delta.summary === "string" && isThinking) {
      extractedText = delta.summary;
    }
    const content = delta.content;
    if (content !== void 0 && content !== null) {
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === "object") {
            const partObj = part;
            if (partObj.type === "thought") {
              isThinking = true;
              if (typeof partObj.text === "string") {
                extractedText += partObj.text;
              } else if (typeof partObj.thought === "string") {
                extractedText += partObj.thought;
              }
            } else if (partObj.type === "text" && typeof partObj.text === "string") {
              extractedText += partObj.text;
            } else if (typeof partObj.text === "string") {
              extractedText += partObj.text;
            } else if (typeof partObj.thought === "string") {
              extractedText += partObj.thought;
              isThinking = true;
            }
          } else if (typeof part === "string") {
            extractedText += part;
          }
        }
      } else if (typeof content === "object") {
        const cObj = content;
        if (cObj.type === "thought") {
          isThinking = true;
          if (typeof cObj.text === "string") {
            extractedText = cObj.text;
          } else if (typeof cObj.thought === "string") {
            extractedText = cObj.thought;
          }
        } else if (cObj.type === "text" && typeof cObj.text === "string") {
          extractedText = cObj.text;
        } else if (typeof cObj.text === "string") {
          extractedText = cObj.text;
        } else if (typeof cObj.thought === "string") {
          extractedText = cObj.thought;
          isThinking = true;
        }
      } else if (typeof content === "string") {
        extractedText = content;
      }
    }
    if (extractedText) {
      return {
        type: isThinking ? "thinking" : "text",
        text: extractedText
      };
    }
  }
  if (eventType === "interaction.completed") {
    return {
      type: "complete",
      interaction: event.interaction ?? {}
    };
  }
  if (eventType === "step.start" || eventType === "step.stop" || eventType === "step.delta") {
    return null;
  }
  return null;
}

// server/lib/jsonExtractor.ts
function extractJsonBlocks(text2) {
  const pattern = /```json\s*\n([\s\S]*?)\n\s*```/g;
  const results = [];
  let match;
  while ((match = pattern.exec(text2)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return results;
}

// server.ts
import fs from "fs";
import multer from "multer";

// server/lib/converters.ts
import { PDFDocument } from "pdf-lib";
import * as XLSX2 from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// server/lib/imageTableExtractor.ts
import { GoogleGenAI } from "@google/genai";

// server/lib/generate-table-file.ts
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Table as DocxTable,
  TableRow,
  TableCell,
  Paragraph,
  HeadingLevel,
  WidthType
} from "docx";
function generateXlsxBuffer(extraction) {
  const workbook = XLSX.utils.book_new();
  extraction.tables.forEach((table, i) => {
    const sheetData = [table.columns, ...table.rows.map((row) => row.map((cell) => cell ?? ""))];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!cols"] = table.columns.map((col, colIdx) => {
      const maxLen = Math.max(
        col.length,
        ...table.rows.map((row) => String(row[colIdx] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    const sheetName = (table.title || `Table ${i + 1}`).slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || `Sheet${i + 1}`);
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
async function generateDocxBuffer(extraction) {
  const sections = [];
  extraction.tables.forEach((table) => {
    sections.push(
      new Paragraph({
        text: table.title || "Extracted Table",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      })
    );
    const headerRow = new TableRow({
      children: table.columns.map(
        (col) => new TableCell({
          width: { size: 100 / table.columns.length, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: col, heading: HeadingLevel.HEADING_4 })]
        })
      ),
      tableHeader: true
    });
    const bodyRows = table.rows.map(
      (row) => new TableRow({
        children: row.map(
          (cell) => new TableCell({
            width: { size: 100 / table.columns.length, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: cell === null ? "" : String(cell) })]
          })
        )
      })
    );
    sections.push(
      new DocxTable({
        rows: [headerRow, ...bodyRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
  });
  if (extraction.extraction_confidence !== "high") {
    sections.push(
      new Paragraph({
        text: `Note: extraction confidence was "${extraction.extraction_confidence}". ${extraction.notes}`,
        spacing: { before: 200 }
      })
    );
  }
  const doc = new Document({
    sections: [{ children: sections }]
  });
  return Packer.toBuffer(doc);
}
async function generateFileFromExtraction(extraction, format) {
  if (format === "excel") {
    return {
      buffer: generateXlsxBuffer(extraction),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx"
    };
  }
  const buffer = await generateDocxBuffer(extraction);
  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx"
  };
}
function detectRequestedFormat(userText) {
  const t = userText.toLowerCase();
  if (/\bexcel\b|\bxlsx\b|\bspreadsheet\b/.test(t)) return "excel";
  if (/\bword\b|\bdocx\b|\bdoc\b/.test(t)) return "word";
  return null;
}

// server/lib/imageTableExtractor.ts
async function extractTableFromImage(imageBuffer, mimeType = "image/png", userInstruction = "") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
  const systemInstruction = `You are a document-to-table extraction assistant. You will be given an image that
contains tabular or list-like data \u2014 this could be a printed table, a handwritten
list, a receipt, an invoice, a screenshot of a spreadsheet, or a form. Your job is to
read everything relevant in the image and convert it into clean structured JSON.

RULES:
1. Identify the most sensible column headers from the image. If the image has no
   explicit headers (e.g. a handwritten list), infer reasonable column names from
   context (e.g. "Item", "Quantity", "Price").
2. Extract every row you can read. If a value is illegible or missing, use null \u2014
   never invent a value you cannot actually read in the image.
3. Preserve numbers as numbers (not strings) where the column is clearly numeric
   (price, quantity, totals, dates as ISO strings where a date is unambiguous).
4. If the user gave a sorting or grouping instruction along with the image (e.g.
   "sort by price", "group by category"), apply it by ordering the \`rows\` array
   accordingly \u2014 do not silently ignore it, and do not apply a sort the user
   didn't ask for.
5. If the image contains multiple distinct tables, return them as separate entries
   in the \`tables\` array, each with its own title guess.
6. If the image quality is too poor to extract anything reliably, set
   \`extraction_confidence\` to "low" and explain why in \`notes\` \u2014 do not fabricate
   plausible-looking data to fill gaps.
7. Output ONLY valid JSON matching the schema below. No markdown fences, no prose
   outside the JSON.

OUTPUT JSON SCHEMA:

{
  "tables": [
    {
      "title": string,
      "columns": string[],
      "rows": (string | number | null)[][],
      "sort_applied": string | null
    }
  ],
  "extraction_confidence": "high" | "medium" | "low",
  "notes": string
}`;
  const imageBase64 = imageBuffer.toString("base64");
  const baseMimeType = mimeType.split(";")[0].trim() || "image/png";
  const promptText = userInstruction.trim() ? `User Instruction: ${userInstruction}` : "Extract all tabular and list data from this image into structured JSON format.";
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.6-flash"
  ];
  let response = null;
  let lastError = null;
  for (const model of candidateModels) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: baseMimeType,
              data: imageBase64
            }
          },
          promptText
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });
      if (response && response.text) {
        break;
      }
    } catch (err) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[imageTableExtractor] Model ${model} failed:`, errMsg);
      if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429") || errMsg.includes("quota")) {
        continue;
      }
      continue;
    }
  }
  if (!response || !response.text) {
    const errString = String(lastError?.message || lastError || "");
    if (errString.includes("RESOURCE_EXHAUSTED") || errString.includes("429") || errString.includes("quota")) {
      throw new Error(
        "AI request quota or rate limit exceeded across models. Please wait 20-30 seconds and try again."
      );
    }
    throw new Error(
      lastError?.message || "Failed to generate table extraction from image."
    );
  }
  const responseText = response.text || "";
  const cleanedJson = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  let result;
  try {
    result = JSON.parse(cleanedJson);
  } catch (err) {
    console.error("[imageTableExtractor] Failed to parse JSON response:", responseText);
    throw new Error("Failed to parse extracted table JSON from image.");
  }
  if (!Array.isArray(result.tables)) {
    result.tables = [];
  }
  if (!result.extraction_confidence) {
    result.extraction_confidence = "medium";
  }
  if (typeof result.notes !== "string") {
    result.notes = "";
  }
  return result;
}
async function convertImageToTableFile(imageBuffer, mimeType, format, userInstruction = "") {
  const extraction = await extractTableFromImage(imageBuffer, mimeType, userInstruction);
  const fileResult = await generateFileFromExtraction(extraction, format);
  return {
    ...fileResult,
    extraction
  };
}

// server/lib/converters.ts
async function parsePdf(fileBuffer) {
  let pdfParseFn;
  try {
    const pdfModule2 = await import("pdf-parse");
    pdfParseFn = pdfModule2.default || pdfModule2;
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
    } catch (err) {
      if (err?.message?.includes("Class constructors cannot be invoked without 'new'") || err?.message?.includes("cannot be invoked without 'new'")) {
        let instance;
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
            const text2 = await instance.getText();
            return { text: text2 };
          }
          if (typeof instance.then === "function") {
            return await instance;
          }
          return instance;
        }
      }
      try {
        return await pdfParseFn(fileBuffer);
      } catch {
        throw err;
      }
    }
  }
  if (pdfModule && typeof pdfModule.parse === "function") {
    try {
      return await pdfModule.parse(uint8Data);
    } catch {
      return await pdfModule.parse(fileBuffer);
    }
  }
  throw new Error(`pdf-parse module format unsupported (keys: ${Object.keys(pdfModule || {}).join(", ")})`);
}
function getImageMimeType(filename) {
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
async function convertFile(type, fileBuffer, originalName, extraFiles, userInstruction) {
  const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName;
  switch (type) {
    case "image-to-excel": {
      const mimeType = getImageMimeType(originalName);
      const res = await convertImageToTableFile(fileBuffer, mimeType, "excel", userInstruction || "");
      return {
        buffer: res.buffer,
        fileName: `${baseName}.xlsx`,
        mimeType: res.mimeType
      };
    }
    case "image-to-word": {
      const mimeType = getImageMimeType(originalName);
      const res = await convertImageToTableFile(fileBuffer, mimeType, "word", userInstruction || "");
      return {
        buffer: res.buffer,
        fileName: `${baseName}.docx`,
        mimeType: res.mimeType
      };
    }
    case "pdf-to-excel": {
      const pdfData = await parsePdf(fileBuffer);
      const text2 = pdfData.text || "";
      const lines = text2.split("\n").map((line) => line.trim()).filter(Boolean);
      const rows = [];
      lines.forEach((line) => {
        const cells = line.split(/\t+|\s{2,}/).map((c) => c.trim());
        if (cells.length > 0) {
          rows.push(cells);
        }
      });
      if (rows.length === 0) {
        rows.push(["Extracted Content", text2]);
      }
      const worksheet = XLSX2.utils.aoa_to_sheet(rows);
      const workbook = XLSX2.utils.book_new();
      XLSX2.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const excelBuffer = XLSX2.write(workbook, { type: "buffer", bookType: "xlsx" });
      return {
        buffer: Buffer.from(excelBuffer),
        fileName: `${baseName}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      };
    }
    case "excel-to-pdf": {
      const workbook = XLSX2.read(fileBuffer, { type: "buffer" });
      const doc = new jsPDF({ orientation: "landscape" });
      let isFirstSheet = true;
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX2.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 0) {
          if (!isFirstSheet) {
            doc.addPage();
          }
          isFirstSheet = false;
          doc.setFontSize(14);
          doc.text(`Sheet: ${sheetName}`, 14, 15);
          const head = rows[0] ? [rows[0].map(String)] : [];
          const body = rows.slice(1).map((row) => row.map((cell) => cell !== void 0 && cell !== null ? String(cell) : ""));
          autoTable(doc, {
            startY: 20,
            head,
            body,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 133, 244] }
          });
        }
      });
      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf"
      };
    }
    case "word-to-pdf": {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text2 = result.value || "";
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(baseName, 14, 20);
      doc.setFontSize(10);
      const splitLines = doc.splitTextToSize(text2, 180);
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
        mimeType: "application/pdf"
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
          const textMatches = slideXml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
          const slideText = textMatches.map((m) => m.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
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
        mimeType: "application/pdf"
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
            height: image.height
          });
        }
      }
      const pdfBytes = await pdfDoc.save();
      return {
        buffer: Buffer.from(pdfBytes),
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf"
      };
    }
    case "pdf-to-image": {
      const pdfData = await parsePdf(fileBuffer);
      const text2 = pdfData.text || "";
      const doc = new jsPDF({ orientation: "portrait" });
      doc.setFillColor(245, 247, 250);
      doc.rect(0, 0, 210, 297, "F");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(`PDF Rendered View: ${baseName}`, 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const splitLines = doc.splitTextToSize(text2 || "PDF Document Content", 180);
      let cursorY = 35;
      for (let i = 0; i < Math.min(splitLines.length, 40); i++) {
        doc.text(splitLines[i], 14, cursorY);
        cursorY += 6;
      }
      const pdfArrayBuffer = doc.output("arraybuffer");
      return {
        buffer: Buffer.from(pdfArrayBuffer),
        fileName: `${baseName}_preview.pdf`,
        mimeType: "application/pdf"
      };
    }
    default:
      throw new Error(`Unsupported conversion type: ${type}`);
  }
}

// server/lib/dataCleaner.ts
import { GoogleGenAI as GoogleGenAI2 } from "@google/genai";
import Papa from "papaparse";

// server/lib/apply-cleaning-plan.ts
function toTitleCase(input) {
  return input.toLowerCase().split(" ").map(
    (word) => word.split("-").map((part) => part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part).join("-")
  ).join(" ");
}
function toSentenceCase(input) {
  const lower = input.toLowerCase();
  return lower.length > 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
}
function applyCaseStyle(value, style) {
  const trimmed = value.trim();
  switch (style) {
    case "title":
      return toTitleCase(trimmed);
    case "sentence":
      return toSentenceCase(trimmed);
    case "lower":
      return trimmed.toLowerCase();
    case "upper":
      return trimmed.toUpperCase();
    case "preserve":
    default:
      return trimmed;
  }
}
function normalizeDateToISO(value) {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return toISO(m[3], m[2], m[1]);
  m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return toISO(m[3], m[2], m[1]);
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month <= 12 && day <= 31) {
      return toISO(m[3], m[1], m[2]);
    }
  }
  return null;
}
function toISO(year, month, day) {
  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
function normalizeForComparison(value) {
  if (value === null || value === void 0) return "";
  return String(value).trim().toLowerCase();
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function applyCleaningPlan(rawRows, plan) {
  const actions = [];
  let rows = rawRows.map((r) => ({ ...r }));
  const dropIndices = new Set(
    (plan.near_empty_rows || []).filter((r) => r.recommendation === "drop").map((r) => r.row_index)
  );
  if (dropIndices.size > 0) {
    rows = rows.filter((_, idx) => !dropIndices.has(idx));
    actions.push({
      action: "Dropped rows that were almost entirely empty",
      column: "(entire row)",
      rows_affected: dropIndices.size,
      before_example: "<mostly blank row>",
      after_example: "(removed)"
    });
  }
  let duplicatesRemoved = 0;
  const allDuplicateIndicesToRemove = /* @__PURE__ */ new Set();
  for (const group of plan.duplicate_groups || []) {
    for (const idx of group.duplicate_row_indices || []) {
      if (idx !== group.canonical_row_index) allDuplicateIndicesToRemove.add(idx);
    }
  }
  if (allDuplicateIndicesToRemove.size > 0) {
    const survivingOriginalIndices = rawRows.map((_, idx) => idx).filter((idx) => !dropIndices.has(idx));
    const keepMask = survivingOriginalIndices.map((origIdx) => !allDuplicateIndicesToRemove.has(origIdx));
    rows = rows.filter((_, i) => keepMask[i]);
    duplicatesRemoved = allDuplicateIndicesToRemove.size;
    actions.push({
      action: "Removed exact duplicate rows (kept first occurrence)",
      column: "(entire row)",
      rows_affected: duplicatesRemoved,
      before_example: "duplicate row",
      after_example: "(removed)"
    });
  }
  for (const { column, case_style } of plan.text_case_plan || []) {
    if ((plan.excluded_from_case_transform || []).includes(column)) continue;
    let changedCount = 0;
    let beforeSample = "";
    let afterSample = "";
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== "string" || val.trim() === "") return row;
      const cleaned = applyCaseStyle(val, case_style);
      if (cleaned !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = cleaned;
        }
      }
      return { ...row, [column]: cleaned };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Standardized "${column}" to ${case_style} case`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample
      });
    }
  }
  for (const column of plan.excluded_from_case_transform || []) {
    let changedCount = 0;
    let beforeSample = "";
    let afterSample = "";
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== "string" || val.trim() === "") return row;
      const isEmailLike = /@/.test(val);
      const cleaned = isEmailLike ? val.trim().toLowerCase() : val.trim();
      if (cleaned !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = cleaned;
        }
      }
      return { ...row, [column]: cleaned };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Normalized "${column}" (trimmed${/@/.test(rows[0]?.[column] ?? "") ? ", lowercased" : ""}, casing preserved)`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample
      });
    }
  }
  for (const { column } of plan.date_columns || []) {
    let changedCount = 0;
    let beforeSample = "";
    let afterSample = "";
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== "string" || val.trim() === "") return row;
      const iso = normalizeDateToISO(val);
      if (iso && iso !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = iso;
        }
        return { ...row, [column]: iso };
      }
      return row;
    });
    if (changedCount > 0) {
      actions.push({
        action: `Normalized "${column}" to YYYY-MM-DD`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample
      });
    }
  }
  for (const { column, canonical_value, variant_values } of plan.categorical_label_groups || []) {
    const variantSet = new Set((variant_values || []).map(normalizeForComparison));
    let changedCount = 0;
    let beforeSample = "";
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== "string") return row;
      if (variantSet.has(normalizeForComparison(val)) && val !== canonical_value) {
        changedCount++;
        if (!beforeSample) beforeSample = val;
        return { ...row, [column]: canonical_value };
      }
      return row;
    });
    if (changedCount > 0) {
      actions.push({
        action: `Merged inconsistent labels in "${column}" into "${canonical_value}"`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: canonical_value
      });
    }
  }
  for (const { column, strategy, value } of plan.numeric_imputation || []) {
    let changedCount = 0;
    rows = rows.map((row) => {
      const val = row[column];
      const isBlank = val === null || val === void 0 || String(val).trim() === "";
      if (!isBlank) return row;
      changedCount++;
      return { ...row, [column]: value };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Filled missing "${column}" values using column ${strategy}`,
        column,
        rows_affected: changedCount,
        before_example: "(blank)",
        after_example: String(value)
      });
    }
  }
  return { cleanedRows: rows, actions };
}
function recomputeNumericStrategyValues(rows, imputationPlan) {
  return (imputationPlan || []).map(({ column, strategy }) => {
    const nums = rows.map((r) => r[column]).filter((v) => v !== null && v !== void 0 && String(v).trim() !== "").map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    const value = strategy === "median" ? median(nums) : nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
    return {
      column,
      strategy,
      value: Math.round(value * 100) / 100,
      reasoning: `Recomputed exact ${strategy} (${Math.round(value * 100) / 100}) from non-null column values.`
    };
  });
}

// server/lib/dataCleaner.ts
async function cleanDataWithAi(csvContent, fileName = "dataset.csv", userApprovedOutlierIndices) {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });
  const rawRows = parsed.data || [];
  const columns = parsed.meta.fields || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
  if (rawRows.length === 0 || columns.length === 0) {
    throw new Error("Uploaded CSV is empty or invalid.");
  }
  const rawPreview = rawRows.slice(0, 15);
  const totalRows = rawRows.length;
  const colStats = columns.map((col) => {
    let nullCount = 0;
    const values = [];
    const numValues = [];
    rawRows.forEach((row) => {
      const val = row[col];
      if (val === null || val === void 0 || String(val).trim() === "") {
        nullCount++;
      } else {
        const strVal = String(val).trim();
        values.push(strVal);
        const cleanNumStr = strVal.replace(/[,$£€%]/g, "");
        const num = parseFloat(cleanNumStr);
        if (!isNaN(num) && isFinite(num)) {
          numValues.push(num);
        }
      }
    });
    const isNumeric = numValues.length > values.length * 0.5;
    let min = null;
    let max = null;
    let mean = null;
    let median2 = null;
    if (numValues.length > 0) {
      numValues.sort((a, b) => a - b);
      min = numValues[0];
      max = numValues[numValues.length - 1];
      const sum = numValues.reduce((a, b) => a + b, 0);
      mean = parseFloat((sum / numValues.length).toFixed(2));
      const mid = Math.floor(numValues.length / 2);
      median2 = numValues.length % 2 !== 0 ? numValues[mid] : (numValues[mid - 1] + numValues[mid]) / 2;
    }
    const uniqueVals = Array.from(new Set(values));
    return {
      column: col,
      null_count: nullCount,
      null_pct: parseFloat((nullCount / totalRows * 100).toFixed(1)),
      distinct_count: uniqueVals.length,
      sample_values: uniqueVals.slice(0, 8),
      inferred_type: isNumeric ? "numeric" : "text/categorical",
      numeric_stats: isNumeric ? { min, max, mean, median: median2 } : null
    };
  });
  const sampleRows = rawRows.slice(0, 50);
  const apiKey = process.env.GEMINI_API_KEY;
  let plan = null;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI2({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const systemInstruction = `You are a data-quality analyst. You will be given a dataset's column names, inferred
types, per-column null counts, basic numeric stats (min/max/mean/median), and a sample
of rows. Your job is ONLY to analyze and output a cleaning PLAN as JSON. You must NOT
rewrite, reformat, or "fix" any actual row values yourself \u2014 a separate deterministic
process will apply your plan to the full dataset. Output nothing except valid JSON
matching the schema below. No markdown fences, no preamble, no explanation text outside
the JSON.

RULES YOU MUST FOLLOW WHEN BUILDING THE PLAN:

1. TEXT CASING
   - For each text column, decide a case_style: "title" | "sentence" | "lower" |
     "upper" | "preserve".
   - Columns that look like emails, URLs, IDs, codes, or free-form notes must always
     get case_style "preserve" (or "lower" for emails specifically) \u2014 NEVER "title".
     List every such column explicitly in \`excluded_from_case_transform\`.
   - Do not attempt to perform the casing yourself. Just decide the style per column.

2. DUPLICATE ROWS
   - Distinguish TWO kinds of duplication:
     a) EXACT duplicates: every column matches except an auto-increment ID column.
        These go in \`duplicate_groups\` with strategy "keep_first_remove_rest".
     b) SUSPICIOUS-but-not-exact duplicates: e.g. same email/phone reused across
        different customer names, or same product+price+date but different name.
        These must NOT be auto-removed. List them in \`suspicious_duplicates\` with a
        reason, so the user can review them manually \u2014 do not merge or drop them.
   - Base exact-duplicate comparison on normalized values (trimmed, case-folded),
     not raw string equality, so "Mumbai" and "mumbai " count as the same value.

3. DATES
   - For each date-like column, detect every distinct format pattern present
     (e.g. "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY") and list them in
     \`detected_formats\`. Set \`target_format\` to "YYYY-MM-DD" (ISO 8601) always.
   - Do not convert the dates yourself \u2014 just report what formats exist.

4. NEAR-EMPTY ROWS
   - For every row, if fewer than 40% of its columns have a non-null value, add it to
     \`near_empty_rows\` with recommendation "drop". Do NOT recommend partially filling
     placeholder values ("Unknown", column means, etc.) into a row this empty \u2014 a row
     with almost nothing in it usually shouldn't survive cleaning at all.
   - If a row has some real data but is missing a few fields, recommend
     "keep_and_impute" instead, and let the standard imputation rules below apply
     only to that row's actual missing fields.

5. CATEGORICAL / LABEL VARIANTS
   - For any column with repeated categorical-style values (product names, categories,
     cities, etc.), detect near-duplicate labels that mean the same thing after
     normalizing case/whitespace/hyphenation (e.g. "Non-Stick Pan" vs "Non stick pan").
   - Group them under \`categorical_label_groups\`, picking ONE canonical form per group
     (prefer the most frequent variant, or the properly-formatted one if frequencies tie).

6. NUMERIC IMPUTATION
   - For each numeric column with missing values, choose "median" as the default
     strategy whenever the column contains any extreme outliers (values more than
     ~3x the median or negative where negative is implausible for that column, e.g.
     price/quantity can't be negative). Use "mean" only when the column looks
     roughly symmetric with no extreme outliers.
   - Report the actual numeric value to fill, and your reasoning.

7. OUTLIERS
   - Flag implausible values (negative prices, quantities wildly above the rest of the
     column, ratings outside a plausible scale, etc.) in \`outliers\`. These are NEVER
     auto-removed \u2014 only flagged for the user to approve individually.

8. Do not invent columns, values, or rows that are not implied by the input data.
   If you are not confident about a rule for a column, omit that column from the
   relevant plan section rather than guessing.

OUTPUT JSON SCHEMA (return exactly this shape, no extra top-level keys):

{
  "column_analysis": [
    { "column": string, "detected_type": string, "issues_found": string[],
      "suggested_action": string, "reasoning": string }
  ],
  "text_case_plan": [
    { "column": string, "case_style": "title"|"sentence"|"lower"|"upper"|"preserve" }
  ],
  "excluded_from_case_transform": string[],
  "duplicate_groups": [
    { "canonical_row_index": number, "duplicate_row_indices": number[], "reason": string }
  ],
  "suspicious_duplicates": [
    { "row_indices": number[], "shared_field": string, "reason": string }
  ],
  "date_columns": [
    { "column": string, "detected_formats": string[], "target_format": "YYYY-MM-DD" }
  ],
  "near_empty_rows": [
    { "row_index": number, "non_null_field_count": number, "total_fields": number,
      "recommendation": "drop"|"keep_and_impute" }
  ],
  "categorical_label_groups": [
    { "column": string, "canonical_value": string, "variant_values": string[] }
  ],
  "numeric_imputation": [
    { "column": string, "strategy": "median"|"mean", "value": number, "reasoning": string }
  ],
  "outliers": [
    { "row_index": number, "column": string, "value": string, "reason": string }
  ],
  "human_summary": string
}`;
      const userPrompt = `Dataset File: ${fileName}
Total Rows: ${totalRows}

Column Statistics:
${JSON.stringify(colStats, null, 2)}

Sample Data Rows (First ${sampleRows.length}):
${JSON.stringify(sampleRows, null, 2)}`;
      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-3.6-flash"
      ];
      let response = null;
      for (const model of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          });
          if (response && response.text) break;
        } catch (err) {
          console.warn(`[dataCleaner] Model ${model} failed, trying next candidate:`, err);
        }
      }
      const responseText = response?.text || "";
      const cleanedJsonText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      if (cleanedJsonText) {
        plan = JSON.parse(cleanedJsonText);
      }
    } catch (err) {
      console.error("[dataCleaner] Gemini API call failed, falling back to heuristic plan:", err);
    }
  }
  if (!plan) {
    const textCasePlan = [];
    const excludedFromCase = [];
    const dateCols = [];
    const numericImp = [];
    colStats.forEach((cs) => {
      const colLower = cs.column.toLowerCase();
      if (cs.inferred_type === "numeric") {
        if (cs.null_count > 0 && cs.numeric_stats?.median !== void 0) {
          numericImp.push({
            column: cs.column,
            strategy: "median",
            value: cs.numeric_stats.median,
            reasoning: "Heuristic fallback selected column median."
          });
        }
      } else {
        if (colLower.includes("email") || colLower.includes("url") || colLower.includes("id")) {
          excludedFromCase.push(cs.column);
        } else if (colLower.includes("date") || colLower.includes("time")) {
          dateCols.push({ column: cs.column, detected_formats: ["unknown"], target_format: "YYYY-MM-DD" });
          excludedFromCase.push(cs.column);
        } else {
          textCasePlan.push({ column: cs.column, case_style: "title" });
        }
      }
    });
    plan = {
      column_analysis: colStats.map((cs) => ({
        column: cs.column,
        detected_type: cs.inferred_type,
        issues_found: cs.null_count > 0 ? [`${cs.null_count} missing values`] : [],
        suggested_action: cs.inferred_type === "numeric" ? "fill_median" : "standardize_casing",
        reasoning: "Heuristic fallback generated basic column analysis."
      })),
      text_case_plan: textCasePlan,
      excluded_from_case_transform: excludedFromCase,
      duplicate_groups: [],
      suspicious_duplicates: [],
      date_columns: dateCols,
      near_empty_rows: [],
      categorical_label_groups: [],
      numeric_imputation: numericImp,
      outliers: [],
      human_summary: "Heuristic cleaning plan created and applied."
    };
  }
  if (plan.numeric_imputation && plan.numeric_imputation.length > 0) {
    plan.numeric_imputation = recomputeNumericStrategyValues(rawRows, plan.numeric_imputation);
  }
  let { cleanedRows, actions } = applyCleaningPlan(rawRows, plan);
  if (userApprovedOutlierIndices && userApprovedOutlierIndices.length > 0) {
    const toRemoveSet = new Set(userApprovedOutlierIndices);
    const beforeCount = cleanedRows.length;
    cleanedRows = cleanedRows.filter((_, idx) => !toRemoveSet.has(idx));
    const removedCount = beforeCount - cleanedRows.length;
    if (removedCount > 0) {
      actions.push({
        action: "Removed user-approved outlier rows",
        column: "Flagged Rows",
        rows_affected: removedCount,
        before_example: `${removedCount} outlier row(s) approved by user`,
        after_example: "Removed"
      });
    }
  }
  const duplicateIndicesToRemove = [];
  for (const group of plan.duplicate_groups || []) {
    for (const idx of group.duplicate_row_indices || []) {
      if (idx !== group.canonical_row_index) {
        duplicateIndicesToRemove.push(idx);
      }
    }
  }
  const reportOutliers = (plan.outliers || []).map((o) => ({
    row_index: o.row_index,
    column: o.column,
    value: o.value,
    reason: o.reason
  }));
  (plan.suspicious_duplicates || []).forEach((sd) => {
    sd.row_indices.forEach((idx) => {
      if (!reportOutliers.some((o) => o.row_index === idx)) {
        reportOutliers.push({
          row_index: idx,
          column: sd.shared_field || "row",
          value: "Suspicious duplicate",
          reason: sd.reason || "Shared key across distinct rows"
        });
      }
    });
  });
  const cleanedCsv = Papa.unparse(cleanedRows);
  const cleanedPreview = cleanedRows.slice(0, 15);
  const finalReport = {
    column_analysis: plan.column_analysis || [],
    duplicate_rows: {
      count: duplicateIndicesToRemove.length,
      row_indices: duplicateIndicesToRemove,
      strategy: "keep_first_remove_rest"
    },
    outliers: reportOutliers,
    cleaning_actions: actions,
    human_summary: plan.human_summary || "Successfully applied AI data cleaning plan deterministically.",
    initial_row_count: rawRows.length,
    final_row_count: cleanedRows.length
  };
  return {
    cleanedCsv,
    rawPreview,
    cleanedPreview,
    report: finalReport
  };
}

// src/lib/firebaseAdmin.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
var projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-data-analysis-9805c";
if (!getApps().length) {
  initializeApp({
    projectId
  });
}
var adminAuth = getAuth();

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  analysisReports: () => analysisReports,
  datasets: () => datasets,
  pivotConfigs: () => pivotConfigs,
  promptRoutines: () => promptRoutines,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow()
});
var datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Firebase UID or user reference
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").default(0),
  columnCount: integer("column_count").default(0),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow()
});
var analysisReports = pgTable("analysis_reports", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  reportTitle: text("report_title"),
  reportJson: text("report_json"),
  createdAt: timestamp("created_at").defaultNow()
});
var pivotConfigs = pgTable("pivot_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  configJson: text("config_json").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var promptRoutines = pgTable("prompt_routines", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  promptText: text("prompt_text").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  datasets: many(datasets),
  reports: many(analysisReports),
  routines: many(promptRoutines)
}));

// src/db/index.ts
var createPool = () => {
  if (!process.env.SQL_HOST) return null;
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var db = new Proxy({}, {
  get(_target, prop) {
    if (!global._drizzleDb) {
      const pool = createPool();
      if (!pool) {
        throw new Error("Cloud SQL host not configured (SQL_HOST missing)");
      }
      global._drizzleDb = drizzle(pool, { schema: schema_exports });
    }
    return global._drizzleDb[prop];
  }
});

// src/db/users.ts
import { eq, desc } from "drizzle-orm";
async function getOrCreateUser(uid, email, name) {
  try {
    const result = await db.insert(users).values({
      uid,
      email,
      name: name || email.split("@")[0]
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        ...name ? { name } : {}
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Error syncing user to Cloud SQL:", error);
    throw new Error("Failed to synchronize user record", { cause: error });
  }
}
async function saveDatasetRecord(userId, fileName, rowCount, columnCount, content) {
  try {
    const result = await db.insert(datasets).values({
      userId,
      fileName,
      rowCount,
      columnCount,
      content: content ? content.substring(0, 5e5) : ""
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Error saving dataset to Cloud SQL:", error);
    throw new Error("Failed to save dataset", { cause: error });
  }
}
async function getUserDatasets(userId) {
  try {
    return await db.select().from(datasets).where(eq(datasets.userId, userId)).orderBy(desc(datasets.createdAt));
  } catch (error) {
    console.error("Error fetching datasets from Cloud SQL:", error);
    throw new Error("Failed to fetch datasets", { cause: error });
  }
}
async function saveReportRecord(userId, question, reportTitle, reportJson) {
  try {
    const result = await db.insert(analysisReports).values({
      userId,
      question,
      reportTitle,
      reportJson: typeof reportJson === "string" ? reportJson : JSON.stringify(reportJson)
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Error saving report to Cloud SQL:", error);
    throw new Error("Failed to save report", { cause: error });
  }
}
async function getUserReports(userId) {
  try {
    return await db.select().from(analysisReports).where(eq(analysisReports.userId, userId)).orderBy(desc(analysisReports.createdAt));
  } catch (error) {
    console.error("Error fetching reports from Cloud SQL:", error);
    throw new Error("Failed to fetch reports", { cause: error });
  }
}
async function savePromptRoutineRecord(userId, title, description, category, promptText) {
  try {
    const result = await db.insert(promptRoutines).values({
      userId,
      title,
      description,
      category: category || "General",
      promptText
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Error saving routine to Cloud SQL:", error);
    throw new Error("Failed to save prompt routine", { cause: error });
  }
}
async function getUserRoutines(userId) {
  try {
    return await db.select().from(promptRoutines).where(eq(promptRoutines.userId, userId)).orderBy(desc(promptRoutines.createdAt));
  } catch (error) {
    console.error("Error fetching routines from Cloud SQL:", error);
    throw new Error("Failed to fetch prompt routines", { cause: error });
  }
}

// server.ts
dotenv.config({ path: [".env.local", ".env"] });
async function getGcpAccessToken() {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" }
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    }
  } catch (err) {
    console.warn(
      "[getGcpAccessToken] Could not fetch token from metadata server:",
      err
    );
  }
  return null;
}
function extractTarInMemory(tarBuffer) {
  const files = {};
  let offset = 0;
  while (offset + 512 <= tarBuffer.length) {
    let isEnd = true;
    for (let i = 0; i < 512; i++) {
      if (tarBuffer[offset + i] !== 0) {
        isEnd = false;
        break;
      }
    }
    if (isEnd) break;
    let name = "";
    for (let i = 0; i < 100; i++) {
      const charCode = tarBuffer[offset + i];
      if (charCode === 0) break;
      name += String.fromCharCode(charCode);
    }
    name = name.trim();
    let sizeStr = "";
    for (let i = 124; i < 136; i++) {
      const charCode = tarBuffer[offset + i];
      if (charCode === 0 || charCode === 32) continue;
      sizeStr += String.fromCharCode(charCode);
    }
    const size = parseInt(sizeStr, 8);
    const typeflag = tarBuffer[offset + 156];
    const isRegularFile = typeflag === 0 || typeflag === 48;
    offset += 512;
    if (name && isRegularFile && !isNaN(size) && size > 0) {
      if (offset + size <= tarBuffer.length) {
        files[name] = tarBuffer.subarray(offset, offset + size);
      }
    }
    const paddedSize = Math.ceil(size / 512) * 512;
    offset += paddedSize;
  }
  return files;
}
function extractEnvironmentId(interaction) {
  if (!interaction || typeof interaction !== "object") return void 0;
  const environment = interaction.environment;
  const candidates = [
    environment?.env_id,
    environment?.environment_id,
    environment?.id,
    environment?.name,
    interaction.environment_id,
    interaction.env_id
  ];
  const value = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim()
  );
  if (typeof value !== "string") return void 0;
  return value.replace(/^environments?\//, "").replace(/^environment-/, "");
}
function extractInteractionId(interaction) {
  if (!interaction || typeof interaction !== "object") return void 0;
  const value = interaction.name || interaction.id || interaction.interaction_id;
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function loadAgentFiles(dir, basePath) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const targetPath = path.posix.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(loadAgentFiles(fullPath, targetPath));
    } else {
      files.push({
        type: "inline",
        content: fs.readFileSync(fullPath, "utf-8"),
        target: targetPath
      });
    }
  }
  return files;
}
var activeGenerations = /* @__PURE__ */ new Map();
function cleanUpOldGenerations() {
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) return;
  const maxAgeMs = 24 * 60 * 60 * 1e3;
  const now = Date.now();
  try {
    const items = fs.readdirSync(outputDir);
    for (const item of items) {
      if (item.startsWith(".")) continue;
      const itemPath = path.join(outputDir, item);
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        const age = now - stats.mtimeMs;
        if (age > maxAgeMs) {
          console.log(
            `[cleanup] Directory ${item} is older than 24 hours (${Math.round(age / 1e3 / 60 / 60)} hrs). Deleting to prevent storage bloat.`
          );
          try {
            fs.rmSync(itemPath, { recursive: true, force: true });
            const zipPath = `${itemPath}.zip`;
            if (fs.existsSync(zipPath)) {
              fs.unlinkSync(zipPath);
            }
          } catch (itemErr) {
            console.error(`[cleanup] Failed to delete ${itemPath}:`, itemErr);
          }
        }
      }
    }
  } catch (err) {
    console.error("[cleanup] Error cleaning up old generations:", err);
  }
}
var app = express();
app.set("trust proxy", 1);
var PORT = Number(process.env.PORT) || 3e3;
async function setupApp() {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // Allowed for inline React Vite dev server
      crossOriginEmbedderPolicy: false
    })
  );
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: "Too many requests from this IP, please try again later." }
  });
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: "AI analysis rate limit exceeded. Please wait a few minutes before running more queries." }
  });
  app.use("/api/", apiLimiter);
  app.use("/api/analyze", aiLimiter);
  app.use("/api/clean-data", aiLimiter);
  app.use("/api/convert-image-to-table", aiLimiter);
  cleanUpOldGenerations();
  const _startupApiKey = process.env.GEMINI_API_KEY;
  if (!_startupApiKey || _startupApiKey.trim() === "" || _startupApiKey === "your_gemini_api_key_here") {
    console.warn("\n\u26A0\uFE0F  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.warn("\u26A0\uFE0F  GEMINI_API_KEY is not set or is a placeholder!");
    console.warn("\u26A0\uFE0F  AI analysis will fail with a 403 PERMISSION_DENIED error.");
    console.warn("\u26A0\uFE0F  Steps to fix:");
    console.warn("\u26A0\uFE0F   1. Get a free key at: https://aistudio.google.com/apikey");
    console.warn("\u26A0\uFE0F   2. Open '.env.local' in your project root");
    console.warn("\u26A0\uFE0F   3. Replace 'your_gemini_api_key_here' with your actual key");
    console.warn("\u26A0\uFE0F   4. Restart the server: npm run dev");
    console.warn("\u26A0\uFE0F  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n");
  } else {
    console.log(`\u2705  GEMINI_API_KEY detected (length: ${_startupApiKey.length})`);
  }
  app.use(express.json({ limit: "50mb" }));
  app.use("/output", express.static(path.join(process.cwd(), "output")));
  app.post("/api/db/user/sync", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!process.env.SQL_HOST) {
        return res.json({ success: true, user: { uid: req.user.uid, email: req.user.email, name: req.user.name }, note: "Local storage mode" });
      }
      const dbUser = await getOrCreateUser(req.user.uid, req.user.email || "", req.user.name);
      return res.json({ success: true, user: dbUser });
    } catch (err) {
      console.warn("Cloud SQL user sync warning (using session user):", err.message || err);
      return res.json({ success: true, user: { uid: req.user?.uid, email: req.user?.email, name: req.user?.name } });
    }
  });
  app.get("/api/db/datasets", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!process.env.SQL_HOST) {
        return res.json({ success: true, datasets: [] });
      }
      const userDatasets = await getUserDatasets(req.user.uid);
      return res.json({ success: true, datasets: userDatasets });
    } catch (err) {
      return res.json({ success: true, datasets: [] });
    }
  });
  app.post("/api/db/datasets", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { fileName, rowCount, columnCount, content } = req.body;
      const record = await saveDatasetRecord(req.user.uid, fileName, rowCount || 0, columnCount || 0, content);
      return res.json({ success: true, dataset: record });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to save dataset" });
    }
  });
  app.get("/api/db/reports", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const reports = await getUserReports(req.user.uid);
      return res.json({ success: true, reports });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to fetch reports" });
    }
  });
  app.post("/api/db/reports", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { question, reportTitle, reportJson } = req.body;
      const record = await saveReportRecord(req.user.uid, question, reportTitle || "Analysis Report", reportJson);
      return res.json({ success: true, report: record });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to save report" });
    }
  });
  app.get("/api/db/routines", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const routines = await getUserRoutines(req.user.uid);
      return res.json({ success: true, routines });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to fetch routines" });
    }
  });
  app.post("/api/db/routines", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { title, description, category, promptText } = req.body;
      const record = await savePromptRoutineRecord(req.user.uid, title, description, category, promptText);
      return res.json({ success: true, routine: record });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to save routine" });
    }
  });
  app.post("/api/cancel-show", (req, res) => {
    const { generationId } = req.body;
    if (generationId && activeGenerations.has(generationId)) {
      console.log(`[cancel-show] Human requested abort for ${generationId}`);
      activeGenerations.get(generationId)?.abort();
      activeGenerations.delete(generationId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Not found or already completed" });
    }
  });
  app.get("/api/download-proxy", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      res.status(400).send("Missing url parameter");
      return;
    }
    try {
      const parsedUrl = new URL(targetUrl);
      if (!parsedUrl.hostname.endsWith("storage.googleapis.com") && !parsedUrl.hostname.endsWith("googleusercontent.com")) {
        res.status(403).send("Forbidden: Domain not allowed");
        return;
      }
      const response = await fetch(targetUrl);
      if (!response.ok) {
        res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        return;
      }
      res.setHeader(
        "Content-Type",
        response.headers.get("Content-Type") || "application/octet-stream"
      );
      res.setHeader("Access-Control-Allow-Origin", "*");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err) {
      console.error("Download proxy failed:", err);
      res.status(500).send(
        `Internal server error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });
  const QUOTA_CACHE_FILE = path.join(
    process.cwd(),
    "output",
    "quota_cache.json"
  );
  const DEFAULT_QUOTA_LIMIT = 999999;
  function getQuotaLimit() {
    const limitStr = process.env.DAILY_QUOTA_LIMIT;
    if (limitStr) {
      const parsed = parseInt(limitStr, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return DEFAULT_QUOTA_LIMIT;
  }
  function getTodayStr() {
    return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  }
  let isFirebaseAdminInitialized = false;
  function ensureFirebaseAdmin() {
  }
  async function getUserHash(req) {
    return "dev-user-hash";
  }
  function getQuotaCount(userHash) {
    if (!userHash) return 0;
    try {
      const outputDir = path.dirname(QUOTA_CACHE_FILE);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      if (fs.existsSync(QUOTA_CACHE_FILE)) {
        const data = fs.readFileSync(QUOTA_CACHE_FILE, "utf-8");
        const cache = JSON.parse(data);
        const cacheKey = `${getTodayStr()}_${userHash}`;
        return cache[cacheKey] || 0;
      }
    } catch (err) {
      console.error("Error reading quota cache:", err);
    }
    return 0;
  }
  function incrementQuotaCount(userHash) {
    if (!userHash) return;
    try {
      const outputDir = path.dirname(QUOTA_CACHE_FILE);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      let cache = {};
      if (fs.existsSync(QUOTA_CACHE_FILE)) {
        try {
          const data = fs.readFileSync(QUOTA_CACHE_FILE, "utf-8");
          cache = JSON.parse(data);
        } catch (e) {
          console.error("Error parsing quota file cache on increment:", e);
        }
      }
      const cacheKey = `${getTodayStr()}_${userHash}`;
      cache[cacheKey] = (cache[cacheKey] || 0) + 1;
      fs.writeFileSync(
        QUOTA_CACHE_FILE,
        JSON.stringify(cache, null, 2),
        "utf-8"
      );
    } catch (err) {
      console.error("Error incrementing quota cache:", err);
    }
  }
  app.get("/api/quota", async (req, res) => {
    if (process.env.NODE_ENV !== "production") {
      return res.json({ used: 0, limit: 999999 });
    }
    const userHash = await getUserHash(req);
    const limit = getQuotaLimit();
    if (!userHash) {
      return res.json({ used: 0, limit });
    }
    const count = getQuotaCount(userHash);
    return res.json({ used: count, limit });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
    // 50MB limit
  });
  const uploadSingle = upload.single("file");
  app.post(
    "/api/upload",
    (req, res, next) => {
      uploadSingle(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({
                error: "File is too large. The maximum allowed size is 50MB."
              });
            }
            return res.status(400).json({ error: `Upload error: ${err.message}` });
          }
          return res.status(500).json({
            error: err.message || "An unknown error occurred during upload."
          });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }
        const MAX_INLINE_SIZE = 1 * 1024 * 1024;
        if (req.file.size > MAX_INLINE_SIZE) {
          return res.status(400).json({
            error: `File "${req.file.originalname}" is ${(req.file.size / (1024 * 1024)).toFixed(2)} MB, which exceeds the 1MB inline limit. For CSV files larger than 1MB, please use the "Paste a GCS URI" option!`
          });
        }
        const content = req.file.buffer.toString("utf-8");
        const safeOriginalName = req.file.originalname.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );
        let gsUri = void 0;
        let url = void 0;
        try {
          const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "default";
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const filename = `uploads/${sessionId}/${uniqueSuffix}-${safeOriginalName}`;
        } catch (gcsErr) {
          console.warn("[api/upload] Optional GCS upload omitted:", gcsErr);
        }
        console.log(
          `[api/upload] Processed inline CSV upload for ${safeOriginalName} (${req.file.size} bytes)`
        );
        return res.json({
          name: req.file.originalname,
          content,
          size: req.file.size,
          gsUri,
          url
        });
      } catch (err) {
        console.error("[api/upload] CSV upload failed:", err);
        res.status(500).json({ error: `Upload failed: ${err.message || err}` });
      }
    }
  );
  async function deleteGcsFiles(files) {
  }
  app.get("/api/download-file", async (req, res) => {
    return res.status(500).send("GCS bucket is not configured on Firebase Admin");
  });
  app.post("/api/clear-files", async (req, res) => {
    return res.json({ success: true });
  });
  app.post("/api/clean-data", async (req, res) => {
    try {
      const { csvContent, fileName, userApprovedOutlierIndices } = req.body;
      if (!csvContent || typeof csvContent !== "string") {
        return res.status(400).json({ error: "Missing csvContent parameter" });
      }
      const result = await cleanDataWithAi(csvContent, fileName || "dataset.csv", userApprovedOutlierIndices);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("[api/clean-data] Error cleaning CSV data:", err);
      return res.status(500).json({ error: err?.message || "Failed to clean dataset with AI" });
    }
  });
  app.post("/api/convert", upload.array("file"), async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No file uploaded for conversion" });
      }
      const conversionType = req.body.type || "pdf-to-excel";
      const userInstruction = req.body.userInstruction || req.body.instruction || "";
      const primaryFile = files[0];
      const extraFiles = files.slice(1);
      const result = await convertFile(
        conversionType,
        primaryFile.buffer,
        primaryFile.originalname,
        extraFiles,
        userInstruction
      );
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      return res.send(result.buffer);
    } catch (err) {
      console.error("[api/convert] Conversion failed:", err);
      return res.status(500).json({ error: `Conversion failed: ${err.message || err}` });
    }
  });
  const uploadImageSingle = upload.single("file");
  app.post(
    "/api/extract-image-table",
    (req, res, next) => {
      uploadImageSingle(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Image upload error: ${err.message}` });
          }
          return res.status(400).json({ error: err?.message || "Failed to upload image file." });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file uploaded" });
        }
        const userInstruction = req.body.instruction || req.body.userInstruction || "";
        const requestedFormat = req.body.format || "auto";
        let format = "excel";
        if (requestedFormat === "word" || requestedFormat === "docx") {
          format = "word";
        } else if (requestedFormat === "excel" || requestedFormat === "xlsx") {
          format = "excel";
        } else {
          const detected = detectRequestedFormat(userInstruction);
          if (detected) {
            format = detected;
          }
        }
        if (requestedFormat === "json") {
          const extraction = await extractTableFromImage(
            req.file.buffer,
            req.file.mimetype || "image/png",
            userInstruction
          );
          return res.json({ success: true, extraction });
        }
        const result = await convertImageToTableFile(
          req.file.buffer,
          req.file.mimetype || "image/png",
          format,
          userInstruction
        );
        const baseName = req.file.originalname.substring(0, req.file.originalname.lastIndexOf(".")) || req.file.originalname;
        const filename = `${baseName}.${result.extension}`;
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(result.buffer);
      } catch (err) {
        console.error("[api/extract-image-table] Extraction failed:", err?.message || err);
        const rawMsg = String(err?.message || err || "");
        let cleanMsg = "Failed to extract table from image.";
        if (rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429") || rawMsg.includes("quota")) {
          cleanMsg = "Gemini AI rate limit or quota reached. Please wait ~20-30 seconds and try again.";
        } else if (rawMsg) {
          cleanMsg = rawMsg;
        }
        return res.status(500).json({ error: cleanMsg });
      }
    }
  );
  app.post("/api/analyze", async (req, res) => {
    cleanUpOldGenerations();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      return res.status(400).json({
        error: "\u26A0\uFE0F Gemini API key is not configured. Open the file '.env.local' in your project root and set GEMINI_API_KEY to your key. Get a free key at https://aistudio.google.com/apikey \u2014 then restart the server."
      });
    }
    const {
      question,
      files,
      datasetName = "Dataset",
      generationId,
      environmentId,
      googleToken,
      preprocessOptions
    } = req.body;
    if (!question || typeof question !== "string" || question.trim() === "") {
      return res.status(400).json({ error: "Missing required field: question" });
    }
    const isFollowUp = !!environmentId;
    const uploadedFiles = Array.isArray(files) ? files.filter(
      (f) => f && typeof f.name === "string" && (typeof f.content === "string" && f.content.trim() !== "" || typeof f.gsUri === "string" && f.gsUri.trim() !== "")
    ) : [];
    if (!isFollowUp && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Provide at least one CSV file." });
    }
    console.log(`[analyze] Skipping daily quota tracking as requested.`);
    const effectiveDatasetName = datasetName;
    const gcsFiles = uploadedFiles.filter((f) => f.gsUri);
    const hasGcsFiles = gcsFiles.length > 0;
    let gcsToken = null;
    let gcsInstructions = "";
    if (hasGcsFiles) {
      gcsToken = await getGcpAccessToken();
      gcsInstructions = `The user uploaded ${gcsFiles.length} file(s) to Google Cloud Storage. First, you MUST run \`python /.agents/download_gcs.py\` to download them to /.agents/data/ before doing anything else.`;
    }
    let prompt = "";
    let preprocessInstructions = "";
    if (preprocessOptions && typeof preprocessOptions === "object") {
      const opts = [];
      if (preprocessOptions.removeDuplicates) opts.push("Remove duplicate rows (e.g., df = df.drop_duplicates())");
      if (preprocessOptions.handleMissing) opts.push("Handle missing values (e.g., fillna or dropna as appropriate)");
      if (opts.length > 0) {
        preprocessInstructions = `
PRE-PROCESSING DATA CLEANING REQUIREMENTS:
The user specified the following data cleaning options: ${opts.join("; ")}. You MUST apply these cleaning steps when reading and processing the dataset CSV(s) in your Python scripts.
`;
      }
    }
    if (isFollowUp) {
      prompt = `You are an expert data analyst continuing an analysis of the dataset "${effectiveDatasetName}".


FOLLOW-UP BUSINESS QUESTION:
${question}


EXECUTE IMMEDIATELY:
- Your first response MUST be one code_execution call. Do not explain, plan, quote these instructions, or print code as text.
- In that one call, discover source files with glob.glob('./workspace/data/*.csv'), clear prior files under data/analysis/ and charts/, analyze the question with Pandas, save result CSVs, and optionally create up to three charts with the existing make_chart.py script.
- Do not delete source CSVs, profile.json, or the existing report.json before the replacement report is ready.
- Do not import seaborn, scipy, statsmodels, or other unlisted packages. Use Pandas, NumPy, and the provided chart script.
- If the data cannot answer the question or analysis fails, write data/analysis/limitations.csv with columns limitation, detail, and required_data.
- ALWAYS finish the same code_execution call by running:
 python3 /.agents/skills/reporting/scripts/build_report.py --workspace ./workspace --question "${question.replace(/"/g, '\\"')}" --dataset-name "${effectiveDatasetName.replace(/"/g, '\\"')}"
- After the tool output contains "Report saved", return one short sentence and make no more tool calls.`;
    } else {
      const fileNames = uploadedFiles.map((f) => f.name).join(", ");
      const dataSourceInstructions = `The user provided ${uploadedFiles.length} CSV file(s). ${gcsInstructions} The files will be located at /.agents/data/. Copy them all into ./workspace/data/ before profiling: \`cp /.agents/data/*.csv ./workspace/data/\`. Provided file(s): ${fileNames}.`;
      prompt = `You are an expert data analyst. Dataset name: "${effectiveDatasetName}".


DATA SOURCE:
${dataSourceInstructions}


BUSINESS QUESTION:
${question}
${preprocessInstructions}


WORKFLOW REQUIREMENT:
You MUST follow this workflow in order. Keep the run short: use one Python script for profiling and one Python script for the requested analysis instead of creating many exploratory scripts. You MUST NOT finish your response until all steps are completed and 'build_report.py' prints that report.json was saved.
HARD LIMIT: You have at most 10 code-execution calls for the entire run. Use one setup call, one combined profiling call, one combined analysis call, up to three chart calls, and one report call. Do not run ad hoc inspection, describe, correlation, validation, package-check, or report-preview commands. Put required calculations into the two scripts. Once build_report.py prints "Report saved", immediately conclude without another tool call.


1. STAGE & SET UP: Create directories, copy the data, and install the core requirements immediately. Do not assume matplotlib is installed:
  mkdir -p ./workspace/data ./workspace/charts ./workspace/data/analysis &&   cp /.agents/data/*.csv ./workspace/data/ &&   pip install -r /.agents/requirements.txt --break-system-packages --prefer-binary --no-cache-dir
  Install scikit-learn separately only if the question genuinely requires an ML model.


2. EXPLORE: Write and run one concise Pandas profiling script that understands the columns and types and writes './workspace/data/profile.json'. The data-explorer skill is agent-driven; there is no profile_data.py supplied by the skill.


3. ANALYZE & SAVE: Write and execute a Python pandas script to perform the data aggregations and calculations needed to answer the question.
  CRITICAL: You MUST save any result tables as CSV files under './workspace/data/analysis/' (e.g., './workspace/data/analysis/streak_data.csv'). Do NOT save files in other folders.


4. VISUALIZE: Create high-quality PNG charts for your findings. Run the visualization script on your saved analysis CSVs:
  python3 /.agents/skills/visualization/scripts/make_chart.py --workspace ./workspace --data data/analysis/<your_csv>.csv --type <bar|line|scatter|pie|heatmap> --x <col> --y <col> --title "<Chart Title>" --output charts/<chart_name>.png


5. BUILD REPORT: Compile everything into the final interactive report JSON by running:
  python3 /.agents/skills/reporting/scripts/build_report.py --workspace ./workspace --question "${question.replace(/"/g, '\\"')}" --dataset-name "${effectiveDatasetName.replace(/"/g, '\\"')}"


CRITICAL RULE FOR RE-ENTRANCY & COMPLETION:
The frontend UI depends 100% on './workspace/data/report.json' to render the charts and tables on the screen. If you output your final textual response or stop calling tools before running step 5 (build_report.py), the user will see a completely blank dashboard!
Therefore, please make sure to run both 'make_chart.py' and 'build_report.py' successfully in the sandbox before concluding your turn.


*SANDBOX TOOL TIP:* Since you run in a Python code_execution sandbox, you should run all shell commands (like directory creation, make_chart.py, or build_report.py scripts) by prefixing them with a "!" in your code cells or by using Python's 'os.system()' or 'subprocess' modules. Do not output plain bash commands or hallucinate external tool calls.


Example of the required execution order:
\`\`\`python
import os
# Stage data and install core dependencies first
os.system("mkdir -p ./workspace/data ./workspace/charts ./workspace/data/analysis && cp /.agents/data/*.csv ./workspace/data/ && pip install -r /.agents/requirements.txt --break-system-packages --prefer-binary --no-cache-dir")


# Explore and profile using Pandas here, then write ./workspace/data/profile.json directly.
# Do not call a nonexistent profiling helper script.


# Analyze & Save CSV
import pandas as pd
df = pd.read_csv('./workspace/data/...')
# ... perform calculations ...
df.to_csv('./workspace/data/analysis/results.csv', index=False)


# Visualize PNG chart
os.system("python3 /.agents/skills/visualization/scripts/make_chart.py --workspace ./workspace --data data/analysis/results.csv --type bar --x col1 --y col2 --title 'Title' --output charts/my_chart.png")


# Compile report immediately after charts (deterministic and network-free)
os.system("""python3 /.agents/skills/reporting/scripts/build_report.py --workspace ./workspace --question "${question.replace(/"/g, '\\"')}" --dataset-name "${effectiveDatasetName.replace(/"/g, '\\"')}" """)
\`\`\``;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const sendEvent = (event) => {
      res.write(`data: ${JSON.stringify(event)}

`);
    };
    let reportDelivered = false;
    let streamFailed = false;
    const sendError = (message) => {
      streamFailed = true;
      sendEvent({ type: "error", message });
    };
    let sentSessionEnvironmentId;
    const sendSessionEnvironment = (environmentIdValue) => {
      if (!environmentIdValue || environmentIdValue === sentSessionEnvironmentId)
        return;
      sentSessionEnvironmentId = environmentIdValue;
      sendEvent({ type: "session", environmentId: environmentIdValue });
    };
    sendSessionEnvironment(
      typeof environmentId === "string" ? environmentId : void 0
    );
    const heartbeatInterval = setInterval(() => {
      res.write(`:

`);
    }, 15e3);
    let isFinished = false;
    const abortController = new AbortController();
    if (generationId) {
      activeGenerations.set(generationId, abortController);
    }
    req.on("aborted", () => {
      if (!isFinished) {
        console.log(
          `[analyze] Client aborted request. Agent will continue running in background unless explicitly cancelled.`
        );
      }
      clearInterval(heartbeatInterval);
    });
    req.on("close", () => {
      clearInterval(heartbeatInterval);
    });
    try {
      let agentFiles = [];
      if (isFollowUp) {
        console.log(
          `[analyze] Continuing session in active environment: "${environmentId}" without interaction chaining.`
        );
        sendEvent({
          type: "info",
          message: "Continuing session in active environment..."
        });
      } else {
        console.log(
          `[analyze] Request received. dataset: "${effectiveDatasetName}", source: ${uploadedFiles.length} uploaded file(s), question: "${question.substring(0, 80)}...", generationId: "${generationId}"`
        );
        console.log(
          `[analyze] GEMINI_API_KEY presence verified: ${!!process.env.GEMINI_API_KEY}`
        );
        sendEvent({
          type: "info",
          message: "Provisioning analysis environment..."
        });
        console.log(
          `[analyze] Loading agent files from filesystem path: ${path.join(process.cwd(), "agent")}`
        );
        agentFiles = loadAgentFiles(
          path.join(process.cwd(), "agent"),
          "/.agents"
        );
        uploadedFiles.forEach((f) => {
          const safeName = path.posix.basename(f.name).replace(/[^a-zA-Z0-9._-]/g, "_");
          if (f.content) {
            agentFiles.push({
              type: "inline",
              content: f.content,
              target: `/.agents/data/${safeName}`
            });
          } else if (f.gsUri) {
            agentFiles.push({
              type: "gcs",
              source: f.gsUri,
              target: "/.agents/data"
            });
          }
        });
        if (hasGcsFiles) {
          const protocol = req.headers["x-forwarded-proto"] || "http";
          const host = req.headers.host || "localhost:3000";
          const serverUrl = `${protocol}://${host}`;
          const gcsFilesToDownload = gcsFiles.map((f) => {
            const safeName = path.posix.basename(f.name).replace(/[^a-zA-Z0-9._-]/g, "_");
            let gcsPath = "";
            const uri = f.gsUri || "";
            if (uri.startsWith("gs://")) {
              const parts = uri.slice(5).split("/", 1);
              gcsPath = uri.slice(5 + parts[0].length + 1);
            }
            return {
              source: f.gsUri,
              filename: gcsPath,
              target: `/.agents/data/${safeName}`
            };
          });
          const gcsDownloadScript = `
import urllib.request
import urllib.parse
import os


files = [
${gcsFilesToDownload.map((f) => `    {"source": "${f.source}", "filename": "${f.filename}", "target": "${f.target}"}`).join(",\n")}
]


server_url = "${serverUrl}"
token = ${gcsToken ? `"${gcsToken}"` : "None"}
os.makedirs("/.agents/data", exist_ok=True)


for f in files:
   filename = f["filename"]
   # 1. First attempt: Download via the secure local Express download proxy (works without direct GCS access or public permission)
   proxy_url = f"{server_url}/api/download-file?filename={urllib.parse.quote(filename)}"
   print(f"Attempting download for {filename} via proxy: {proxy_url}")
   try:
       req = urllib.request.Request(proxy_url)
       with urllib.request.urlopen(req) as response, open(f["target"], "wb") as out:
           out.write(response.read())
       print(f"Successfully downloaded {filename} via Express proxy")
       continue
   except Exception as proxy_err:
       print(f"Express proxy download failed: {proxy_err}. Falling back to direct GCS download...")


   # 2. Second attempt / fallback: Direct GCS API download
   uri = f["source"]
   if uri.startswith("gs://"):
       parts = uri[5:].split("/", 1)
       bucket = parts[0]
       obj = parts[1]
       encoded_obj = urllib.parse.quote(obj)
       url_json = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{encoded_obj}?alt=media"
       url_xml = f"https://storage.googleapis.com/{bucket}/{encoded_obj}"
      
       success = False
       for url in [url_json, url_xml]:
           req = urllib.request.Request(url)
           if token:
               req.add_header("Authorization", "Bearer " + token)
           try:
               with urllib.request.urlopen(req) as response, open(f["target"], "wb") as out:
                   out.write(response.read())
               print(f"Successfully downloaded {f['source']} from {url}")
               success = True
               break
           except Exception as e:
               print(f"Failed download from {url}: {e}")
       if not success:
           print(f"Failed all download attempts for {f['source']}")
`;
          agentFiles.push({
            type: "inline",
            content: gcsDownloadScript,
            target: `/.agents/download_gcs.py`
          });
        }
        console.log(
          `[analyze] Finished loading agent files (source: ${uploadedFiles.length} uploaded file(s)). Count: ${agentFiles.length}`
        );
      }
      if (!gcsToken) {
        gcsToken = await getGcpAccessToken();
      }
      console.log(
        `[analyze] Retrieved GCS access token: ${gcsToken ? "yes (length: " + gcsToken.length + ")" : "no"}`
      );
      console.log(
        `[analyze] Calling createInteraction with prompt: "${prompt.substring(0, 100)}..."`
      );
      const response = await createInteraction({
        prompt,
        stream: true,
        inlineSources: isFollowUp ? void 0 : agentFiles.length > 0 ? agentFiles : void 0,
        environmentId: isFollowUp ? environmentId : void 0,
        gcsToken: gcsToken || void 0,
        signal: abortController.signal
      });
      console.log(
        `[analyze] Gemini API responded. HTTP Status: ${response.status} ${response.statusText}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[analyze] Gemini API Non-2xx response. Error Payload: ${errorText}`
        );
        let displayMessage = `Agent API error: ${response.status} - ${errorText}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.error?.message) {
            displayMessage = parsed.error.message;
          }
        } catch (e) {
        }
        const isQuotaError = response.status === 429 || errorText.toLowerCase().includes("quota") || errorText.toLowerCase().includes("too_many_requests") || errorText.toLowerCase().includes("resource_exhausted") || displayMessage.toLowerCase().includes("quota") || displayMessage.toLowerCase().includes("too_many_requests");
        const isEnvNotFoundError = response.status === 404 || errorText.toLowerCase().includes("not_found") || errorText.toLowerCase().includes("environment not found") || displayMessage.toLowerCase().includes("environment not found") || displayMessage.toLowerCase().includes("not found or not accessible");
        const isAuthError = response.status === 403 || response.status === 401 || errorText.toLowerCase().includes("permission_denied") || errorText.toLowerCase().includes("unregistered callers") || errorText.toLowerCase().includes("api key") || displayMessage.toLowerCase().includes("permission_denied");
        if (isQuotaError) {
          displayMessage = `Gemini API Quota Limit Reached. The API key has run out of free-tier quota. Please wait a moment or get a new key at https://aistudio.google.com/apikey and update GEMINI_API_KEY in your .env.local file.`;
        } else if (isAuthError) {
          displayMessage = `\u26A0\uFE0F Gemini API key is invalid or missing. Open '.env.local' in your project root, set GEMINI_API_KEY to a valid key (get one free at https://aistudio.google.com/apikey), then restart the server with 'npm run dev'.`;
        } else if (isEnvNotFoundError) {
          displayMessage = `The previous analysis session has expired or the remote environment has been recycled due to inactivity. Please start a fresh analysis session by uploading your CSV files again.`;
        }
        sendError(displayMessage);
        res.end();
        return;
      }
      console.log(
        `[analyze] Response remains ok. Constructing SSE stream reader...`
      );
      let accumulatedText = "";
      let envId = environmentId;
      let interactionId;
      let reportArtifactReady = false;
      let eventCount = 0;
      for await (const event of streamInteraction(response)) {
        eventCount++;
        console.log(
          `[analyze] SSE yields streaming event #${eventCount}: type="${event.type}"`
        );
        if (event.type === "done") {
          console.log(
            `[analyze] Received explicit "done" marker from interaction stream.`
          );
          break;
        }
        if (event.type === "interaction") {
          envId = extractEnvironmentId(event.interaction) || envId;
          interactionId = extractInteractionId(event.interaction) || interactionId;
          sendSessionEnvironment(envId);
          console.log(
            `[analyze] Interaction created. Environment ID: "${envId}", interaction ID: "${interactionId}"`
          );
        }
        if (event.type === "complete") {
          envId = extractEnvironmentId(event.interaction) || envId;
          interactionId = extractInteractionId(event.interaction) || interactionId;
          sendSessionEnvironment(envId);
          console.log(
            `[analyze] Interaction completed. Extracted environment ID: "${envId}"`
          );
          const usage = event.interaction?.usage;
          if (usage) {
            console.log(
              `[agent] Token usage: ${usage.total_tokens} total tokens (${usage.total_input_tokens} input, ${usage.total_output_tokens} output, ${usage.total_thought_tokens || 0} thought, ${usage.total_cached_tokens || 0} cached)`
            );
          }
          const stepsObj = event.interaction?.steps;
          if (Array.isArray(stepsObj)) {
            let combinedStepsText = "";
            for (const step of stepsObj) {
              const isReasoningStep = step.type === "thinking" || step.type === "thought" || step.type === "reasoning";
              if (!isReasoningStep && Array.isArray(step.content)) {
                for (const part of step.content) {
                  if (part && typeof part === "object") {
                    if (part.type === "text" && part.text) {
                      combinedStepsText += part.text;
                    } else if (part.text && part.type !== "thought") {
                      combinedStepsText += part.text;
                    }
                  } else if (typeof part === "string") {
                    combinedStepsText += part;
                  }
                }
              }
            }
            if (combinedStepsText && combinedStepsText.length > accumulatedText.length) {
              console.log(
                `[analyze] Dynamic steps recovery: Reconstructed text of length ${combinedStepsText.length} exceeds accumulated text of length ${accumulatedText.length}. Restoring fallback text.`
              );
              accumulatedText = combinedStepsText;
            }
          }
        }
        if (event.type === "thinking")
          console.log(
            `[agent] thinking delta: ${event.text?.substring(0, 30)}...`
          );
        else if (event.type === "tool_call") {
          console.log(`[agent] tool_call: ${event.name}`);
          console.log(
            `[agent] args:`,
            JSON.stringify(event.arguments, null, 2)
          );
        } else if (event.type === "tool_result") {
          console.log(`[agent] tool_result for tool: ${event.name}`);
          if (event.result?.includes("Report saved to") && event.result.includes("report.json")) {
            reportArtifactReady = true;
            console.log(
              "[analyze] Agent confirmed report.json was saved in the sandbox."
            );
          }
        } else if (event.type === "text") {
          console.log(
            `[agent] text output segment: ${event.text?.substring(0, 30)}...`
          );
        }
        sendEvent(event);
        if (event.type === "text" && event.text) {
          accumulatedText += event.text;
        }
        if (reportArtifactReady && envId) {
          console.log(
            "[analyze] report.json is ready; stopping stream consumption and retrieving the sandbox snapshot."
          );
          break;
        }
      }
      if (!envId && interactionId) {
        try {
          const interactionPath = interactionId.startsWith("interactions/") ? interactionId : `interactions/${interactionId}`;
          const interactionRes = await fetch(
            `${API_BASE_URL}/${interactionPath}`,
            {
              headers: {
                "x-goog-api-key": process.env.GEMINI_API_KEY || "",
                "Api-Revision": "2026-05-20",
                "x-goog-api-client": "applet-ai-data-analyst/1.0.0"
              }
            }
          );
          if (interactionRes.ok) {
            const interactionData = await interactionRes.json();
            envId = extractEnvironmentId(interactionData);
            sendSessionEnvironment(envId);
            console.log(
              `[analyze] Recovered environment ID from interaction resource: "${envId}"`
            );
          } else {
            console.warn(
              `[analyze] Could not recover interaction metadata: ${interactionRes.status} ${interactionRes.statusText}`
            );
          }
        } catch (metadataErr) {
          console.warn(
            "[analyze] Interaction metadata recovery failed:",
            metadataErr
          );
        }
      }
      if (accumulatedText) {
        try {
          const blocks = extractJsonBlocks(accumulatedText);
          const reportBlock = blocks.reverse().find(
            (b) => b && typeof b === "object" && (b.executive_summary || b.insights || b.title)
          );
          if (reportBlock) {
            reportDelivered = true;
            sendEvent({ type: "report_data", data: reportBlock });
          }
        } catch (e) {
          console.error(
            "Failed to parse JSON blocks fallback from accumulated text:",
            e
          );
        }
      }
      if (envId) {
        sendEvent({
          type: "info",
          message: reportArtifactReady ? "Report created. Retrieving dashboard files..." : "Retrieving report and charts from the analysis environment..."
        });
        try {
          const downloadUrl = `${API_BASE_URL}/files/environment-${envId}:download?alt=media`;
          let res2 = null;
          for (let attempt = 1; attempt <= 5; attempt++) {
            res2 = await fetch(downloadUrl, {
              headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "" }
            });
            if (res2.ok || ![404, 409, 425].includes(res2.status) || attempt === 5)
              break;
            console.log(
              `[analyze] Environment snapshot not ready (attempt ${attempt}/5). Retrying...`
            );
            await new Promise((resolve) => setTimeout(resolve, attempt * 1e3));
          }
          if (res2?.ok) {
            const arrayBuffer = await res2.arrayBuffer();
            const tarBuffer = Buffer.from(arrayBuffer);
            const extractedFiles = extractTarInMemory(tarBuffer);
            let report = null;
            const chartImages = {};
            let runId = "gen-" + Math.random().toString(36).substring(2, 10);
            if (typeof generationId === "string" && /^[A-Za-z0-9_-]+$/.test(generationId)) {
              runId = generationId;
            }
            const outputDirRoot = path.join(process.cwd(), "output");
            let chartRunDir = path.join(outputDirRoot, runId, "charts");
            if (fs.existsSync(chartRunDir)) {
              runId = `${runId}-${Date.now()}`;
              chartRunDir = path.join(outputDirRoot, runId, "charts");
            }
            fs.mkdirSync(chartRunDir, { recursive: true });
            for (const [filePath, fileContent] of Object.entries(
              extractedFiles
            )) {
              const normalized = filePath.replace(/^\.\//, "");
              if (normalized.endsWith("data/report.json") || normalized.endsWith("/report.json") || normalized === "report.json") {
                try {
                  report = JSON.parse(fileContent.toString("utf8"));
                } catch (err) {
                  console.error(
                    "Failed to parse report.json from memory:",
                    err
                  );
                }
              } else if (normalized.includes("charts/") && /\.(png|jpg|jpeg)$/i.test(normalized)) {
                let base = normalized.split("/").pop();
                if (!/^[A-Za-z0-9_.-]+\.(png|jpe?g)$/i.test(base)) {
                  const ext = base.split(".").pop() || "png";
                  base = `chart-${Object.keys(chartImages).length + 1}.${ext}`;
                }
                const targetFilePath = path.join(chartRunDir, base);
                try {
                  fs.writeFileSync(targetFilePath, fileContent);
                  chartImages[base] = `/output/${runId}/charts/${base}`;
                } catch (writeErr) {
                  console.error(`Failed to write chart ${base} to disk:`, writeErr);
                }
              }
            }
            const reportMatchesCurrentQuestion = typeof report?.question === "string" && report.question.trim().toLowerCase() === question.trim().toLowerCase();
            if (isFollowUp && !reportArtifactReady && !reportMatchesCurrentQuestion) {
              console.warn(
                "[analyze] Follow-up stream ended without producing a replacement report. Preserving the existing dashboard."
              );
              sendError(
                "The follow-up analysis stopped before it could update the dashboard. Your previous report has been preserved; please try the question again."
              );
              return;
            }
            if (!report) {
              console.log(
                "[analyze] report.json was not found in the tar archive. Generating server-side fallback report..."
              );
              const displayTables = [];
              for (const [filePath, fileContent] of Object.entries(
                extractedFiles
              )) {
                const normalized = filePath.replace(/^\.\//, "");
                if (normalized.endsWith(".csv") && !normalized.includes("data/report.json")) {
                  try {
                    const csvText = fileContent.toString("utf8");
                    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
                    if (lines.length > 0) {
                      const headers = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, ""));
                      const rows = lines.slice(1, 21).map((line) => {
                        return line.split(",").map((val) => val.replace(/^["']|["']$/g, ""));
                      });
                      const filename = normalized.split("/").pop() || "table.csv";
                      const title = filename.replace(/\.csv$/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      displayTables.push({
                        title,
                        columns: headers,
                        rows,
                        caption: `Generated data table: ${filename}`
                      });
                    }
                  } catch (csvErr) {
                    console.error(
                      `Failed to parse csv fallback for ${normalized}:`,
                      csvErr
                    );
                  }
                }
              }
              if (displayTables.length > 0 || Object.keys(chartImages).length > 0 || accumulatedText) {
                let summary = "The data analyst has finished processing your calculations.";
                if (accumulatedText) {
                  summary = accumulatedText.replace(/```json[\s\S]*?```/g, "").trim();
                  if (summary.length > 500) {
                    summary = summary.substring(0, 500) + "...";
                  }
                }
                report = {
                  dataset_name: effectiveDatasetName || "Dataset",
                  question,
                  title: `Analysis Report: ${effectiveDatasetName || "Dataset"}`,
                  executive_summary: summary,
                  insights: [
                    {
                      title: "Calculations Completed",
                      detail: "The analysis successfully completed the necessary Python computations. Explore the generated data tables and supporting documents below.",
                      metric: "Status",
                      value: "Success"
                    }
                  ],
                  charts: [],
                  tables: displayTables,
                  methodology: "Computed using Pandas inside the sandboxed data analyst workspace.",
                  recommendations: [
                    "Review the structured output tables and charts below for specific metrics."
                  ],
                  generated_at: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
                };
              }
            }
            if (report) {
              if (Array.isArray(report.charts)) {
                for (const chart of report.charts) {
                  if (chart && typeof chart === "object" && typeof chart.file === "string") {
                    const base = chart.file.split("/").pop();
                    if (chartImages[base]) {
                      chart.image = chartImages[base];
                    }
                  }
                }
              }
              const referenced = new Set(
                (Array.isArray(report.charts) ? report.charts : []).map(
                  (c) => typeof c?.file === "string" ? c.file.split("/").pop() : null
                ).filter(Boolean)
              );
              const extras = Object.keys(chartImages).filter((base) => !referenced.has(base)).map((base) => ({
                title: base.replace(/\.[^.]+$/, "").replace(/_/g, " "),
                file: `charts/${base}`,
                caption: "",
                type: "bar",
                image: chartImages[base]
              }));
              if (extras.length > 0) {
                report.charts = [
                  ...Array.isArray(report.charts) ? report.charts : [],
                  ...extras
                ];
              }
              reportDelivered = true;
              sendEvent({ type: "report_data", data: report });
            } else {
              console.error(
                "report.json was not found in the extracted tar archive"
              );
              sendError("The analysis ran but report.json was not produced.");
            }
          } else {
            const errBody = res2 ? await res2.text() : "No response received";
            console.error("Failed to download snapshot:", errBody);
            let displayMessage = `Failed to retrieve files from the analysis environment: ${errBody}`;
            try {
              const parsed = JSON.parse(errBody);
              if (parsed?.error?.message) {
                const msg = parsed.error.message.toLowerCase();
                if (msg.includes("not found") || msg.includes("not accessible")) {
                  displayMessage = "The previous analysis session has expired or the remote environment has been recycled due to inactivity. Please start a fresh analysis session by uploading your CSV files again.";
                } else {
                  displayMessage = parsed.error.message;
                }
              }
            } catch (e) {
              if (errBody.toLowerCase().includes("not found") || errBody.toLowerCase().includes("not accessible")) {
                displayMessage = "The previous analysis session has expired or the remote environment has been recycled due to inactivity. Please start a fresh analysis session by uploading your CSV files again.";
              }
            }
            sendError(displayMessage);
          }
        } catch (err) {
          console.error("Error processing snapshot in memory:", err);
          sendError(`Error extracting analysis files: ${err.message}`);
        }
      }
      isFinished = true;
      if (!reportDelivered && !streamFailed) {
        sendError(
          "The analysis stream ended before a dashboard report was produced."
        );
      }
      if (reportDelivered && !streamFailed) {
        sendEvent({ type: "status", status: "completed" });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log(`[analyze] Agent interaction aborted successfully.`);
      } else {
        console.error(`[analyze] Error:`, err);
        sendError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      isFinished = true;
      clearInterval(heartbeatInterval);
      if (generationId) {
        activeGenerations.delete(generationId);
      }
      res.end();
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    const indexHtmlExists = fs.existsSync(path.join(distPath, "index.html"));
    if (process.env.NODE_ENV !== "production" || !indexHtmlExists) {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "Production mode enabled, but dist/index.html not found. Falling back to Vite dev server middleware."
        );
      }
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
    const startListening = (port) => {
      const server = app.listen(port, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${port}`);
      }).on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, retrying in 1s...`);
          setTimeout(() => startListening(port), 1e3);
        } else {
          console.error(err);
        }
      });
      server.setTimeout(0);
      server.requestTimeout = 0;
      server.headersTimeout = 0;
      server.keepAliveTimeout = 0;
    };
    startListening(PORT);
  }
}
var setupError = null;
var setupPromise = setupApp().catch((err) => {
  console.error("[FATAL] setupApp() failed:", err);
  setupError = err;
});
async function handler(req, res) {
  try {
    await setupPromise;
    if (setupError) {
      return res.status(500).json({
        error: "Server initialization failed",
        details: setupError.message
      });
    }
    return app(req, res);
  } catch (err) {
    console.error("[handler] Unhandled error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}
export {
  app,
  handler as default
};
