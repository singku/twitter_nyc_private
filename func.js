var hashRank = []; //descending sorted array with every element like [key, value] (sorted by value)
var mentionRank = []; //descending sorted array ...
var lastHashData = new Map(); // [key,value] value is set of coords
var lastMentionData = new Map();
var listColor = ["#c84337", "#ca7f35", "#d9be26", "#a1be41", "#3cc382", "#3f88bf", "#3f88bf", "#3f88bf", "#3f88bf", "#3f88bf"];
var tweets_temp = []; // Records data for real-time tweets
var map;
var point_count = 0;
var animation = [[1, 0.5], [20, 1], [50, 0.5], [100, 0]];

function updateHash() {
	var ul = document.getElementById("hashTopList");
	$('#mentionTopList > li').remove();
	$('#hashTopList > li').remove();

	if(ul.childNodes.length == 0){
	  for(var i = 0; i < hashRank.length && i < 10; i++) {
		li = document.createElement("li");
		ul.appendChild(li);
	  }
	}
	for(var i = 0; i < hashRank.length && i < 10; i++) {
	  var li = ul.childNodes[i];
	  li.innerText = hashRank[i][0] + ' : ' + hashRank[i][1];
	  li.style.color = listColor[i];
	}
}

function updateMention() {
	var ul = document.getElementById("mentionTopList");
	$('#mentionTopList > li').remove();
	$('#hashTopList > li').remove();
	if(ul.childNodes.length == 0){
	  for(var i = 0; i < mentionRank.length && i < 10; i++){
		li = document.createElement("li");
		ul.appendChild(li);
	  }
	}
	for(var i = 0; i < mentionRank.length && i < 10; i ++){
	  var li = ul.childNodes[i];
	  li.innerText = mentionRank[i][0] + ' : ' + mentionRank[i][1];
	  li.style.color =  listColor[i];
	}
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

