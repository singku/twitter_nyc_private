var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    twitter = require('twitter'),
    users = {};

server.listen(3000);

mongoose.connect('mongodb://localhost/twitter', function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to mongodb!');
    }
});

var twittSchema = mongoose.Schema({
    keyword: String,
    type: String,
    time: Number,
    location: Array
});

var twittHandle = mongoose.model('Twitters', twittSchema);

var twittClient = new twitter({
  consumer_key: 'h8sDwoPDJPOCb0AudnnGuqMFH',
  consumer_secret: 'awvIHfK9xKuNMYitksINlTk8jHgEivop3dPT8eiUIATTlrB7wE',
  access_token_key: '714502742715277312-TcimPtQmCliSdyLl9loFkgacRyAT0Vg',
  access_token_secret: '3KJc4uG2HjXM3dwL9vZk0110PzlpmJcDwOisobliiQKhe'
});

twittClient.stream('statuses/filter', {locations: "-73.999730,40.752123,-73.975167,40.762188"}, function(stream) {
    stream.on('data', function(tweet) {

        var user = tweet.user.screen_name;
        var text = tweet.text;
        var coord = tweet.place.bounding_box.coordinates[0];
				if(tweet.coordinates != null) {
					coord = tweet.coordinates;
				} else {
					coord = [Math.random() * (coord[0][0] - coord[2][0]) + coord[2][0], Math.random() * (coord[0][1] - coord[1][1]) + coord[1][1]];
				}
        var time = parseInt(tweet.timestamp_ms);
        var content = {
            "user":user,
            "text":text,
            "coord":coord
        }
    	function storeHashtag(tweet) {
            var hashtag = [];
            var length = tweet.entities.hashtags.length;
            if(length != 0) {
                for (var i = 0; i < length; i++) {
                    var tag = tweet.entities.hashtags[i].text;
                    var newTwit = new twittHandle({keyword:tag.toUpperCase(), type:"hashtag", time:time, location: coord});
                    newTwit.save(function(err) {
                        if (err) throw err;
                    });
                }
            }
        }

        function storeMention(tweet) {
            var length = tweet.entities.user_mentions.length;
            if(length != 0) {
                for (var i = 0; i < length; i++) {
                    var name = tweet.entities.user_mentions[i].screen_name;
                    var newTwit = new twittHandle({keyword:name.toUpperCase(), type:"mention", time:time, location: coord});
                    newTwit.save(function(err) {
                        if (err) throw err;
                    });
                }
            }
        }

        function storeKeywords(tweet) {
            storeHashtag(tweet);
            storeMention(tweet);
        }
        //console.log(tweet.text);
        storeKeywords(tweet);
        io.sockets.emit('new tweets', content);
    });

    stream.on('error', function(error) {
        throw error;
    });
});

app.get('/', function(req, rsp) {
    rsp.sendfile(__dirname + '/index.html');
});

function schemaGetFirstNBetween(start, end, N) {
    var schema = [
        { $match: {"time": {$gte:start, $lt:end}}},
        { $group: {_id: "$keyword", "count": {$sum:1}}},
        { $sort: {count: -1}},
        { $limit: N}
    ];
    return schema;
}

function schemaGetKeyTrendBetween(keyword, start, end) {
    var schema = [
        { $match: {"time": {$gte:start, $lt:end}, "keyword":keyword}},
        { $sort: {time: 1}},
    ];
    return schema;
}

io.sockets.on('connection', function(socket) {
    //respond keywords list on connection
    var end = Date.now();
    var start = end - 7200*1000;
    twittHandle.aggregate(schemaGetFirstNBetween(start, end, 10), function(err, docs) {
        //console.log(docs);
        socket.emit('keyword sorted list', docs);
    });

    //req and rsp of keyword trend
    socket.on('keyword trend', function(data, callback) {
        twittHandle.aggregate(schemaGetKeyTrendBetween(data.trim().toUpperCase(), start, end), function(err, docs) {
            //console.log(docs);
			if (docs.length == 0) {
				callback("No Data");
				return;
			}
            var result = [];
            var cnt = parseInt((end - start) / (600*1000));
            for (var i = 0; i < cnt; i++) {
                result[i] = 0;
            }
            for (var i = 0; i < docs.length; i++) {
                var time = docs[i].time;
                var id = parseInt((time - start) / (600*1000));
                if (result[id] == undefined) {
                    result[id] = 1;
                } else {
                    result[id] ++;
                }
            }
            //console.log(result);
            var content = {
                "key": data,
                "result": result
            }
            socket.emit('keyword trend', content);
        });
    });

    //socket io cmd format
    socket.on('cmd', function(data, callback) {

    });
});
