import express from "express";

const app = express();

app.get("/api/test", (req, res) => {
  res.json({ status: "express ok" });
});

export default async function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
