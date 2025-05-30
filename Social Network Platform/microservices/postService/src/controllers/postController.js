const Post = require("../models/post");
//const RabbitMQProducer = require("../../../RabbitMQ/producer");
//const producer = new RabbitMQProducer();
const axios = require("axios");
const FormData = require("form-data");

// Create a new post
// -------------- What if we have a post attached with image and how we can retreive them together?-------------------
/*
1. Extract The post text data to be handled in the post database
2. Return the post id to be used instead of randomly generated file id
2. Call the Image service API with userId and post ID and BucketName as post-images

-------------- How to retreive them together --------------------------------
There's 2 approachs

The first one
1. Return The post data that's handeled by the post service
2. Extract the post ID and then search in the buckets with that post ID 

The seconde one
1. Add a query in the request with boolean value that specifies if there's an image in the post
2. If true then Extract the post ID 
2. Call the Image endpoint to get that image with BucketName as post-images and abjectName constructed as user ID/profileImage/post_ID.jpeg 

 */
const createPost = async (req, res) => {
  try {
    console.log(".......");
    const { userId, content, category } = req.body;
    console.log(typeof userId);
    const post = new Post({ userId, content, category });
    await post.save();

    // Publish the post creation event to RabbitMQ

    // const result = await producer.PublishMessage({
    //   body: {
    //     message: {
    //       eventType: "POST_CREATED",
    //       userId: userId,
    //       content: post.content,
    //       category: post.category,
    //     },
    //     queue: "test_queue",
    //   },
    // });
    // console.log("The result of producer", result);

    // Send a response back to the client
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }

  //used to insert multiple posts at once 3shan nkhtsr

  //   try {
  //     const posts = await Post.insertMany(req.body); // Insert all posts at once
  //     res.status(201).json(posts);
  //   } catch (err) {
  //     res.status(400).json({ error: err.message });
  //   }
};

const ImageWithPost = async (req, res) => {
  try {
    console.log(".......");
    const { userId, content, category } = req.body;
    console.log(`type of userId in post controller${typeof userId}`);
    const post = new Post({ userId, content, category });
    console.log(post._id.toString());
    await post.save();
    const File = req.file;
    console.log(File);
    const user_Id = String(userId);
    const formData = new FormData();
    formData.append("user_Id", user_Id);
    formData.append("bucketName", "post-images");
    formData.append("file", req.file.buffer, req.file.originalname);
    formData.append("post_Id", String(post._id.toString()));
    console.log("Sending form data:", formData); // Debugging
    console.log("Yarab");
    await axios.post("http://localhost:6000/upload", formData, {
      Headers: { ...formData.getHeaders() },
    });
    console.log("Image upload to upload service.");
  } catch (error) {
    console.log(error);
  }
};
const getPostWithImage = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    await axios.get("http://localhost:6000/search", {
      query: {
        bucketName: "post-images",
        prefix: `${json(post).user_Id}/postImage/${post._id.toString()}`, //wareny hat3mleha ezay ya 7elwa file Extension?
      },
    });
  } catch (error) {
    console.log("Error fetching post with image");
  }
};
const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find();
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get a single post by ID
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    //console.log(post);
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update a post by ID
const updatePost = async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
// Delete a post by ID
const deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(204).send("Post deleted successfully");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Like a post
const likePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    //For testing purposes
    res.status(200).send("Post liked successfully");
    //res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Unlike a post
const unlikePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: -1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get posts by user ID
const getPostsByUserId = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.userId });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get posts by keyword could be used to search for posts by content
const getPostsByKeyword = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res
        .status(400)
        .json({ message: "Keyword query parameter is required" });
    }

    // Search in post content using case-insensitive regex
    const posts = await Post.find({
      content: { $regex: keyword, $options: "i" },
    }).sort({ createdAt: -1 }); // Sort by newest first

    if (posts.length === 0) {
      return res
        .status(200)
        .json({ message: "No posts found matching your search", posts: [] });
    }

    res.status(200).json({
      count: posts.length,
      posts: posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get posts by category
const getPostsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res
        .status(400)
        .json({ message: "Category parameter is required" });
    }

    // Search for posts by category
    const posts = await Post.find({
      category: { $regex: new RegExp(category, "i") },
    }).sort({ createdAt: -1 }); // Sort by newest first

    if (posts.length === 0) {
      return res.status(200).json({
        message: `No posts found in category: ${category}`,
        posts: [],
      });
    }

    res.status(200).json({
      count: posts.length,
      posts: posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostsByUserId,
  getPostsByKeyword,
  getPostsByCategory,
  ImageWithPost,
};
