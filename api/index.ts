import handler from "../server";

export default async function (req: any, res: any) {
  try {
    return await handler(req, res);
  } catch (err: any) {
    return res.status(500).json({
      error: "API Handler Exception",
      message: err?.message || String(err),
      stack: err?.stack || null
    });
  }
}
