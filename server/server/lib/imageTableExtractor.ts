import { GoogleGenAI } from "@google/genai";
import {
  ExtractionResult,
  OutputFormat,
  generateFileFromExtraction,
} from "./generate-table-file.ts";

export async function extractTableFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/png",
  userInstruction: string = ""
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const systemInstruction = `You are a document-to-table extraction assistant. You will be given an image that
contains tabular or list-like data — this could be a printed table, a handwritten
list, a receipt, an invoice, a screenshot of a spreadsheet, or a form. Your job is to
read everything relevant in the image and convert it into clean structured JSON.

RULES:
1. Identify the most sensible column headers from the image. If the image has no
   explicit headers (e.g. a handwritten list), infer reasonable column names from
   context (e.g. "Item", "Quantity", "Price").
2. Extract every row you can read. If a value is illegible or missing, use null —
   never invent a value you cannot actually read in the image.
3. Preserve numbers as numbers (not strings) where the column is clearly numeric
   (price, quantity, totals, dates as ISO strings where a date is unambiguous).
4. If the user gave a sorting or grouping instruction along with the image (e.g.
   "sort by price", "group by category"), apply it by ordering the \`rows\` array
   accordingly — do not silently ignore it, and do not apply a sort the user
   didn't ask for.
5. If the image contains multiple distinct tables, return them as separate entries
   in the \`tables\` array, each with its own title guess.
6. If the image quality is too poor to extract anything reliably, set
   \`extraction_confidence\` to "low" and explain why in \`notes\` — do not fabricate
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

  const promptText = userInstruction.trim()
    ? `User Instruction: ${userInstruction}`
    : "Extract all tabular and list data from this image into structured JSON format.";

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.6-flash",
  ];

  let response: any = null;
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: baseMimeType,
              data: imageBase64,
            },
          },
          promptText,
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[imageTableExtractor] Model ${model} failed:`, errMsg);
      if (
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429") ||
        errMsg.includes("quota")
      ) {
        // Rate limit hit on this specific model quota, proceed to try next candidate model
        continue;
      }
      // Continue to next model on other errors as well
      continue;
    }
  }

  if (!response || !response.text) {
    const errString = String(lastError?.message || lastError || "");
    if (
      errString.includes("RESOURCE_EXHAUSTED") ||
      errString.includes("429") ||
      errString.includes("quota")
    ) {
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

  let result: ExtractionResult;
  try {
    result = JSON.parse(cleanedJson) as ExtractionResult;
  } catch (err) {
    console.error("[imageTableExtractor] Failed to parse JSON response:", responseText);
    throw new Error("Failed to parse extracted table JSON from image.");
  }

  // Ensure default fallback structures if model missed any key
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

export async function convertImageToTableFile(
  imageBuffer: Buffer,
  mimeType: string,
  format: OutputFormat,
  userInstruction: string = ""
) {
  const extraction = await extractTableFromImage(imageBuffer, mimeType, userInstruction);
  const fileResult = await generateFileFromExtraction(extraction, format);

  return {
    ...fileResult,
    extraction,
  };
}
