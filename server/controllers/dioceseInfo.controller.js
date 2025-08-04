const db = require("../models");
const Op = db.Sequelize.Op;

const dioceseInfo = db.dioceseInfo;

exports.findDioceseInfo = async (req, res) => {
    try {
        const diocese = req.query.diocese;
        const year = req.query.year;
        const where = {};
        if (diocese) {
            where.diocese = { [Op.like]: `%${diocese}%` };
        };
        if (year) {
            where.year = year;
        };
        const dioceseInfoData = await dioceseInfo.findAll({ where });
        res.status(200).send(dioceseInfoData);
        console.log(dioceseInfoData);
    } catch (err) {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving diocese information."
        });
    }
}