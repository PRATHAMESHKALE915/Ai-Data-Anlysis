export default async function handler(req, res) {
  try {
    const mod = await import("./index.js");
    // Standard handler resolution
    const target = mod.default || mod;
    return target(req, res);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 10),
    });
  }
}
