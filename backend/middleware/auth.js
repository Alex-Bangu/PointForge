'use strict';

async function auth(req, res, next) {
    try {
        if(!req.auth) {
            return res.status(401).json({"message": 'Not authorized'});
        }
        next();
    } catch (error) {
        return res.status(500).json({"Error": 'Something went wrong'});
    }
}

module.exports = auth;