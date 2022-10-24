const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const { appPort, dbUrl } = require("./config/app");

const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");
const { errorHandler } = require("./handler/error");

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
  next();
});

app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

app.use(errorHandler);

mongoose
  .connect(dbUrl)
  .then((result) => {
    const server = app.listen(appPort);
    const io = require("socket.io")(server);

    io.on("connection", (socket) => {
      console.log("Client connected");
    });
  })
  .catch((error) => {
    console.log(error);
  });
