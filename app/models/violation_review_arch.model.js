
// Violation processing - TDPs are reviewed and violations issued
// To be used in Archive Db 

module.exports = (sequelize, Sequelize) => {
  const ViolationReviewArchive = sequelize.define("violation_review", {
       
    id: {
      type: Sequelize.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      unique: true,
      autoIncrement: true
    },

    userId: {
      type: Sequelize.INTEGER
    },
    stage: {
      type: Sequelize.INTEGER
    },
    timeBeginReview: {   // epoch times
      type: Sequelize.BIGINT
    },
    timeEndReview: {    
      type: Sequelize.BIGINT
    },
    plateRead: {    
      type: Sequelize.STRING(20)
    },
    action: {             // accept, reject issue.
      type: Sequelize.STRING(20)
    },
    ir_image_pan_x: {   // react-zoom-pan-pinch parameters
      type: Sequelize.INTEGER
    },
    ir_image_pan_y: {
      type: Sequelize.INTEGER
    },
    ir_image_scale: {
      type: Sequelize.FLOAT
    },
    ir_image_bright: {
      type: Sequelize.FLOAT
    },
    ir_image_contrast: {
      type: Sequelize.FLOAT
    },
    col_image_pan_x: {
      type: Sequelize.INTEGER
    },
    col_image_pan_y: {
      type: Sequelize.INTEGER
    },
    col_image_scale: {
      type: Sequelize.FLOAT
    },
    col_image_bright: {
      type: Sequelize.FLOAT
    },
    col_image_contrast: {
      type: Sequelize.FLOAT
    },
    tdpId: {
      type: Sequelize.BIGINT.UNSIGNED
    },
    pdf_filename: {
      type: Sequelize.STRING(50)
    },
    notes: {  
      type: Sequelize.TEXT
    },
    dmv_result: {
      type: Sequelize.TEXT,
      get() {
        const rawValue = this.getDataValue('dmv_result');
        try {
          const json = JSON.parse(rawValue)
          return json
        } catch (error) {
          return null
        }
      },
      set(value) {
        if (value) {
          this.setDataValue('dmv_result', JSON.stringify(value));
        } else {
          this.setDataValue('dmv_result', null);
        }
      }

    },
    createdAt: {
      type: Sequelize.DATE,
    },
    lookupKey: {  // to make de-duplication lookups way faster
      type: Sequelize.STRING,
      unique: true
    }  

  }, {
    sequelize,
    modelName: 'violation_review',  
    timestamps: false,
    indexes: [{
      unique: true,
      fields: ['lookupKey']
    }]        
  });

  return ViolationReviewArchive;
};






