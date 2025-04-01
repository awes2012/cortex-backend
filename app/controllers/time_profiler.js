const { Log } = require('@app/services/log.service')

const db = require("../models");
const ServerProfile = db.server_profile;


class TimeProfiler {
    constructor(colCode, logMesg, logEvery, metricName) {
        this.profileTimes = [];
        this.logCount = 0;
        this.colorCode = colCode;
        this.logEvery = logEvery;
        this.logMessage = logMesg;
        this.metricName = metricName;
        this.lastLogTime = -1;
        this.lastLogCount = 0;
    }

    start() {
        return process.hrtime.bigint();
    }

    async end(startTime) {
        const endTime = process.hrtime.bigint();
        const duration = (endTime - startTime) / BigInt(1000000); // Duration in milliseconds
        this.profileTimes.push(duration);

        if (this.profileTimes.length > 1000) {
            this.profileTimes.shift(); // Limit the size of the array to 1000
        }

        this.lastLogCount++;

        this.logCount++;
        if (this.logCount % this.logEvery === 0) {
            this.logAverageTime();
        }
    }

    async logAverageTime() {

        const total = this.profileTimes.reduce((acc, time) => acc + time, 0n);
        const length = this.profileTimes.length;

        const avgNumb = Number(total) / Number(length);
        const avgStr = avgNumb.toFixed(2) + ' ms';
        Log.info(this.colorCode, this.profileTimes.length + "   " + this.logMessage + avgStr); 

        if(this.lastLogTime > 0){

            const dtSec = Number(process.hrtime.bigint()) / 1e9 -  this.lastLogTime;
            const arRate = Number(this.lastLogCount) / dtSec;
            const rateStr = arRate.toFixed(4) + ' rec/sec';
            Log.info(this.colorCode, this.profileTimes.length + "  " + this.logMessage + " Rate: " + rateStr); 
            this.lastLogCount = 0;
        }
        this.lastLogTime = Number(process.hrtime.bigint()) / 1e9;


        if (this.metricName && this.metricName.trim() !== '') {
            try {  // save to db table
                await this.updateMetricDb(avgNumb);
            } catch (error) {
                console.error('Error updating metric:', error);
            }
        }   

    }

    
    async updateMetricDb(metricValue) {
        try {
            let spdProfile = await ServerProfile.findOne({
                where: { metricName: this.metricName }
            });
    
            if (spdProfile) {
                await spdProfile.update({ metric: metricValue });
            } else {
                try {
                    const newProfile = await ServerProfile.create({
                        metricName: this.metricName,
                        metric: metricValue,
                    });
                    spdProfile = newProfile;
                } catch (error) {
                    // If a uniqueness constraint violation occurs, fetch the existing profile
                    if (error.name === 'SequelizeUniqueConstraintError') {
                        spdProfile = await ServerProfile.findOne({
                            where: { metricName: this.metricName }
                        });
                        await spdProfile.update({ metric: metricValue });
                    } else {
                        throw error; // Rethrow if it's not a uniqueness constraint violation
                    }
                }
            }
            return { success: true, message: spdProfile ? 'Metric updated' : 'New metric created', data: spdProfile };
        } catch (error) {
            console.error('Error updating metric:', error);
            return { success: false, message: 'Error updating metric', error: error };
        }
    }


}

module.exports = TimeProfiler;
