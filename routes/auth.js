var express = require('express');
var router = express.Router();
var auth = require('../auth');
var database = require('../database');

router.get('/login', database.require_connection, function(req, res, next) {
    error_code = req.query.e;
    console.log(error_code);
    res.render('auth/login', {error: error_code});
});

router.post('/login', database.require_connection, function(req, res, next) {
    var name = req.body.username;
    var pass = req.body.password;
    auth.attempt_login(name, pass, function (err, token) {
        if (err == auth.INVALID_LOGIN) {
            res.redirect(303, '?e=1')
        } else if (err == auth.DATABASE_ERROR) {
            res.redirect(303, '?e=2')
        } else {
            res.cookie('token', token, {maxAge: auth.TOKEN_TIMEOUT});
            res.redirect(303, '/dashboard');
        }
    });
});

router.get('/create', database.require_connection, function(req, res, next) {
    error_code = req.query.e;
    res.render('auth/create', {error: error_code});
});

router.post('/create', database.require_connection, function(req, res, next) {
    console.log('Creating user:', req.body.username);
    if (req.body.password !== req.body.password_repeat) {
        res.redirect(303, '/auth/create?e=4');
    } else {
        auth.create_user(req.body.username, req.body.password, function (err, token) {
            if (err == auth.USERNAME_TAKEN) {
                res.redirect(303, '/auth/create?e=5');
            } else if (err !== undefined) {
                res.redirect(303, '/auth/create?e=1');
            } else {
                res.cookie('token', token, {maxAge: auth.TOKEN_TIMEOUT});
                res.redirect(303, '/dashboard');
            }
        });
    }
});

router.get('/logout', database.require_connection, auth.require_user, function (req, res, next) {
    auth.logout(req.auth.token, function (err) {
        res.redirect(303, '/auth/login');
    });
});

module.exports = router;
