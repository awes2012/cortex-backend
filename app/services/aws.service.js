
const fs = require("fs");

const {
    GetObjectCommand,
    S3,
    S3Client,
    ListObjectsV2Command,
    HeadObjectCommand
} = require("@aws-sdk/client-s3");


const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const AdmZip = require('adm-zip');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const s3Client = new S3Client({
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    },
    region: AWS_REGION || "us-west-2"
});
const s3 = new S3({
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    },
    region: AWS_REGION || "us-west-2"
});
function getNormalizedS3Path(path_arr) {
    let str = path_arr ? path_arr.replace('//', '/').replace('///', '/') : ''
    return str
}
async function uploadFileStreamToS3(fileStream, aws_file_path) {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: aws_file_path,
            Body: fileStream
        };

        const uploadResult = await s3.putObject(params);

        return uploadResult
    } catch (error) {
        console.error(error);
        return null
    }
}
async function uploadLocalFileToS3(local_file_path, aws_file_path) {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: aws_file_path,
            Body: fs.readFileSync(local_file_path)
        };

        const uploadResult = await s3.putObject(params);
        return uploadResult
    } catch (error) {
        console.error(error);
        return null
    }
}


// 24 hours expiry
async function getPreSignedUrlOfS3File(aws_file_path, expiration = 3600 * 24) {
    if (!aws_file_path) return null
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: getNormalizedS3Path(aws_file_path),
            // Add CORS headers
            ResponseHeaders: {
                'Access-Control-Allow-Origin': 'http://localhost:8081',
                'Access-Control-Allow-Method': 'GET', // Adjust accordingly
                'Access-Control-Allow-Headers': '*' // Customize if needed
            }
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: expiration });
        return url
    } catch (error) {
        console.error(error)
        return null
    }
}

/*
// June 2024 - detect file presence
// this works but is way too slow
async function getPreSignedUrlOfS3File(aws_file_path, expiration = 3600 * 24) {
    if (!aws_file_path) return null;

    try {
        const headCommand = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: getNormalizedS3Path(aws_file_path)
        });

        // Check if the file exists
        await s3Client.send(headCommand);

        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: getNormalizedS3Path(aws_file_path),
            // Add CORS headers
            ResponseHeaders: {
                'Access-Control-Allow-Origin': 'http://localhost:8081',
                'Access-Control-Allow-Method': 'GET', // Adjust accordingly
                'Access-Control-Allow-Headers': '*' // Customize if needed
            }
        });

        const url = await getSignedUrl(s3Client, getCommand, { expiresIn: expiration });
        return url;
    } catch (error) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
           // console.error('File not found:', aws_file_path);
            return null;
        } else {
            console.error('Error:', error);
            return null;
        }
    }
}
*/


const getBufferFromS3 = async (objectKey) => {
    try {
        const response = await s3Client
            .send(new GetObjectCommand({
                Key: objectKey,
                Bucket: BUCKET_NAME,
            }))
        const stream = response.Body

        return Buffer.concat(await stream.toArray())
    } catch (e) {
        throw new Error(`Could not retrieve file from S3: ${e.message}`)
    }
};
async function getImageBase64FromS3(imageFileKey) {
    if (!imageFileKey) return null
    try {
        const response = await s3Client
            .send(new GetObjectCommand({
                Key: getNormalizedS3Path(imageFileKey),
                Bucket: BUCKET_NAME,
            }))
        const stream = response.Body
        const imageBuffer = Buffer.concat(await stream.toArray());
        const base64String = Buffer.from(imageBuffer).toString('base64');

        return "data:image;base64, " + base64String;
    } catch (error) {
        console.error(error);
        return null
    }
}
async function downloadAWSDirectoryAsZip(directory, res) {
    const bucket = BUCKET_NAME
    try {
        // List objects in the directory (paginated)
        const params = {
            Bucket: bucket,
            Prefix: directory + '/' // Include trailing slash for directory listing
        };
        let objectSummaries = [];
        do {
            const listObjectsResponse = await s3Client.send(new ListObjectsV2Command(params));
            objectSummaries = objectSummaries.concat(listObjectsResponse.Contents);
            params.ContinuationToken = listObjectsResponse.NextContinuationToken;
        } while (params.ContinuationToken);

        // Create ZIP archive
        const zip = new AdmZip();
        for (const object of objectSummaries) {
            if (!object) continue
            const key = object.Key;
            if (key !== directory) { // Exclude the directory itself
                const objectStream = await getBufferFromS3(key);
                zip.addFile(key, objectStream);
            }
        }

        const zipBuffer = zip.toBuffer();

        // Set response headers for download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${directory}.zip`);
        res.setHeader('Content-Length', zipBuffer.length);

        // Send zip file to browser
        res.send(zipBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error downloading directory');
    }
}
module.exports = {
    s3,
    s3Client,
    BUCKET_NAME,
    uploadFileStreamToS3,
    uploadLocalFileToS3,
    getPreSignedUrlOfS3File,
    getBufferFromS3,
    getImageBase64FromS3,
    getNormalizedS3Path,
    downloadAWSDirectoryAsZip
}