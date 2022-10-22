const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { jwtSecret } = require("../config/app");
const User = require("../models/user");

exports.register = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("validation failed, entered data is incorrect.");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  const { name, email, password } = req.body;

  bcrypt
    .hash(password, 12)
    .then((hashedPass) => {
      const user = new User({
        name: name,
        email: email,
        password: hashedPass,
      });
      return user.save();
    })
    .then((result) => {
      res
        .status(201)
        .json({ message: "User register successfully", userId: result._id });
    })
    .catch((error) => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
};

exports.login = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("validation failed, entered data is incorrect.");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const { email, password } = req.body;
  let loaderUser;

  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        const error = new Error("A user with this email could not be found.");
        error.statusCode = 401;
        throw error;
      }
      loaderUser = user;
      return bcrypt.compare(password, loaderUser.password);
    })
    .then((isEqual) => {
      if (!isEqual) {
        const error = new Error("Email or password is incorrect.");
        error.statusCode = 401;
        throw error;
      }
      const token = jwt.sign(
        {
          email: loaderUser.email,
          userId: loaderUser._id.toString(),
        },
        jwtSecret,
        { expiresIn: "1h" }
      );
      res.status(200).json({ token: token, userId: loaderUser._id.toString() });
    })
    .catch((error) => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
};

exports.updateUserStatus = (req, res, next) => {
  const userId = req.userId;
  const status = req.body.status;

  User.findById(userId)
    .then((user) => {
      if (!user) {
        const error = new Error(`Not authorization`);
        error.statusCode = 403;
        throw error;
      }
      user.status = status;
      return user.save();
    })
    .then((result) => {
      res.json({ message: "Status updated successfully!" });
    })
    .catch((error) => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
};
