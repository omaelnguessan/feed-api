const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const { jwtSecret } = require("../config/app");
const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../helpers/image");

module.exports = {
  createUser: async ({ userInput }, req) => {
    const errors = [];

    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "E-mail is invalid." });
    }

    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password is short." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User exists already!");
      throw error;
    }

    const hasedPassword = await bcrypt.hash(userInput.password, 12);

    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hasedPassword,
    });

    const createdUser = await user.save();

    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
    };
  },

  login: async ({ email, password }, req) => {
    const errors = [];

    if (!validator.isEmail(email)) {
      errors.push({ message: "E-mail is invalid." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error("User not found!");
      error.code = 401;
      throw error;
    }

    const verif = await bcrypt.compare(password, user.password);

    if (!verif) {
      const error = new Error("Invalid email or password");
      error.code = 403;
      throw error;
    }

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      jwtSecret,
      { expiresIn: "1h" }
    );

    return {
      userId: user._id.toString(),
      token: token,
    };
  },

  createPost: async ({ postInput }, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const errors = [];

    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 3 })
    ) {
      errors.push({ message: "Title is invalid." });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 3 })
    ) {
      errors.push({ message: "Content is invalid." });
    }

    if (validator.isEmpty(postInput.imageUrl)) {
      errors.push({ message: "file is invalid." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("Invalid user");
      error.data = errors;
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title: postInput.title,
      imageUrl: postInput.imageUrl,
      content: postInput.content,
      creator: user,
    });

    const createPost = await post.save();
    user.posts.push(createPost);

    await user.save();

    return {
      ...createPost._doc,
      _id: createPost._id.toString(),
      createdAt: createPost.createdAt.toString(),
      updatedAt: createPost.updatedAt.toString(),
    };
  },

  getPosts: async ({ page }, req) => {
    const perPage = 2;
    console.log(req.isAuth);
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const currentPage = page || 1;
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalItems,
    };
  },

  getPost: async ({ postId }, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    if (!post) {
      const error = new Error(`Post with id ${postId} Not found`);
      error.statusCode = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  updatePost: async ({ postId, postInput }, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const errors = [];

    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 3 })
    ) {
      errors.push({ message: "Title is invalid." });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 3 })
    ) {
      errors.push({ message: "Content is invalid." });
    }

    if (validator.isEmpty(postInput.imageUrl)) {
      errors.push({ message: "file is invalid." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    if (!post) {
      const error = new Error(`Post with id ${postId} Not found`);
      error.statusCode = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error(
        `Not authorization for edit Post with id ${postId}`
      );
      error.statusCode = 403;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;
    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }

    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  deletePost: async ({ postId }, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    if (!post) {
      const error = new Error(`Post with id ${postId} Not found`);
      error.statusCode = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error(
        `Not authorization for delete Post with id ${postId}`
      );
      error.statusCode = 403;
      throw error;
    }

    const deletePost = await post.deleteOne();

    clearImage(deletePost.imageUrl);
    const user = await User.findById(req.userId);

    user.posts.pull(postId);
    await user.save();

    return {
      ...deletePost._doc,
      _id: deletePost._id.toString(),
      createdAt: deletePost.createdAt.toISOString(),
      updatedAt: deletePost.updatedAt.toISOString(),
    };
  },

  user: async (args, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("Forbiden");
      error.code = 403;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },

  updateStatus: async ({ status }, req) => {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("Forbiden");
      error.code = 403;
      throw error;
    }

    user.status = status;
    const updatedUser = await user.save();

    return {
      ...updatedUser._doc,
      _id: updatedUser._id.toString(),
    };
  },
};
