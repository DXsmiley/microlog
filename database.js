var dbclient = require('mongodb').MongoClient;

var db = null;

const URL = process.env.DATABASE_LOGIN || 'mongodb://localhost:27017/microlog'

dbclient.connect(URL, function(err, adb) {
    if (err === null) {
        console.log('Connected to the database.');
        db = adb;
    } else {
        console.error('Failed to connect to the database.');
        console.error(err);
    }
});

module.exports = {
    collection: function(col) {
        return db.collection(col);
    },
    require_connection: function(req, res, next) {
        if (db === null) {
            res.status(500);
            res.send('Server does not have access to the database at this time. Try again later.');
        } else {
            next();
        }
    }
};
