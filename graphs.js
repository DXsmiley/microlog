var database = require('./database');

function retreive_graph(graph, callback) {
    database.collection('graphs').findOne({_id : graph}, {}, function (err, doc) {
        if (err) {
            console.error('Gettings points from database failed');
            console.error(err);
        } else {
            callback(doc);
        }
    });
}

// This needs to pass an error if it fails.
function post_datapoints(graph, username, dpoints, callback) {
    database.collection('graphs').updateOne(
        {_id: graph, owner: username},
        {$push: {points: {$each: dpoints} }},
        function (err, result) {
            if (err) {
                console.error('Failed to post data points');
                console.error(err);
                if (callback) callback(true);
            } else {
                console.log('Datapoints added to', graph);
                if (callback) callback(false);
            }
        }
    );
}

// Needs to pass an error if it fails.
function post_metadata(graph, metadata, callback) {
    var opts = {}
    for (let i in metadata) {
        // console.log('metadata thing:', i)
        if (['owner', 'name', 'view_timestep'].includes(i)) {
            if (metadata[i]) opts[i] = metadata[i]
        } else {
            console.warn('Unknown graph metadata option:', i)
        }
    }
    database.collection('graphs').updateOne(
        {_id: graph},
        {$set: opts},
        {upsert: true},
        function (err, result) {
            if (err) {
                console.error('Failed to save graph metadata')
                console.error(err)
                // console.log('opts:', opts)
                // console.log('medt:', metadata)
            } else {
                console.log('Metadata set on', graph)
                if (callback) callback()
            }
        }
    )
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

// This is *technically* a utility function. I might move it elsewhere.
function aggregate_points(time_start, time_end, time_interval, raw) {
    // console.log(raw)
    var buckets = {}
    for (let i of raw) {
        let time_group = Math.floor(i.time / time_interval)
        i.count = parseInt(i.count)
        if (buckets[time_group] === undefined) buckets[time_group] = i.count
        else buckets[time_group] += i.count
    }
    var out_vals = [];
    var out_axis = [];
    time_start = Math.floor(time_start / time_interval)
    time_end = Math.floor(time_end / time_interval)
    for (let t = time_start; t <= time_end; t += 1) {
        out_axis.push('\'' + nicedate(t * time_interval) + '\'')
        // out_axis.push(t)
        // out_axis.push('lemon' + t)
        let b = buckets[t]
        if (b === undefined) b = 0
        out_vals.push(b)
    }
    // console.log(out_axis);
    return {
        axis: out_axis,
        vals: out_vals
    };
}

module.exports = {
    retreive_graph: retreive_graph,
    post_datapoints: post_datapoints,
    post_metadata: post_metadata,
    aggregate_points: aggregate_points
}
