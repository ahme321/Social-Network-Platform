const imageModel = require("../models/image");
const { stack } = require("../routes/imageRoute");
const { v4: uuidv4 } = require("uuid");
class ImageController {
  async uploadImage(req, res) {
    //The object name will be the postId concatenated with comment or post to identify the image
    //The bucket name will be the userId/ profileImage for profile images
    console.log("Ya mosahl el 7al in Image controller");
    const { user_Id, bucketName, post_Id } = req.body;
    //console.log(typeof user_Id);
    console.log("Bucket name:", bucketName);
    const file = req.file;
    const fileID = uuidv4();
    //Here i'm handling posts attached with images
    // If there's a post_ID it will be the file Id to be easy to retreive it
    if (post_Id) fileID = post_Id;
    var objectName;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    if (!bucketName || !user_Id) {
      return res
        .status(400)
        .json({ message: "Bucket name and user ID are required" });
    }
    //Handling File Extension
    let fileExtension = ".unknown";
    switch (file.mimetype) {
      case "image/jpeg":
      case "image/jpg":
        fileExtension = ".jpg";
        break;
      case "image/png":
        fileExtension = ".png";
        break;
      default:
        // Handle other cases or keep the default ".unknown"
        console.warn(`Unsupported mimetype: ${file.mimetype}`);
        break;
    }
    console.log("File Extension", fileExtension);
    switch (bucketName) {
      case "user-profiles":
        objectName = `${user_Id}/profileImage/${fileID}${fileExtension}`;
        break;
      case "post-images":
        objectName = `${user_Id}/postImage/${fileID}${fileExtension}`;
        break;
      case "comment-attachments":
        objectName = `${user_Id}/commentAttachment/${fileID}${fileExtension}`;
        break;
      //I need to handle invalid buckt name but how i can do
      default:
        //return res.status(400).json({ message: "Invalid bucket name" });
        break;
    }
    try {
      const result = await imageModel.uploadImage(bucketName, objectName, file);
      if (result.success) {
        res
          .status(201)
          .json({ message: "Image uploaded successfully", path: result.path });
      } else {
        res
          .status(500)
          .json({ message: "Error uploading image", error: result.error });
      }
    } catch (error) {
      res.status(500).json({ message: "Error uploading image", error });
    }
  }
  async getImage(req, res) {
    const { bucketName, objectName } = req.query;
    console.log("Fetching image from bucket:", bucketName);
    try {
      const dataStream = await imageModel.getImage(bucketName, objectName);
      if (dataStream) {
        res.setHeader("Content-Type", "image/jpeg");
        dataStream.pipe(res);
      } else {
        res.status(404).json({ message: "Image not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error fetching image", error });
    }
  }
  async deleteImage(req, res) {
    const { bucketName, objectName } = req.query;
    try {
      const result = await imageModel.deleteImage(bucketName, objectName);
      if (result.success) {
        res.status(200).json({ message: "Image deleted successfully" });
      } else {
        res
          .status(500)
          .json({ message: "Error deleting image", error: result.error });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting image", error });
    }
  }
  async listObjects(req, res) {
    const { bucketName } = req.body.bucketName;
    console.log("Listing objects in bucket:", bucketName);
    try {
      const objects = await imageModel.listObjects(bucketName);
      //console.log("Objects in bucket:", objects);
      res.status(200).json(objects);
    } catch (error) {
      res.status(500).json({ message: "Error listing objects", error });
    }
  }
  async listObjectsWithPrefix(req, res) {
    const { bucketName, prefix } = req.body;
    const objects = await imageModel.listObjects(bucketName, prefix, false);
    res.status(200).json(objects);
  }
  catch(error) {
    res.status(500).json({ message: "Error listing objects", error });
  }

  //I think i need to add a function to return all images of a specific user
}
module.exports = new ImageController();
