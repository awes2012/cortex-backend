
const db = require("../models");
const Org = db.organization;

const OrgPlate = db.org_plate;      // associate org wth plate read - shared with plate_match service
const OrgTdpMatch= db.org_tdp_match;

const { Log } = require('@app/services/log.service')

const { Sequelize, Model, DataTypes } = require('sequelize');

const sequelizeLoc = new Sequelize('cortexbackups', process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

const archiveTDP = require('../models/tdp_arch.model.js')(sequelizeLoc, Sequelize);

const minPlateMatchLength = 4;

const updateTdpMatches = async (orgId, tdpId, plateRead) => {


    if(!plateRead || plateRead.length < minPlateMatchLength) return;

    var orgPlateId;

    // org_plates
    const orgPlates = await OrgPlate.findAll({
        where: { organizationId: orgId, plateRead: plateRead }
    });

    var matchingTdps;

    if (orgPlates.length === 0) {  // No previously matching record in org_plates

        // Test for a match in TDPs
        matchingTdps = await plateMatchesInTDPs(orgId, plateRead);
  
        if(matchingTdps.length == 0) return;  // no matches
        
        const createdOrgPlate = await OrgPlate.create({
            organizationId: orgId,
            plateRead: plateRead
        });

        orgPlateId = createdOrgPlate.id;  // Get the id of the newly created record
    } else {
        orgPlateId = orgPlates[0].id;  // Get the id of the existing record
    }

    await addTdpMatchRecord(orgPlateId, tdpId);

    Log.info("*** Added TDP Match: " + plateRead + " for Org: " + orgId);

    if(matchingTdps){
        for (let tdpRecord of matchingTdps) {

            await addTdpMatchRecord(orgPlateId, tdpRecord.id);
        }
    }

}

const addTdpMatchRecord = async (orgPlateId, tdpId) => {

    const orgTdpMatch = await OrgTdpMatch.findAll({
        where: { tdp_id: tdpId, org_plate_id: orgPlateId }
    });

    if (orgTdpMatch.length === 0) {
        await db.org_tdp_match.create({
            tdp_id: tdpId,
            org_plate_id: orgPlateId  
        });
    }
}


// Run a batch process to detect all historical matches.
const performTdpMatching = async () => {

    Log.debug("***** Performing TDP Matching - other functionality disabled");

    // Consider using config or env variables for these
    const alsoUseArchives = true;
    const devMaxFillTo = -1;

    if (alsoUseArchives) {
        await sequelizeLoc.authenticate();
        Log.info('performTdpMatching - Connection established with cortexbackups.');
    }

    try {
        const orgs = await Org.findAll({ attributes: ['id', 'name'] });

        for (let anOrg of orgs) {
            const [orgTDPs, archiveTDPs] = await Promise.all([
                getOrgTDPs(anOrg.id),
                alsoUseArchives ? getArchiveTDPs(anOrg.id) : Promise.resolve([])
            ]);

            Log.info(`Organization: ${anOrg.name} nPlates: ${orgTDPs.length} ${alsoUseArchives ? 'Archive: ' + archiveTDPs.length : ''}`);
            
            if (orgTDPs.length === 0 && archiveTDPs.length === 0) continue;

            const tdpMap = createTdpMap([...orgTDPs, ...archiveTDPs], devMaxFillTo);
            await processTdpMatches(tdpMap, anOrg);

            const sortedKeysWithSize = await getSortedKeysWithArraySize(tdpMap);

            Log.info("Multiple TDP plates for Company:  " + anOrg.name);
            sortedKeysWithSize.forEach(item => {
                Log.info(`Plate: ${item.key}, Count: ${item.size}`);
            });

        }
    } catch (error) {
        Log.error("Error during TDP Matching:", error);
    } finally {
        Log.info('performPlateMatching - Completed');
    }
};

async function plateMatchesInTDPs(orgId, plateRead) {
    
    // Get all reads for org.  Direct SQL is fastest
    const query = `
        SELECT p.id, p.plateRead, p.cameraId
        FROM tdps p
        INNER JOIN cameras c ON p.cameraId = c.id
        WHERE c.organizationId = ? AND p.plateRead = ?
    `;

    const orgTDPs = await db.sequelize.query(query, {
        replacements: [orgId, plateRead],
        type: db.sequelize.QueryTypes.SELECT
    });

    return orgTDPs
    
}


async function getOrgTDPs(orgId) {
    

    // Get all reads for org.  Direct SQL is fastest
    const query = `
        SELECT p.id, p.plateRead, p.cameraId
        FROM tdps p
        INNER JOIN cameras c ON p.cameraId = c.id
        WHERE c.organizationId = ?
    `;

    const orgTDPs = await db.sequelize.query(query, {
        replacements: [orgId],
        type: db.sequelize.QueryTypes.SELECT
    });

    return orgTDPs;

}

async function getArchiveTDPs(orgId) {
    
    const query = `
        SELECT p.id, p.plateRead, p.cameraId
        FROM tdps p
        WHERE p.orgId = ?
    `;

    const archiveTDPs = await archiveTDP.sequelize.query(query, {
        replacements: [orgId],
        type: sequelizeLoc.QueryTypes.SELECT
    });

    return archiveTDPs;
}

function createTdpMap(orgTDPs, maxFillTo) {
    
    const tdpMap = {};

    for (let aTdp of orgTDPs) {
        if ( !aTdp.plateRead || aTdp.plateRead.length < minPlateMatchLength) continue;
        
        if (!tdpMap[aTdp.plateRead]) {
            tdpMap[aTdp.plateRead] = [];
        }
        
        // Check if the current TDP record is already in the array
        // aTdp.id is the unique identifier for each TDP record
        let isDuplicate = tdpMap[aTdp.plateRead].some(existingTdp => existingTdp.id === aTdp.id);

        // If it's not a duplicate, push it to the array
        if (!isDuplicate) {
            tdpMap[aTdp.plateRead].push(aTdp);
        }

        if((maxFillTo > 0) && (Object.keys(tdpMap).length > maxFillTo)) break;  // ** For dev 
    }

    return tdpMap;

}

/*
// Chat GPT version - transaction race issues
async function processTdpMatches(tdpMap, anOrg) {
    let aCounter = 0;
    
    // Use transaction for bulk operations
    const transaction = await db.sequelize.transaction();

    try {
        // Fetch all OrgPlates at once
        const orgPlates = await OrgPlate.findAll({
            where: { organizationId: anOrg.id },
            transaction
        });
        const orgPlatesMap = new Map(orgPlates.map(op => [op.plateRead, op]));

        // Prepare bulk operations
        const orgPlateCreates = [];
        const orgTdpMatchCreates = [];

        for (let plateRead in tdpMap) {
            if (tdpMap[plateRead].length < 2) continue;

            let orgPlate = orgPlatesMap.get(plateRead);
            if (!orgPlate) {
                // Add to bulk create array
                orgPlateCreates.push({ organizationId: anOrg.id, plateRead: plateRead });
            }

            for (let tdpRecord of tdpMap[plateRead]) {
                // Add to bulk create array if not already present
                if (!orgPlate || !await OrgTdpMatch.findOne({
                    where: { tdp_id: tdpRecord.id, org_plate_id: orgPlate ? orgPlate.id : 0 },
                    transaction
                })) {
                    orgTdpMatchCreates.push({
                        tdp_id: tdpRecord.id,
                        org_plate_id: orgPlate ? orgPlate.id : null // to be updated after bulk insert of OrgPlate
                    });
                }
            }

            ++aCounter;
            if (aCounter % 100 === 0) {
                Log.info(`\t ${anOrg.name} Processed: ${aCounter}`);
            }
        }

        // Bulk create OrgPlates and OrgTdpMatches
        const createdOrgPlates = await OrgPlate.bulkCreate(orgPlateCreates, { transaction, returning: true });
        createdOrgPlates.forEach(op => {
            orgPlatesMap.set(op.plateRead, op);
        });

        // Update org_plate_id for OrgTdpMatches
        for (let match of orgTdpMatchCreates) {
            if (match.org_plate_id === null) {
                const createdOrgPlate = orgPlatesMap.get(match.plateRead);
                match.org_plate_id = createdOrgPlate.id;
            }
        }

        await OrgTdpMatch.bulkCreate(orgTdpMatchCreates, { ignoreDuplicates: true, transaction });

        // Commit the transaction
        await transaction.commit();
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();
        throw error; // Rethrow the error to handle it in an upper layer
    }
}
*/

  // orig MK version
async function processTdpMatches(tdpMap, anOrg) {
   
    let aCounter = 0;
   
    for (let plateRead in tdpMap) {

      if (tdpMap[plateRead].length < 2) continue;  // store duplicates only 
          
        let orgPlateId;  // This will store the id of the OrgPlate record

        // org_plates
        const orgPlates = await OrgPlate.findAll({
            where: { organizationId: anOrg.id, plateRead: plateRead }
        });

        if (orgPlates.length === 0) {  // No existing record found, create one
            const createdOrgPlate = await OrgPlate.create({
                organizationId: anOrg.id,
                plateRead: plateRead
            });
            orgPlateId = createdOrgPlate.id;  // Get the id of the newly created record
        } else {
            orgPlateId = orgPlates[0].id;  // Get the id of the existing record
        }


        // org_tdp_match
        for (let tdpRecord of tdpMap[plateRead]) {

            const orgTdpMatch = await OrgTdpMatch.findAll({
                where: { tdp_id: tdpRecord.id, org_plate_id: orgPlateId }
            });

            if (orgTdpMatch.length === 0) {
                await db.org_tdp_match.create({
                    tdp_id: tdpRecord.id,
                    org_plate_id: orgPlateId  
                });
            }
        }

        ++aCounter;
        if(aCounter % 100 === 0 ){
            Log.info(`\t ${anOrg.name} nProcessed: ${aCounter}`);
        }
    }
}


async function getSortedKeysWithArraySize(tdpMap) {
    // Get an array of [key, array] pairs from the tdpMap object
    const entries = Object.entries(tdpMap);

    // Filter entries to include only those with arrays that have more than one entry
    const filteredEntries = entries.filter(entry => entry[1].length > 1);

    // Sort the filtered entries based on the array length in descending order
    const sortedEntries = filteredEntries.sort((a, b) => b[1].length - a[1].length);

    // Map the sorted entries to include the key and the size of the array
    const sortedKeysWithSize = sortedEntries.map(entry => ({
        key: entry[0],
        size: entry[1].length
    }));

    return sortedKeysWithSize;
}
/*
async function getSortedKeysWithArraySize(tdpMap) {

    // Get an array of [key, array] pairs from the tdpMap object
    const entries = Object.entries(tdpMap);

    // Sort the entries based on the array length in descending order
    const sortedEntries = entries.sort((a, b) => b[1].length - a[1].length);

    // Map the sorted entries to include the key and the size of the array
    const sortedKeysWithSize = sortedEntries.map(entry => ({
        key: entry[0],
        size: entry[1].length
    }));

    return sortedKeysWithSize;
}
*/


module.exports = {
    performTdpMatching,
    updateTdpMatches
};