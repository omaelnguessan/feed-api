const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");
const { clearImage, clearPath } = require("../helpers/image");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Posts fetched",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      const error = new Error("validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }

    if (!req.file) {
      const error = new Error("Invalid or missing image.");
      error.statusCode = 422;
      throw error;
    }

    const { title, content } = req.body;
    const imageUrl = clearPath(req.file.path);

    const post = new Post({
      title: title,
      content: content,
      imageUrl: imageUrl,
      creator: req.userId,
    });

    await post.save();
    const user = await User.findById(req.userId);

    user.posts.push(post);
    await user.save();

    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });

    res.status(201).json({
      message: "Post created successfully",
      post: post,
      creator: { _id: user._id.toString(), name: user.name },
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.getPost = async (req, res, next) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error(`Post with id ${postId} Not found`);
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: "Post fetched", post: post });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.updatePost = async (req, res, next) => {
  const { postId } = req.params;

  try {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      const error = new Error("validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }

    const { title, content } = req.body;
    let imageUrl = req.body.image;

    if (req.file) {
      imageUrl = clearPath(req.file.path);
    }

    if (!imageUrl) {
      const error = new Error("No file picked");
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    console.log(post);
    if (!post) {
      const error = new Error(`Post with id ${postId}`);
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

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const result = await post.save();

    io.getIO().emit("posts", { action: "update", post: result });

    res.status(200).json({ message: "Post updated successfully", post: post });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error(`Post with id ${postId} Not found`);
      error.statusCode = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId.toString()) {
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
    user.save();

    io.getIO().emit("posts", { action: "delete", post: postId });

    res.status(200).json({ message: "Post deleted!", post: post });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};
