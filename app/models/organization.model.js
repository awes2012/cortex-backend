
// Organization name
//  name = all -> super-user (eg Viion) access

module.exports = (sequelize, Sequelize) => {
  const Organization = sequelize.define("organization", {

    name: {
      type: Sequelize.STRING(50)
    },
    violation_stages: {
      type: Sequelize.TEXT,
      get() {
        const rawValue = this.getDataValue('violation_stages');
        try {
          const json = JSON.parse(rawValue)
          return json
        } catch (error) {
          return null
        }
      },
      set(value) {
        this.setDataValue('violation_stages', JSON.stringify(value));
      }
    },
    createdAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    updatedAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    nextTicket: {
      type: Sequelize.STRING(50)
    },
    updateInterval: {
      type: Sequelize.INTEGER
    },
    violation_pdf_template: {
      type: Sequelize.TEXT('long')	
    },
    violation_layout_option: {
      type: Sequelize.STRING(50)
    },
    pythonModulePath: {  // path to external Python script 
      type: Sequelize.STRING(255)
    }

  });

  return Organization;
};
