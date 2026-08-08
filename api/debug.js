export default async function handler(req, res) {
  try {
    const mod = await import("./index.js");
    if (mod.default) {
      return mod.default(req, res);
    }
    return res.status(500).json({ error: "No default export in api/index.js" });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 10),
    });
  }
}
