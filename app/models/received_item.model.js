

// Names of all received items (tdp, plate, diagnostic, summary - some associated with vehicles)
module.exports = (sequelize, Sequelize) => {
    const ReceivedItem = sequelize.define("received_item", {
  
      itemName: {   
        type: Sequelize.STRING(50)
      },

      vehicleClass: {   
        type: Sequelize.STRING(20)
      },
      violationType: {   
        type: Sequelize.STRING(20)
      },
      laneNumber: {   
        type: Sequelize.STRING(20)
      },

    },
    {
      timestamps: false,  // disable createdAt, updatedAt
    });

    
  
    return ReceivedItem;
  };