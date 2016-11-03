// This is probably some of the worst spaghetti code i've written this year.
// It's also probably got a *lot* of security holes that would allow cross site scripting to occur.

var express = require('express')
var router = express.Router()
var assert = require('assert')
var database = require('../database')
var graphs = require('../graphs')
var auth = require('../auth')

// Should send this date formatting things of to a library to do it for me.

// Maybe roll this back into the main function.
// The api call version has since been changed to not use this.
function extract_post(req) {
    var time = req.body.time
    var count = req.body.count
    var text = req.body.text
    var graph = req.body.graph
    if (time === undefined) time = current_time()
    if (count === undefined) count = 1
    if (text === undefined) text = ''
    time = current_time()
    return {
        graph: graph,
        payload: {
            time: time,
            count: count,
            text: text
        }
    }
}

// Date library stuff.
function current_time() {
    return Math.floor((new Date).getTime() / 1000)
}

tdelta = {
    second: 1,
    minute: 60,
    hour: 60 * 60,
    day: 24 * 60 * 60,
    week: 7 * 24 * 60 * 60
}

// Get some data, return as human-readable graph.
router.get('/:name', database.require_connection, function(req, res, next) {
    var n_ints = 120 // number of intervals
    var interval = undefined;
    if (req.query.i) interval = parseInt(req.query.i);
    if (interval < 0) interval = 1;
    if (interval > tdelta.week) interval = tdelta.week;
    var name = req.params.name
    if (name === undefined || name === '') name = 'example'
    graphs.retreive_graph(name, function (g) {
        console.log(g);
        if (!interval) interval = g.view_timestep
        if (!interval) interval = tdelta.minute
        if (!g.points) g.points = [];
        graphs.post_metadata(name, {'view_timestep': interval})
        interval = Math.ceil(interval / 3);
        var ct = current_time()
        var points = graphs.aggregate_points(ct - interval * n_ints, ct, interval, g.points)
        res.render('data', {name: name, friendly_name: g.name, labels: points.axis, counts: points.vals})
    })
})

// Redirects the user to the example graph.
// BUG: /data redirects to /example rather than /data/example
router.get('/', function(req, res, next) {
    res.redirect(303, 'example')
})

// Post some data.
router.post('/', database.require_connection, auth.require_user, function(req, res, next) {
    var d = extract_post(req)
    // TODO: Better check to see if a graph is invalid or not.
    if (d.graph !== undefined) {
        console.log('Inserting point:', d.graph, d.payload)
        graphs.post_datapoints(d.graph, req.auth.user.username, [d.payload], function (error) {
            console.log('Posted datapoints')
            console.log('/graphs/' + d.graph)
            res.redirect(303, '/graphs/' + d.graph)
        })
    } else {
        console.log('Someone tried to push database to an invalid graph')
    }
})

// Get some data, via the API.
// TODO: Make this take parameters.
// TODO: Reutrn proper status codes.
router.get('/api/', database.require_connection, auth.require_api, function(req, res, next) {
    graphs.retreive_graph('mygraph', function (points) {
        res.setHeader('Content-Type', 'application/json')
        res.send(JSON.stringify(points))
    })
})

// Post some data, via the API.
// TODO: Make this return proper status codes.
router.post('/api/', database.require_connection, auth.require_api, function(req, res, next) {
    let jdata = JSON.parse(req.body)
    for (let d of jdata) {
        if (d.graph !== undefined) {
            console.log('Inserting point:', d.graph, d.points)
            graphs.post_datapoints(d.graph, d.points, function () {
                res.send('Cool bananas!')
            })
        } else {
            console.log('Someone tried to push database to an invalid graph')
        }
    }
})

module.exports = router
