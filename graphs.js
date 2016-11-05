var defaultdict = require('defaultdict2');
var database = require('./database');

const MAX_TREE_LEVEL = 21;
const MAX_INTERVAL_WIDTH = 1 << MAX_TREE_LEVEL;
const METADATA_FIELDS = ['owner', 'name', 'view_timestep'];

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

// Takes in a partial tree and sums the range
function calculate_interval(tree, left, right) {
    var o = {sum: 0, count: 0}
    for (let level = 0; left < right; ++level, left >>= 1, right >>= 1) {
        if (left & 1) {
            if (tree[level][left]) {
                o.sum += tree[level][left].sum
                o.count += tree[level][left].count
            }
            left++
        }
        if (right & 1) {
            right--
            if (tree[level][right]) {
                o.sum += tree[level][right].sum
                o.count += tree[level][right].count                
            }
        }
    }
    return o
}

function retreive_intervals(graph, intervals, callback) {
    var fields = tree_datapoint_query_command(intervals)
    for (let i in METADATA_FIELDS) fields[i] = 1
    database.collection('graphs').findOne(
        {_id: graph},
        {fields: fields},
        function (err, doc) {
            if (err) {
                console.error('Gettings points from database failed');
                console.error(err);
            } else {
                console.log(doc)
                var result = [];
                for (let i of intervals)
                    result.push(calculate_interval(doc.tree, i.left, i.right))
                doc.intervals = result
                callback(doc);
            }
        }
    );
}

// Takes in a list of datapoint to update and returns a mongoDB
// query that can then be used to make the updates
function tree_datapoint_update_command(points) {
    var pieces = defaultdict(0)
    for (let point of points) {
        let index = point.time
        for (let level = 0; level < MAX_TREE_LEVEL; level++) {
            pieces['tree.' + level + '.' + index + '.sum'] += parseInt(point.count)
            pieces['tree.' + level + '.' + index + '.count'] += 1
            index >>= 1
        }
    }
    var result = {}
    for (let i in pieces) result[i] = pieces[i]
    return result
}

function tree_datapoint_query_command(ranges) {
    var set = new Set()
    for (let range of ranges) {
        var left = range.left
        var right = range.right
        if (right - left >= MAX_INTERVAL_WIDTH) {
            console.error('Query interval larger than maximum width. Skipping.')
        } else {
            for (let level = 0; left < right; ++level, left >>= 1, right >>= 1) {
                if (left & 1) {
                    set.add('tree.' + level + '.' + left)
                    left++
                }
                if (right & 1) {
                    right--
                    set.add('tree.' + level + '.' + right)
                }
            }
        }
    }
    var result = {};
    for (let i of set) result[i] = 1
    return result
}

// This needs to pass an error if it fails.
function post_datapoints(graph, username, dpoints, callback) {
    database.collection('graphs').updateOne(
        {_id: graph, owner: username},
        {
            $push: {points: {$each: dpoints} },
            $inc: tree_datapoint_update_command(dpoints)
        },
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
        if (METADATA_FIELDS.includes(i)) {
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
    aggregate_points: aggregate_points,
    retreive_intervals: retreive_intervals
}
