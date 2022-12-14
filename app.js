const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const graphqlHttp = require("express-graphql").graphqlHTTP;

const { appPort, dbUrl } = require("./config/app");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolver");
const { errorHandler } = require("./handler/error");
const authMiddelawre = require("./middleware/auth");
const { clearPath, clearImage } = require("./helpers/image");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images/");
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  cb(
    null,
    ["image/png", "image/jpg", "image/jpeg", "image/webp"].includes(
      file.mimetype
    )
  );
};

app.use(bodyParser.json()); // application/json
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/public/images/",
  express.static(path.join(__dirname, "public", "images"))
);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(authMiddelawre);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    const error = new Error("Not authenticated");
    error.code = 401;
    throw error;
  }

  if (!req.file) {
    return res.status(200).json({ message: "No file provided" });
  }

  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }

  const filePath = clearPath(req.file.path);
  return res.json({
    message: "File stored",
    filePath: filePath,
  });
});

app.use(
  "/graphql",
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError: (err) => {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message;
      const code = err.originalError.code || 500;

      return {
        message: message,
        status: code,
        data: data,
      };
    },
  })
);
app.use(errorHandler);

mongoose
  .connect(dbUrl)
  .then((result) => {
    app.listen(appPort);
  })
  .catch((error) => {
    console.log(error);
  });
