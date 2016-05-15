var socket = io.connect();
var mapLoaded = false;
var limit = 10;
var hashRank = []; //descending sorted array with every element like [key, value] (sorted by value)
var mentionRank = []; //descending sorted array ...
var lastHashData = new Map(); // [key,value] value is an obj include set of coords, and set of trends
var lastMentionData = new Map();
//var listColor = ["#b54a4a", "#b4704b", "#b4964b", "#8fba45", "#5bb946", "#4bb470", "#4cafb3", "#4894b7", "#5475ab", "#6353ac"];
var listColor = ['#8b0000','#ba5211','#e08a3a','#fabc71','#ffeab7','#e8facf','#bae1b6','#8eb9a6','#5f849d','#004499'];
var tweets_temp = []; // Records data for real-time tweets
var map;
var animation = [[1, 0.5], [20, 0.8], [30, 0.4], [50, 0]];
var selectedTab = "hash";
var pastHrs = 6;

function showTimeLabel(time) {
	document.getElementById("timeLabel").innerHTML = 'Past ' +time+ 'hrs';
}

function refreshPastData() {
	pastHrs = document.getElementById("pastTimeSelect").value;
	socket.emit('past data', pastHrs);
}
			
function updateList(tag) {
	selectedTab = tag;
	var arg = tag == "hash" ?hashRank :mentionRank;
	var id1 = tag == "hash" ?"hash" :"mention";
	var id2 = tag == "hash" ?"mention" :"hash";
	var hashVisible = tag == "hash" ?"visible" :"none";
	var mentionVisible = tag == "mention" ?"visible" :"none";
	
    document.getElementById(id1).style.backgroundColor = "#5592aa";
    document.getElementById(id1).style.color = "#FFF";
    document.getElementById(id2).style.backgroundColor = "rgba(52, 152, 219, 0)";
    document.getElementById(id2).style.color = "#5592aa";

	for (var i = 0; i < limit; i++) {
		map.setLayoutProperty("hash_"+i, 'visibility', hashVisible);
		map.setLayoutProperty("mention_"+i, 'visibility', mentionVisible);
	}
   
				
	$('#ranking').empty();
	var list = $('<ul/>').appendTo('#ranking');
	var base = hashRank[0][1] * 1.3;
	for (var i = 0;i < limit; i++) {
		// New <li> elements are created here and added to the <ul> element.
		list.append('<div class="row"><div class="progress" onclick="filtMapData(\''+tag+'\','+i+')" ><div class="progress-bar progress-bar-warning " role="progressbar" style="width:'+arg[i][1]/base*100+'%; background-color:'+listColor[i]+';">'+
		'<div class="progress-label">'+arg[i][0]+'</div></div>'+
		'<div class="progress-num">'+arg[i][1]+'</div>'+
		'</div></div>');
	};
}

function filtMapData(tag, idx) {
	var layer = tag + "_" + idx;
	for (var i = 0; i < limit; i++) {
		map.setLayoutProperty("hash_"+i, 'visibility', "none");
		map.setLayoutProperty("mention_"+i, 'visibility', "none");
	}
	map.setLayoutProperty(layer,'visibility', "visible");
}

