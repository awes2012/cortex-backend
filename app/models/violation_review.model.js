
// Violation processing - TDPs are reviewed and violations issued
// Aug 28, 2023 - multi-stage review functionality

module.exports = (sequelize, Sequelize) => {
  const ViolationReview = sequelize.define("violation_review", {

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

    plateRead: {      // modified by user
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
    vehicle_outline_image_name: {
      type: Sequelize.STRING(128)
    },
    pdf_filename: {
      type: Sequelize.STRING(50)
    },
    notes: {  // notes may be added at any stage
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
      defaultValue: Sequelize.NOW
    },
  }, {

    indexes: [
      {
        name: 'idx_violationReviewTimeBegin',
        fields: [
          'timeBeginReview',
        ]
      },
      {
        name: 'idx_stage_sction_tdpId', 
        fields: ['stage', 'action', 'tdpId'],
      },
      {
        name: 'idx_tdpId', 
        fields: ['tdpId'],
      },
      {
        name: 'idx_tdp_stage', 
        fields: ['tdpId', 'stage'],
      },
      {
        name: 'idx_userId', 
        fields: ['userId'],
      },
    ],
    timestamps: false,  // disable createdAt, updatedAt
  });
 
  return ViolationReview;
};