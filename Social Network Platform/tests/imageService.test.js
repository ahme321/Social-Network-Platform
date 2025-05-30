const request = require("supertest");
const fs = require("fs");
const path = require("path");
const {
  MinioClient,
} = require("../microservices/ImageService/src/config/MinIoConfig");

const IMAGE_SERVICE_URL = "http://localhost:6000";

// Create a test image file
const createTestImage = () => {
  const testImagePath = path.join(__dirname, "bla.png");
  fs.writeFileSync(testImagePath, "TEST IMAGE CONTENT");
  return testImagePath;
};

describe("Image Service API", () => {
  let testImagePath;
  let uploadedObjectName;

  beforeAll(async () => {
    // Connect to databases if needed
    testImagePath = createTestImage();
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    // Clean up Minio test objects
    if (uploadedObjectName) {
      try {
        await MinioClient.removeObject("test-bucket", uploadedObjectName);
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    }
  });

  describe("POST /upload", () => {
    it("should upload an image", async () => {
      const response = await request(IMAGE_SERVICE_URL)
        .post("/upload")
        .attach("file", testImagePath)
        .field("bucket", "test-bucket");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("objectName");
      expect(response.body).toHaveProperty("url");

      // Store for cleanup
      uploadedObjectName = response.body.objectName;
    });

    it("should reject uploads without a file", async () => {
      const response = await request(IMAGE_SERVICE_URL)
        .post("/upload")
        .field("bucket", "test-bucket");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /:objectName", () => {
    it("should retrieve an uploaded image", async () => {
      // First upload a test image
      const uploadResponse = await request(IMAGE_SERVICE_URL)
        .post("/upload")
        .attach("file", testImagePath)
        .field("bucket", "test-bucket");

      const objectName = uploadResponse.body.objectName;

      // Now try to get it
      const response = await request(IMAGE_SERVICE_URL)
        .get(`/${objectName}`)
        .query({ bucket: "test-bucket" });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("image/jpeg");
    });

    it("should return 404 for non-existent image", async () => {
      const response = await request(IMAGE_SERVICE_URL)
        .get("/non-existent-image.jpg")
        .query({ bucket: "test-bucket" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /delete/:objectName", () => {
    it("should delete an image", async () => {
      // First upload a test image
      const uploadResponse = await request(IMAGE_SERVICE_URL)
        .post("/upload")
        .attach("file", testImagePath)
        .field("bucket", "test-bucket");

      const objectName = uploadResponse.body.objectName;

      // Now delete it
      const response = await request(IMAGE_SERVICE_URL)
        .delete(`/delete/${objectName}`)
        .query({ bucket: "test-bucket" });

      expect(response.status).toBe(204);

      // Verify deletion by trying to get it
      const getResponse = await request(IMAGE_SERVICE_URL)
        .get(`/${objectName}`)
        .query({ bucket: "test-bucket" });

      expect(getResponse.status).toBe(404);
    });
  });

  describe("GET /buckets", () => {
    it("should list available buckets", async () => {
      // Create a test bucket if it doesn't exist
      try {
        await MinioClient.makeBucket("test-bucket-2", "us-east-1");
      } catch (err) {
        if (err.code !== "BucketAlreadyExists") {
          throw err;
        }
      }

      const response = await request(IMAGE_SERVICE_URL).get("/buckets");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain("test-bucket");
      expect(response.body).toContain("test-bucket-2");

      // Cleanup
      await MinioClient.removeBucket("test-bucket-2");
    });
  });
});
