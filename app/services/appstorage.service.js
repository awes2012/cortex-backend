const { STORE_DATA_AWS, STORE_ROOT, PORT, SERVER_ADDRESS } = require("@app/config/app.config")
const fs = require('fs');
const path = require("path");
const { uploadFileStreamToS3, getPreSignedUrlOfS3File, getImageBase64FromS3, downloadAWSDirectoryAsZip } = require("./aws.service");
const { readFileData, downloadLocalDirectoryAsZip } = require("./file.service");
const fsPromise = require('fs').promises;
const { Log } = require('@app/services/log.service');

console.info(`STORE_DATA_AWS=${STORE_DATA_AWS}`)


async function saveFile(fileStream, filePath, saveOriginal = false, oldFileName) {
    if (STORE_DATA_AWS) {
        await uploadFileStreamToS3(fileStream, filePath)
    } else {
        const directoryPath = path.dirname(filePath);

        fs.mkdirSync(directoryPath, { recursive: true });

        const promiseSave = new Promise((resolve, reject) => {
            fs.writeFile(filePath, fileStream, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
        await promiseSave
    }
}

const validateMacAddress_LC_NoColons = (macAddress) => {
    // Regular expression to match a MAC address in the form of 'f8dc7aac9b02'
    const macRegex = /^[a-f0-9]{12}$/;
  
    // Test the macAddress against the regular expression
    return macRegex.test(macAddress);
  };


  // June 2024 - check file existance - too slow to perform on every file
  /*
  async function getFileUrlForClient(filePath) {

    if (filePath === null) return '';

    try {
        // Check if the file is stored in S3
        const first12Chars = filePath.substring(0, 12);
        if (validateMacAddress_LC_NoColons(first12Chars)) {

            const s3Url = await getPreSignedUrlOfS3File(filePath);
            // Check if the S3 URL is valid (assuming getPreSignedUrlOfS3File returns null or an error if the file doesn't exist)
            if (s3Url) {
                return s3Url;
            } else {
                return ''; // Return an empty URL if the file doesn't exist in S3
            }
        } else {
            // Check if the local file exists
            try {
                const normalizedPath = path.normalize(filePath);
                await fsPromise.access(normalizedPath, fs.constants.F_OK);
                return `${SERVER_ADDRESS}api/common/get_local_file?filepath=${filePath}`;
            } catch (error) {
                // If the file does not exist
                return '';
            }
        }
    } catch (error) {
        console.info(error);
        return '';
    }
}
*/


async function getFileUrlForClient(filePath) {
    
    if(filePath === null) return null;
   
    try {
        // June 2024 - mac at beginning indicates s3 storage.  This is indep of STORE_DATA_AWS setting
        // allows reading data from both storage configurations
        const first12Chars = filePath.substring(0, 12);
        if (validateMacAddress_LC_NoColons(first12Chars)) {
            return await getPreSignedUrlOfS3File(filePath)
        } else {
            const url = `${SERVER_ADDRESS}api/common/get_local_file?filepath=${filePath}`
            return url
        }
    } catch (error) {
        console.info(error)
        return null
    }
}

// Batch processing for improved S3 access
async function getFileUrlsBatch(filePaths) {
    const promises = filePaths.map(filePath => getPreSignedUrlOfS3File(filePath));
    return await Promise.all(promises);
}


async function getS3_URLS(doc, storageLocation) {

    const filePaths = [
      `${storageLocation}/plate.png`,
      `${storageLocation}/irFrame.jpg`,
      `${storageLocation}/colorFrame.jpg`,
    ];
  
    Log.info(" >>> getS3_URLS")
  
    // Conditionally add video filenames if they exist
    if (doc.irVideoFilename) {
      filePaths.push(`${storageLocation}/${doc.irVideoFilename}`);
    }
  
    if (doc.colorVideoFilename) {
      filePaths.push(`${storageLocation}/${doc.colorVideoFilename}`);
    }
  
    // Get batch URLs
    const urls = await getFileUrlsBatch(filePaths);
  
    let urlIndex = 0;
  
    // Assign URLs to doc
    doc.plateImageUrl = urls[urlIndex++];
    doc.irImageUrl = urls[urlIndex++];
    doc.colImageUrl = urls[urlIndex++];
  
    // Conditionally assign video URLs if they exist
    if (doc.irVideoFilename) {
      doc.irVideoUrl = urls[urlIndex++];
    }
  
    if (doc.colorVideoFilename) {
      doc.colorVideoUrl = urls[urlIndex++];
    }
  }
  
  // Function to get local URLs and update the doc object
  async function getLocalURLs(doc, storageLocation) {
    doc.plateImageUrl = await getFileUrlForClient(`${storageLocation}/plate.png`);
    doc.irImageUrl = await getFileUrlForClient(`${storageLocation}/irFrame.jpg`);
    doc.colImageUrl = await getFileUrlForClient(`${storageLocation}/colorFrame.jpg`);
  
    if (doc.irVideoFilename) {
      doc.irVideoUrl = await getFileUrlForClient(`${storageLocation}/${doc.irVideoFilename}`);
    }
  
    if (doc.colorVideoFilename) {
      doc.colorVideoUrl = await getFileUrlForClient(`${storageLocation}/${doc.colorVideoFilename}`);
    }
  }


/*  Orig 
async function getFileUrlForClient(filePath) {
    try {
        if (STORE_DATA_AWS) {
            return await getPreSignedUrlOfS3File(filePath)
        } else {
            const url = `${SERVER_ADDRESS}api/common/get_local_file?filepath=${filePath}`
            return url
        }
    } catch (error) {
        console.info(error)
        return null
    }
}
*/

//MK - June 2024 - I believe this is not  getting used (Obsolete) TBC
async function getFileBase64(filePath) {
    try {
        if (STORE_DATA_AWS) {
            return await getImageBase64FromS3(filePath)
        } else {
            const filedata = await readFileData(filePath)
            return 'data:image/jpeg;base64, ' + filedata
        }
    } catch (error) {
        console.info(error)
        return null
    }

}


async function downloadDirectoryAsZip(directory, res) {
    
    if(directory === null) return null;

    try {

         // June 2024 - mac at beginning indicates s3 storage.  This is indep of STORE_DATA_AWS setting
        // allows reading data from both storage configurations
        const first12Chars = directory.substring(0, 12);
        if (validateMacAddress_LC_NoColons(first12Chars)) {
       
            return await downloadAWSDirectoryAsZip(directory, res)
        } else {
            return await downloadLocalDirectoryAsZip(directory, res)
        }
    } catch (error) {
        console.info(error)
        return null
    }
}

/*  // Orig
async function downloadDirectoryAsZip(directory, res) {
    
    try {
        if (STORE_DATA_AWS) {
            return await downloadAWSDirectoryAsZip(directory, res)
        } else {
            return await downloadLocalDirectoryAsZip(directory, res)
        }
    } catch (error) {
        console.info(error)
        return null
    }
}
*/

module.exports = {
    saveFile,
    getFileUrlForClient,
    getFileBase64,
    downloadDirectoryAsZip,
    getFileUrlsBatch,
    validateMacAddress_LC_NoColons,
    getS3_URLS,
    getLocalURLs
}
