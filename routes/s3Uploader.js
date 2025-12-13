"use strict";

// Libraries
const aws = require("aws-sdk");
const s3Uploader = require("express").Router();
const aws_region = process.env.AWS_DEFAULT_REGION;

// Configure AWS SDK with credentials & region
aws.config.update({
  region: aws_region,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const S3_BUCKET = process.env.S3_BUCKET;

/**
 * S3 Signed URL Uploader Route
 */

s3Uploader.post("/s3_signed_url", async (req, res) => {
  const s3 = new aws.S3();

  // Extract file name & type from request body
  const fileName = req.body.fileName;
  const fileType = req.body.fileType;

  // Configure S3 pre-signed URL parameters
  const params = {
    Bucket: S3_BUCKET,
    Key: fileName, // File name in bucket
    Expires: 500, // URL expiry in seconds
    ContentType: fileType,  // type of file
    ACL: "public-read", // File will be publicly readable
  };

  // Generate pre-signed URL for client to upload file
  s3.getSignedUrlPromise("putObject", params)
    .then(function (url) {
      const data = {
        signedRequest: url,
        url: `https://s3.${aws_region}.amazonaws.com/${S3_BUCKET}/${fileName}`,
      };
      res.json({ success: true, ...data });
    })
    .catch((error) => res.json({ success: false, error }));
});

module.exports = s3Uploader;
