const { error } = require("console");
const minioClient = require("../config/MinIoConfig");
const dotenv = require("dotenv");
dotenv.config();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
/*
const fs = require('fs');
const policies = JSON.parse(fs.readFileSync('../config/bucket-policy.json',(error) =>
    {if(error)
            {    console.error('Error reading bucket policy file:', error)
            } 
        }   
, {encoding:'utf8'}));
*/
const buckets = ["user-profiles", "post-images", "comment-attachments"];
class ImageModel {
  constructor() {
    this.minioClient = minioClient;
    this.initBuckets();
    this.buckets = buckets;
    //this.applyPolicyByPattern();
  }
  async initBuckets() {
    for (const bucket of buckets) {
      try {
        const exists = await minioClient.bucketExists(bucket);
        if (!exists) await minioClient.makeBucket(bucket, "me-central-1");
        console.log(`Bucket ${bucket} ready.`);
      } catch (err) {
        console.error(`Error with bucket ${bucket}:`, err);
      }
    }
  }
  /*
async applyPolicyByPattern() {
    const buckets = await minioClient.listBuckets();
    for (const bucket of buckets) {
        try {
            // Determine which policy to apply based on bucket name
            const policyType = bucket.name.startsWith('public-') ? 'default' : 'restricted';
            const policyJSON = JSON.stringify(policies[policyType])
                .replace(/\$\{bucket\}/g, bucket.name);
                
            await minioClient.setBucketPolicy(bucket.name, policyJSON);
            console.log(`Applied ${policyType} policy to ${bucket.name}`);
        } catch (err) {
            console.error(`Error processing ${bucket.name}:`, err.message);
        }
    }
}
*/
  async uploadImage(bucketName, objectName, file) {
    //console.log(this.minioClient);
    console.log("In image Model");
    try {
      await this.minioClient.putObject(
        bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          "content-type": file.mimetype,
          "x-amz-acl": "public-read",
          "x-amz-meta-name": file.originalname,
          "x-amz-meta-user-id": file.userId,
          "x-amz-meta-file-id": uuidv4(),
        }
      );
      console.log(` photo uploaded to ${bucketName}/${objectName}`);
      return { success: true, path: `${bucketName}/${objectName}` };
    } catch (err) {
      console.error("Upload Error:", err);
      return { success: false, error: err };
    }
  }
  async getImage(bucketName, objectName) {
    try {
      const dataStream = await this.minioClient.getObject(
        bucketName,
        objectName
      );

      return dataStream;
    } catch (err) {
      console.error(" Error getting object from minio:", err);
      return null;
    }

    // try {
    //   const { fileId } = req.params;
    //   const obj = await findObjectByFileId(fileId);

    //   if (!obj) {
    //     return res.status(404).send("File not found");
    //   }

    //   const stream = await minioClient.getObject(bucketName, obj.name);

    //   // Set appropriate headers
    //   res.setHeader("Content-Type", "application/octet-stream");
    //   res.setHeader(
    //     "Content-Disposition",
    //     `attachment; filename="${path.basename(obj.name)}"`
    //   );

    //   stream.pipe(res);
    // } catch (error) {
    //   console.error("Error fetching file: ", error);
    //   res.status(500).send("Error reading file: " + error.message);
    // }
  }

  async extractFileInfo(objectName) {
    // Object name format: userID/fileId-filename
    const parts = objectName.split("/");
    if (parts.length !== 2) return null;

    const userID = parts[0];
    const fileIdAndName = parts[1];

    // Find the UUID pattern in the string
    const uuidPattern =
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const uuidMatch = fileIdAndName.match(uuidPattern);

    if (!uuidMatch) return null;

    const fileId = uuidMatch[1];
    // Get everything after the UUID and the hyphen
    const filename = fileIdAndName.substring(fileId.length + 1);

    return {
      userID,
      fileId,
      filename,
    };
  }

  async listObjects(prefix = "", limit = 10, marker = "", bucketName) {
    console.log("Listing objects in bucket from imageModel:", bucketName);
    const objectsStream = this.minioClient.listObjects(
      bucketName,
      prefix,
      true
    );
    objectsStream.on("data", function (obj) {
      console.log(obj);
    });
    objectsStream.on("error", function (e) {
      console.log(e);
    });
    // const files = [];
    // let count = 0;
    // let startFromMarker = !marker;

    // return new Promise((resolve, reject) => {
    //   stream.on("data", (obj) => {
    //     // If marker is provided, skip until we find it
    //     if (!startFromMarker) {
    //       if (obj.name === marker) {
    //         startFromMarker = true;
    //       }
    //       return;
    //     }

    //     if (count < limit) {
    //       const fileInfo = extractFileInfo(obj.name);
    //       if (fileInfo) {
    //         files.push({
    //           objectName: obj.name,
    //           size: obj.size,
    //           lastModified: obj.lastModified,
    //           etag: obj.etag,
    //           fileId: fileInfo.fileId,
    //           filename: fileInfo.filename,
    //           userID: fileInfo.userID,
    //         });
    //         count++;
    //       }
    //     }
    //   });

    //   stream.on("error", reject);
    //   stream.on("end", () => resolve(files));
    // });
  }

  async deleteImage(bucketName, objectName) {
    try {
      await this.minioClient.removeObject(bucketName, objectName);
      console.log(`Deleted ${bucketName}/${objectName}`);
      return { success: true };
    } catch (err) {
      console.error("Deletion Error:", err);
      return { success: false, error: err };
    }
  }
}
module.exports = new ImageModel();
