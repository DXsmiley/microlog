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

var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
]

function nicedate(t) {
    var d = new Date(t * 1000)
    return monthNames[d.getMonth()] + ' ' + d.getDate()
           + ' / ' + d.getHours() + ':' + d.getMinutes()
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

const AGGREGATORS = {
    sum: (x) => x.sum,
    average: (x) => x.count ? x.sum / x.count : 0,
    minimum: (x) => x.min === Infinity || x.min === undefined ? 0 : x.min,
    maximum: (x) => x.max === -Infinity || x.max === undefined ? 0 : x.max
}

// Get some data, return as human-readable graph.
router.get('/:name', database.require_connection, function(req, res, next) {
    // Determine interval width.
    var n_ints = 40 // number of intervals
    var interval = undefined
    if (req.query.i) interval = parseInt(req.query.i)
    if (!interval) interval = tdelta.minute
    if (interval < 0) interval = 1
    if (interval > tdelta.week) interval = tdelta.week
    // Determine aggregation function
    var aggregator = req.query.a;
    if (!(aggregator in AGGREGATORS)) aggregator = 'sum'
    let agg_func = AGGREGATORS[aggregator]
    console.log(req.query.i, aggregator)
    // Redirection to example graph if nothing specified
    var name = req.params.name
    if (name === undefined || name === '') name = 'example'
    // Calculate the intervals
    var time_now = current_time()
    var spans = []
    var axis = []
    var time_end = Math.floor(time_now / interval) * interval
    var time_start = time_end - n_ints * interval
    for (let t = time_start; t < time_end; t += interval) {
        spans.push({left: t, right: t + interval})
        axis.push('"' + nicedate(t + interval) + '"')
    }
    graphs.retreive_intervals(name, spans, function (g) {
        console.log(g)
        res.render('data', {name: name, friendly_name: g.name, labels: axis, counts: g.intervals.map(agg_func)})
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
// router.get('/api/', database.require_connection, auth.require_api, function(req, res, next) {
//     graphs.retreive_graph('mygraph', function (graph) {
//         res.setHeader('Content-Type', 'application/json')
//         res.send(JSON.stringify(graph))
//     })
// })

// Post some data, via the API.
// TODO: Make this return proper status codes.
// TODO: Proper error checking
router.post('/api/', database.require_connection, auth.require_api, function(req, res, next) {
    for (let d of req.body.datasets) {
        if (d.graph && d.points) {
            console.log('Inserting point:', d.graph, d.points)
            var points = [];
            for (let i in d.points) {
                points.push({
                    time: parseInt(i.time),
                    count: parseInt(i.count),
                    text: ''
                })
            }
            graphs.post_datapoints(d.graph, req.auth.user.username, d.points, function () {
                // TODO: send something different if it actually fails
                res.send('All good')
            })
        } else {
            console.log('Someone tried to push database to an invalid graph')
            res.status(404)
            res.send('Graph not found')
        }
    }
})

module.exports = router