function procPastData(data) {
	var hashRankNsort = {};
	var mentionRankNsort = {};
	lastHashData.clear();
	lastMentionData.clear();

	var trendGridCnt = pastHrs*6;
	var startTime = Date.now() - pastHrs * 3600 * 1000;
	tweets_temp = [];
	for (var i = 0; i < data.length; i++) {
		tweets_temp.push(data[i]);
		var property = data[i].properties.keyword;
		var itsTime = data[i].properties.time;
		var idx = parseInt((itsTime - startTime) / (600*1000));

		if (data[i].properties.type == "mention") {
			if (mentionRankNsort[property] === undefined) {
				mentionRankNsort[property] = 1;
			} else {
				mentionRankNsort[property]++;
			}
			//map
			var locs = [];
			var trends = [];
			if (lastMentionData.has(property)) {
				locs = lastMentionData.get(property).locs;
				trends = lastMentionData.get(property).trends;
				locs.push(data[i].geometry.coordinates);
				trends[idx]++;
			} else {
				for (var k = 0; k < trendGridCnt; k++) {
					trends[k] = 0;
				}
				trends[idx]++;
				locs.push(data[i].geometry.coordinates);
				lastMentionData.set(property, {"locs":locs, "trends":trends});
			}
			
		} else {
			if (hashRankNsort[property] === undefined) {
				hashRankNsort[property] = 1;
				hashRankNsort[property] = 1;
			} else {
				hashRankNsort[property]++;
			}
			//map
			var locs = [];
			var trends = [];
			if (lastHashData.has(property)) {
				locs = lastHashData.get(property).locs;
				trends = lastHashData.get(property).trends;
				locs.push(data[i].geometry.coordinates);
				trends[idx]++;
			} else {
				for (var k = 0; k < trendGridCnt; k++) {
					trends[k] = 0;
				}
				trends[idx]++;
				locs.push(data[i].geometry.coordinates);
				lastHashData.set(property, {"locs":locs, "trends":trends});
			}
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
	}
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
    var TopHash;
	for (var i = 0; i < limit; i++) {
		var layer = "hash_" + i;
		var key = hashRank[i][0];
        var temp += keyLocSetToGeoArray(key, lastHashData.get(key).locs);
        console.log(temp);
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastHashData.get(key).locs));
	}
    ChangeLayerLastData("text", TopHash);
	for (var i = 0; i < limit; i++) {
		var layer = "mention_" + i;
		var key = mentionRank[i][0];
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastMentionData.get(key).locs));
	}
	ChangeLayerData("tweets_marker", tweets_temp);
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
	})

	map.addLayer({
		"id": name, // "interactive": true,
		"type": "circle", 
		"source": name,
		"paint": {
			"circle-color": color,
			"circle-radius": radius,
			"circle-opacity": opacity
		}
	});
}

function registerExtraLayer(name, color) {
    map.addSource(name, {
        "type": "geojson",
        "data": genGeoTweets([]), 
		cluster: true, 
		clusterMaxZoom: 40, // Max zoom to cluster points on
		clusterRadius: 50
    });
    map.addLayer({
        "id": name,
        "type": "symbol",
        "source": name,

        "layout": {
                    "icon-allow-overlap": true,
                    "text-field":"{text}",
                    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                    "text-size": 9,
                    "text-transform": "uppercase",
                    "text-letter-spacing": 0.05,
                    "text-offset": [0, 1.5]
                },
                "paint": {
                    "text-color": "#202",
                    "text-halo-color": color,
                    "text-halo-width": 2
                }
    });
}

function showPoint(tweet) {
	tweets_temp.push(tweet);
	ChangeLayerData("tweets_marker", tweets_temp);
	ChangeLayerData("point_marker", [tweet]);
	animatePoint("point_marker", Date.now());
}


function drawTrends(extraId) {
	var jsonData = [];
	if (selectedTab == "hash") {
		for (var i = 0; i < 3; i++) {
			jsonData.push({
				"key": hashRank[i],
				"trends": lastHashData.get(hashRank[i]).trends	
			});
		}
		if (extraId < limit && extraId >= 3) {
			jsonData.push({
				"key": hashRank[extraId],
				"trends": lastHashData.get(hashRank[extraId]).trends	
			});
		}
	} else {
		for (var i = 0; i < 3; i++) {
			jsonData.push({
				"key": mentionRank[i],
				"trends": lastMentionData.get(mentionRank[i]).trends	
			});
		}
		if (extraId < limit && extraId >= 3) {
			jsonData.push({
				"key": mentionRank[extraId],
				"trends": lastMentionData.get(mentionRank[extraId]).trends	
			});
		}			
	}
}