const express = require("express");
const multer = require("multer");
const storage = multer.memoryStorage();
const router = express.Router();
const upload = multer({ storage });
const {
  uploadImage,
  getImage,
  deleteImage,
  listObjects,
  listObjectsWithPrefix,
} = require("../controllers/imageController");
router.get("/test", (req, res) => {
  console.log("Hitting the /test endpoint"); // Add this log
  res.send("Test route is working!");
});
router.post("/upload", upload.single("file"), uploadImage);
router.get("/", getImage);
router.delete("/", deleteImage);
router.get("/buckets", listObjects);
router.get("/search", listObjectsWithPrefix);

module.exports = router;
