
const db = require("../models");
const Org = db.organization;
const OrgPlate = db.org_plate;
const OrgPlateMatch= db.org_plate_match;

const { Log } = require('@app/services/log.service')


const performPlateMatching = async () => {
  
    Log.debug("***** Performing Plate Matching - other functionality disabled");

  try {
    const orgs = await Org.findAll({
      attributes: ['id', 'name'] 
    });

    for (let anOrg of orgs) {

      // Get all reads for org.  Direct SQL is fastest
      const query = `
          SELECT p.id, p.plateRead, p.cameraId
          FROM plates p
          INNER JOIN cameras c ON p.cameraId = c.id
          WHERE c.organizationId = ?
      `;
        
      const plates = await db.sequelize.query(query, {
          replacements: [anOrg.id],
          type: db.sequelize.QueryTypes.SELECT
      });

      Log.info(`Organization: ${anOrg.name} nPlates: ${plates.length}`);
      
      if(plates.length == 0) continue;

      // Detect all matches 
      const plateMap = {};
      for (let plate of plates) {
          if (plate.plateRead.length < 4) continue;
          
          if (!plateMap[plate.plateRead]) {
              plateMap[plate.plateRead] = [];
          }
          plateMap[plate.plateRead].push(plate);

          if(Object.keys(plateMap).length > 2000) break;  // ** For dev - stop after 2000
      }

      const plateMatches = [];
      let aCounter = 0;

      for (let plateRead in plateMap) {
        if (plateMap[plateRead].length > 1) {  // store duplicates only 
            
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
    
            // org_plate_match
            for (let plateRecord of plateMap[plateRead]) {

                const orgPlateMatch = await OrgPlateMatch.findAll({
                    where: { plate_id: plateRecord.id, org_plate_id: orgPlateId }
                });

                if (orgPlateMatch.length === 0) {
                    await db.org_plate_match.create({
                        plate_id: plateRecord.id,
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

    }
  
  } catch (error) {
      Log.error("Error during Table Management:", error);
  } finally {
      Log.info('performPlateMatching - Completed');
  }
}




module.exports = performPlateMatching;