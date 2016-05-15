var hashRank = []; //descending sorted array with every element like [key, value] (sorted by value)
var mentionRank = []; //descending sorted array ...
var lastHashData = new Map(); // [key,value] value is set of coords
var lastMentionData = new Map();
var listColor = ["#b54a4a", "#b4704b", "#b4964b", "#8fba45", "#5bb946", "#4bb470", "#4cafb3", "#4894b7", "#5475ab", "#6353ac"];
var tweets_temp = []; // Records data for real-time tweets
var map;
var point_count = 0;
var animation = [[1, 0.5], [20, 0.8], [50, 0.4], [75, 0]];

function updateHash() {
    document.getElementById("hash").style.backgroundColor = "#5592aa";
    document.getElementById("hash").style.color = "#FFF";
    document.getElementById("mention").style.backgroundColor = "rgba(52, 152, 219, 0)";
    document.getElementById("mention").style.color = "#5592aa";


	$('#ranking').empty();
	var list = $('<ul/>').appendTo('#ranking');
	for (var i = 0;i < 10; i++) {
		// New <li> elements are created here and added to the <ul> element.
		list.append('<div class="row"><div class="progress" style="background-color: #B0BEC5;"><div class="progress-bar progress-bar-warning " role="progressbar" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" style="width:'+hashRank[i][1]/(hashRank[0][1]+5)*100+'%; background-color:'+listColor[i]+';">'+hashRank[i][0]+'</div></div></div>');
	};
}

function updateMention() {
    document.getElementById("mention").style.backgroundColor = "#5592aa";
    document.getElementById("mention").style.color = "#FFF";
    document.getElementById("hash").style.backgroundColor = "rgba(52, 152, 219, 0)";
    document.getElementById("hash").style.color = "#5592aa";

	$('#ranking').empty();			
	var list = $('<ul/>').appendTo('#ranking');
	for (var i = 0;i < 10; i++) {
		// New <li> elements are created here and added to the <ul> element.
		list.append('<div class="row"><div class="progress"><div class="progress-bar progress-bar-warning " role="progressbar" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" style="width:'+mentionRank[i][1]+'%; background-color:'+listColor[i]+';">'+mentionRank[i][0]+'</div></div></div>');
	};
}

function procPastData(data) {
	var hashRankNsort = {};
	var mentionRankNsort = {};
	lastHashData.clear();
	lastMentionData.clear();

	for (var i = 0; i < data.length; i++) {
		var property = data[i].properties.keyword;
		if (data[i].properties.type == "mention") {
			if (mentionRankNsort[property] === undefined) {
				mentionRankNsort[property] = 1;
			} else {
				mentionRankNsort[property]++;
			}
			//map
			var locs = [];
			if (lastMentionData.has(property)) {
				locs = lastMentionData.get(property);
			}
			locs.push(data[i].geometry.coordinates);
			lastMentionData.set(property, locs);
		} else {
			if (hashRankNsort[property] === undefined) {
				hashRankNsort[property] = 1;
				hashRankNsort[property] = 1;
			} else {
				hashRankNsort[property]++;
			}
			//map
			var locs = [];
			if (lastHashData.has(property)) {
				locs = lastHashData.get(property);
			}
			locs.push(data[i].geometry.coordinates);
			lastHashData.set(property, locs)
		}
	}
	hashRank = [];
	mentionRank = [];
	for (var key in hashRankNsort) {
		hashRank.push([key, hashRankNsort[key]]);
	}
	hashRank.sort(function (a, b) {
		return b[1] - a[1]
	});

	for (var key in mentionRankNsort) {
		mentionRank.push([key, mentionRankNsort[key]]);
	}
	mentionRank.sort(function (a, b) {
		return b[1] - a[1]
	});
}

function animatePoint(id, start_time) {
	var cur_frame = Math.floor((Date.now() - start_time) / 200);
	if (cur_frame <= 3) {
		map.setPaintProperty(id, "circle-radius", animation[cur_frame][0]);
		map.setPaintProperty(id, "circle-opacity", animation[cur_frame][1]);
		requestAnimationFrame(function () {
			animatePoint(id, start_time);
		});
	} else {
		map.removeSource(id);
		map.removeLayer(id);
	}
}

function registerTempLayer(name, color) {
	map.addSource(name, {
		"type": "geojson", 
		"data": genGeoTweets([])
	});
	map.addLayer({
		"id": name, // "interactive": true,
		"type": "circle", 
		"source": name,
		"paint": {
			"circle-color": color,
			"circle-radius": 2,
			"circle-opacity": 0.5
		}
	});
}

function ChangeLayerLastData(layer, tweets) {
	tweets = genGeoTweets(tweets);
	map.getSource(layer).setData(tweets);
}

function ChangeLayerData(layer, tweetPoints) {
	tweets = genGeoTweets(tweetPoints);
	map.getSource(layer).setData(tweets);
}

function serveData() {
	for (var i = 0; i < 10; i++) {
		var layer = "marker_" + i;
		var key = hashRank[i][0];
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastHashData.get(key)));
	}
	for (var i = 0; i < 10; i++) {
		var layer = "mention_" + i;
		var key = mentionRank[i][0];
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastMentionData.get(key)));
	}
	//ChangeLayerLastData("restword", restKeyword);
}



function genGeoTweet(tweet) {
	return {
		"type": "Feature", 
		"geometry": {
			"type": "Point", 
			"coordinates": tweet.coord
		}, 
		"properties": {
			"text": tweet.text
		}
	}
}

function genGeoTweets(tweetPoints) {
	points = {
		"type": "FeatureCollection", 
		"features": tweetPoints
	}
	return points;
}

function keyLocSetToGeoArray(key, locations) {
	var geoLocs = [];
	for (var i = 0; i < locations.length; i++) {
		var dummyTweet = {
			"coord": locations[i],
			"text": key
		}
		geoLocs.push(genGeoTweet(dummyTweet));
	}
	return geoLocs;
}

function registerLayer(name, color, docluster, opacity, radius) {
	map.addSource(name, {
		"type": "geojson", 
		"data": genGeoTweets([]), 
		cluster: docluster, 
		clusterMaxZoom: 40, // Max zoom to cluster points on
		clusterRadius: 50
	});

	map.addLayer({
		"id": name, // "interactive": true,
		"type": "circle", 
		"source": name,
		"paint": {
			"circle-color": color,
			"circle-radius": radius,
			"circle-opacity": 0.8
		}
	});
}

function showPoints(tweets) {
	ChangeLayerLastData("marker_all", tweets);
}

function hideLayer(layer) {
	ChangeLayerLastData(layer, []);
}

function showPoint(tweet) {
	tweets_temp.push(tweet);
	ChangeLayerData("marker_temp", tweets_temp);
	var cur_point = "marker_point" + point_count;
	++point_count;
	registerTempLayer(cur_point, "lightblue");
	ChangeLayerData(cur_point, [tweet]);
	animatePoint(cur_point, Date.now());
}

