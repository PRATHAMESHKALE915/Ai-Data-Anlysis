const handler = require("./index.js");

module.exports = async function(req, res) {
  try {
    // If it's exported as a default object/fn
    const target = handler.default || handler;
    return target(req, res);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 10),
    });
  }
};
