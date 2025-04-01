const fs = require("fs");
const archiver = require('archiver');
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_'
        cb(null, uniqueSuffix + file.originalname)
    }
})
const diskUpload = multer({ storage: storage })
const memoryUpload = multer({
  storage: multer.memoryStorage(),
});
function readFileData(file_path) {
    return new Promise((resolve, reject) => {
        fs.readFile(file_path, { encoding: 'base64' }, function (error, data) {
            if (error) {
                reject(null)
            } else {
                resolve(data)
            }
        });
    })

}
function downloadLocalDirectoryAsZip(directoryToZip, res) {
    // Check if the directory exists
    if (!fs.existsSync(directoryToZip)) {
        return res.status(404).send('Directory not found');
    }

    const zipFileName = path.basename(directoryToZip) + '.zip';
    const zipFilePath = path.join(__dirname + "../../../public", zipFileName);

    // Create a write stream to the zip file
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
        zlib: { level: 9 }, // Compression level
    });

    // Pipe the archive to the output stream
    archive.pipe(output);

    // Add the entire directory to the archive
    archive.directory(directoryToZip, false);

    // Once the archive is finalized, send the zip file as a response
    archive.finalize();

    output.on('close', () => {
        return res.download(zipFilePath, zipFileName, (err) => {
            // Clean up the zip file after download
            fs.unlinkSync(zipFilePath);
            if (err) {
                console.error(err);
                res.status(500).send('Error downloading file');
            }
        });
    });
};

function renameFile(originalFile, newFile) {
    return new Promise((resolve, reject) => {
        fs.rename(originalFile, newFile, (err) => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        });
    })

}
module.exports = {
    downloadLocalDirectoryAsZip,
    readFileData,
    renameFile,
    memoryUpload,
    diskUpload
}
