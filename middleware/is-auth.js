const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/app");

module.exports = (req, res, next) => {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    const error = new Error("Not authenticated.");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];

  let decodeToken;

  try {
    decodeToken = jwt.verify(token, jwtSecret);
  } catch (error) {
    error.statusCode = 500;
    throw error;
  }

  if (!decodeToken) {
    const errors = new Error("Not authenticated.");
    errors.statusCode = 401;
    throw errors;
  }

  req.userId = decodeToken.userId;
  next();
};
