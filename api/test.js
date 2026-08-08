export default function handler(req, res) {
  res.status(200).json({ status: "ok", format: "esm", time: new Date().toISOString() });
}
