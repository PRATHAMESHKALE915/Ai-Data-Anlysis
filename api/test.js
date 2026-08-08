module.exports = function(req, res) {
  res.status(200).json({ status: "ok", format: "cjs", time: new Date().toISOString() });
};
