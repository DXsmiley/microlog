var express = require('express');
var router = express.Router();
var database = require('../database');
var auth = require('../auth');
var randomstring = require('randomstring');
var graphs = require('../graphs');

router.post('/new', database.require_connection, auth.require_user, function (req, res, next) {
    var graph_type = req.body.graph_type;
    var graph_name = req.body.graph_name;
    if (graph_type == undefined || graph_type == '' || graph_type == null) graph_type = 'timeplot';
    if (graph_name == undefined || graph_name == '' || graph_name == null) {
        res.status(500);
        res.send('No graph name specified. Sadness.');
    } else {
        graph_name = graph_name.toString();
        var internal_ref = randomstring.generate(20);
        // probably should be accessing the database directly here
        var user = req.auth.user.username;
        database.collection('users').updateOne(
            {username: user},
            {$push: {graphs: {id: internal_ref, name: graph_name, type: graph_type}}},
            {},
            function (err, result) {
                res.redirect(303, '/dashboard/');
            }
        );
        graphs.post_metadata(internal_ref, {owner: user, name: graph_name});
    }
});

router.get('/', database.require_connection, auth.require_user, function(req, res, next) {
    res.render('dashboard', {user: req.auth.user});
});

module.exports = router;
