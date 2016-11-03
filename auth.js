var database = require('./database');
var password_hash = require('password-hash');
var randomstring = require('randomstring');

const INVALID_LOGIN = 'Invalid login details'
const DATABASE_ERROR = 'Unknown database error'
const USERNAME_TAKEN = 'Username taken'
const TOKEN_TIMEOUT = 259200000 // 3 days, in milliseconds

function create_user(name, pass, callback) {
    var user = {
        _id: name,
        username: name,
        password_hash: password_hash.generate(pass),
        graphs: [],
        api_token: randomstring.generate(20)
    }
    // console.log('User data:', user);
    database.collection('users').insertOne(user, {}, function (err, result) {
        // console.log('Insert result:', err, result);
        if (err) {
            callback(USERNAME_TAKEN, undefined);
        } else {
            console.log('Account created:', user);
            attempt_login(name, pass, function (err, token) {
                callback(err, token);
            });
        }
    });
}

function attempt_login(name, pass, callback) {
    database.collection('users').findOne({username: name}, {}, function (err, doc) {
        if (!err && doc && password_hash.verify(pass, doc.password_hash)) {
            var token = randomstring.generate(20);
            database.collection('sessions').insertOne({token: token, username: name}, {}, function (err, result) {
                if (err) callback(DATABASE_ERROR, undefined);
                else callback(undefined, token);
            });
        } else {
            callback(INVALID_LOGIN, undefined);
        }
    });
}

// Invalidate a single token.
function logout(token, callback) {
    database.collection('sessions').remove({token: token}, {}, function (err, result) {
        callback(err ? true : false);
    });
}

// Invalidate all tokens associated with a single user's login.
function logout_all(user, callback) {
    console.error('auth.logout_all has not been implemented');
    callback(false);
}

function check_api_token(name, token, callback) {
    database.collection('users').findOne({username: name, api_token: token}, {}, function (err, doc) {
        if (!err && doc) {
            callback(doc);
        } else {
            callback(undefined);
        }
    });
}

function require_api(req, res, next) {
    var t = req.body.api_token
    var u = req.body.api_username
    if (t === undefined) {
        res.status(401)
        res.send('Error: no api token spplied')
    } else if (u === undefined) {
        res.status(401);
        res.send('Error: no username supplied');
    } else {
        check_api_token(u, t, function (user) {
            if (user) {
                if (req.auth == undefined)
                    req.auth = {}
                req.auth.token = t
                req.auth.user = user
                next();
            } else {
                res.status(401)
                res.send('Error: invalid username-token pair')
            }
        })
    }
}

function check_user_token(token, callback) {
    database.collection('sessions').findOne({token: token}, {}, function (err, doc) {
        if (err || !doc) {
            callback(undefined);
        } else {
            database.collection('users').findOne({username: doc.username}, {}, function (err2, doc2) {
                if (err2) {
                    callback(undefined);
                } else {
                    callback(doc2);
                }
            });
        }
    });
}

function require_user(req, res, next) {
    var token = req.cookies.token;
    check_user_token(token, function (user)  {
        if (user === undefined) {
            res.redirect(303, '/auth/login?e=3');
        } else {
            // load the user's details into memory for use later down the call chain
            if (req.auth == undefined) req.auth = {};
            req.auth.user = user;
            req.auth.token = token;
            // refresh the token's lifespan
            // TODO: the server should also keep track of token life spans
            res.cookie('token', token, {maxAge: TOKEN_TIMEOUT});
            next();
        }
    });
}

module.exports = {
    INVALID_LOGIN: INVALID_LOGIN,
    DATABASE_ERROR: DATABASE_ERROR,
    TOKEN_TIMEOUT: TOKEN_TIMEOUT,
    USERNAME_TAKEN: USERNAME_TAKEN,
    attempt_login: attempt_login,
    create_user: create_user,
    require_user: require_user,
    require_api: require_api,
    logout: logout
}
