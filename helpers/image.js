const fs = require("fs");
const path = require("path");

exports.clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};

exports.clearPath = (filePath) => {
  return filePath.replace("\\", "/").replace("\\", "/");
};
