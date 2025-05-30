const request = require("supertest");
const Post = require("../microservices/postService/src/models/post");
const mongoose = require("mongoose");

const POST_SERVICE_URL = "http://localhost:3000";

describe("Post Service API", () => {
  let testPost;

  beforeAll(async () => {
    // Connect to test database if needed
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/postService-test"
    );

    // Create a test post
    testPost = await Post.create({
      content: "Initial test post",
      category: "testing",
      userId: "testUserId123",
    });
  });

  afterAll(async () => {
    // Clean up
    await Post.deleteMany({});
    await mongoose.disconnect();
  });

  describe("GET /", () => {
    it("should retrieve all posts", async () => {
      const response = await request(POST_SERVICE_URL).get("/");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((p) => p._id === testPost._id.toString())).toBe(
        true
      );
    });
  });

  describe("POST /", () => {
    it("should create a new post", async () => {
      const newPost = {
        content: "New test post",
        category: "general",
        userId: "testUserId123",
      };

      const response = await request(POST_SERVICE_URL).post("/").send(newPost);

      expect(response.status).toBe(201);
      expect(response.body.content).toBe(newPost.content);

      // Verify in database
      const dbPost = await Post.findById(response.body._id);
      expect(dbPost).toBeTruthy();
    });
  });

  describe("GET /:id", () => {
    it("should retrieve a specific post", async () => {
      const response = await request(POST_SERVICE_URL).get(`/${testPost._id}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testPost._id.toString());
    });

    it("should return 404 for invalid post ID", async () => {
      const response = await request(POST_SERVICE_URL).get("/invalid-id-123");

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    it("should update a post", async () => {
      const updatedContent = "Updated content";
      const response = await request(POST_SERVICE_URL)
        .put(`/${testPost._id}`)
        .send({ content: updatedContent });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(updatedContent);
    });
  });

  describe("DELETE /:id", () => {
    it("should delete a post", async () => {
      const postToDelete = await Post.create({
        content: "Post to delete",
        userId: "testUserId123",
      });

      const response = await request(POST_SERVICE_URL).delete(
        `/${postToDelete._id}`
      );

      expect(response.status).toBe(204);

      // Verify deletion
      const deletedPost = await Post.findById(postToDelete._id);
      expect(deletedPost).toBeNull();
    });
  });

  describe("POST /:id/like", () => {
    it("should like a post", async () => {
      const post = await Post.create({
        content: "Post to like",
        userId: "testUserId123",
      });

      const response = await request(POST_SERVICE_URL)
        .post(`/${post._id}/like`)
        .send({ userId: "likerUserId" });

      expect(response.status).toBe(200);
      expect(response.body.likes).toContain("likerUserId");
    });
  });

  describe("POST /:id/unlike", () => {
    it("should unlike a post", async () => {
      const post = await Post.create({
        content: "Post to unlike",
        userId: "testUserId123",
        likes: ["likerUserId"],
      });

      const response = await request(POST_SERVICE_URL)
        .post(`/${post._id}/unlike`)
        .send({ userId: "likerUserId" });

      expect(response.status).toBe(200);
      expect(response.body.likes).not.toContain("likerUserId");
    });
  });

  describe("GET /:userId/posts", () => {
    it("should get posts by user ID", async () => {
      await Post.create([
        { content: "User post 1", userId: "specificUser" },
        { content: "User post 2", userId: "specificUser" },
      ]);

      const response = await request(POST_SERVICE_URL).get(
        "/specificUser/posts"
      );

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body.every((p) => p.userId === "specificUser")).toBe(
        true
      );
    });
  });

  describe("GET /search/keyword", () => {
    it("should search posts by keyword", async () => {
      await Post.create([
        { content: "Post with keyword", userId: "testUser" },
        { content: "Another post", userId: "testUser" },
      ]);

      const response = await request(POST_SERVICE_URL).get(
        "/search/keyword?q=keyword"
      );

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].content).toContain("keyword");
    });
  });

  describe("GET /search/category/:category", () => {
    it("should filter posts by category", async () => {
      await Post.create([
        { content: "Tech post", category: "technology", userId: "testUser" },
        { content: "Food post", category: "food", userId: "testUser" },
      ]);

      const response = await request(POST_SERVICE_URL).get(
        "/search/category/technology"
      );

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].category).toBe("technology");
    });
  });
});
