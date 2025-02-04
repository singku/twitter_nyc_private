var socket = io.connect();
var mapLoaded = false;
var limit = 10;
var hashRank = []; //descending sorted array with every element like [key, value] (sorted by value)
var mentionRank = []; //descending sorted array ...
var lastHashData = new Map(); // [key,value] value is an obj include set of coords, and set of trends
var lastMentionData = new Map();
//var listColor = ["#b54a4a", "#b4704b", "#b4964b", "#8fba45", "#5bb946", "#4bb470", "#4cafb3", "#4894b7", "#5475ab", "#6353ac"];
var listColor = ['#ff7f0e','#2ca02c','#1f77b4','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
var tweets_temp = []; // Records data for real-time tweets
var map;
var animation = [[1, 0.5], [20, 0.8], [30, 0.4], [50, 0]];
var selectedTab = "hash";
var pastHrs = 6;
var trendMax = 0;
var dotRadius = 4;

function GetRequest() { 
	var url = location.search; 
	if (url.indexOf("?") != -1) {  
		var str = url.substr(1); 
		strs = str.split("=");  
		if (strs[1]) {
			dotRadius = parseFloat(strs[1]);
		}
	}
}

GetRequest();
/* 
var cScale = d3.scale.category10();
for (var i = 0; i < 10; i++) {
    if (ReduceRadius) {
        listColor[i] = cScale(i*7);
    }
}
 */
 
function msTimeToHms(time) {
	var date = new Date(time);
	// Hours part from the timestamp
	var hours = date.getHours();
	// Minutes part from the timestamp
	var minutes = "0" + date.getMinutes();
	// Seconds part from the timestamp
	var seconds = "0" + date.getSeconds();
	// Will display time in 10:30:23 format
	var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
	return formattedTime;
}
			
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
	var base = arg.length != 0 ?arg[0][1] * 1.3 :0;
	for (var i = 0; i < limit && i < arg.length; i++) {
		// New <li> elements are created here and added to the <ul> element.
		list.append('<div class="row" style="margin:0;"><div class="progress" onclick="filtMapData(\''+tag+'\','+i+')" ><div class="progress-bar progress-bar-warning " role="progressbar" style="width:'+arg[i][1]/base*100+'%; background-color:'+listColor[i]+';">'+
		'<div class="progress-label">'+arg[i][0]+'</div></div>'+
		'<div class="progress-num">'+arg[i][1]+'</div>'+
		'</div></div>');
	};
	
	var text ="";
	if (arg.length != 0) {
		var target = tag == "hash" ?lastHashData.get(arg[0][0]) :lastMentionData.get(arg[0][0]);
		for (var i = 0; i < target.locs.length; i++) {
			text += "<font color=black><b>"+msTimeToHms(target.locs[i].time)+" "+target.locs[i].user+": </b>" +target.locs[i].text +"</font><br><br>";
		}
	}
	$('#tweetsList').html(text);
	$('#tweetsList').scrollTop($('#tweetsList')[0].scrollHeight);
	
	drawTrends(-1);
}

function filtMapData(tag, idx) {
	var layer = tag + "_" + idx;
	for (var i = 0; i < limit; i++) {
		map.setLayoutProperty("hash_"+i, 'visibility', "none");
		map.setLayoutProperty("mention_"+i, 'visibility', "none");
	}
	map.setLayoutProperty(layer,'visibility', "visible");
	
	var target = (tag == "hash") ?lastHashData.get(hashRank[idx][0]) :lastMentionData.get(mentionRank[idx][0]);
	var text ="";
	for (var i = 0; i < target.locs.length; i++) {
		text += "<font color=black><b>"+msTimeToHms(target.locs[i].time)+" "+target.locs[i].user+": </b>" +target.locs[i].text +"</font><br><br>";
	}
	
	$('#tweetsList').html(text);
	$('#tweetsList').scrollTop($('#tweetsList')[0].scrollHeight);
	

	drawTrends(idx);
}

function procPastData(data) {
	var hashRankNsort = {};
	var mentionRankNsort = {};
	lastHashData.clear();
	lastMentionData.clear();

	var trendGridCnt = pastHrs*6;
	var startTime = Date.now() - pastHrs * 3600 * 1000;
	for (var i = 0; i < data.length; i++) {
		var property = data[i].properties.keyword;
		var itsTime = data[i].properties.time;
		var idx = parseInt((itsTime - startTime) / (600*1000));
		if  (idx < 0) {
			idx = 0;
		} else if (idx >= trendGridCnt) {
			idx = trendGridCnt-1;
		}

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
		        locs.push({
                    "coord":data[i].geometry.coordinates,
                    "user": data[i].properties.user,      
                    "time":data[i].properties.time,
                    "text": data[i].properties.text
                });
				trends[idx].cnt++;
			} else {
				for (var k = 0; k < trendGridCnt; k++) {
					trends[k] = {
						"idx": k,
						"cnt": 0
					};

				}
				trends[idx].cnt++;
				if (trends[idx].cnt > trendMax) trendMax = trends[idx].cnt;
				
                locs.push({
                    "coord":data[i].geometry.coordinates,
                    "user": data[i].properties.user,      
                    "time":data[i].properties.time,
                    "text": data[i].properties.text
                });

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
                locs.push({
                    "coord":data[i].geometry.coordinates,
                    "user": data[i].properties.user,      
                    "time":data[i].properties.time,
                    "text": data[i].properties.text
                });

				trends[idx].cnt++;
			} else {
				for (var k = 0; k < trendGridCnt; k++) {
					trends[k] = {
                        "idx": k,
                        "cnt": 0
                    }
				}
				trends[idx].cnt++;
				if (trends[idx].cnt > trendMax) trendMax = trends[idx].cnt;
                locs.push({
                    "coord":data[i].geometry.coordinates,
                    "user": data[i].properties.user,      
                    "time":data[i].properties.time,
                    "text": data[i].properties.text
                });

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
		return b[1] - a[1];
	});

	for (var key in mentionRankNsort) {
		mentionRank.push([key, mentionRankNsort[key]]);
	}
	mentionRank.sort(function (a, b) {
		return b[1] - a[1];
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
	for (var i = 0; i < limit && i < hashRank.length; i++) {
		var layer = "hash_" + i;
		var key = hashRank[i][0];
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastHashData.get(key).locs));
	}
	for (var i = 0; i < limit && i < mentionRank.length; i++) {
		var layer = "mention_" + i;
		var key = mentionRank[i][0];
		ChangeLayerLastData(layer, keyLocSetToGeoArray(key, lastMentionData.get(key).locs));
	}
	//ChangeLayerData("tweets_marker", tweets_temp);
}

function genGeoTweet(tweet) {
	return {
		"type": "Feature", 
		"geometry": {
			"type": "Point", 
			"coordinates": tweet.coord
		}, 
		"properties": {
            "user": tweet.user,
			"time": tweet.time,
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
            "coord": locations[i].coord,
			"text": locations[i].text,
            "user": locations[i].user,
            "time": locations[i].time
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
	//ChangeLayerData("tweets_marker", tweets_temp);
	ChangeLayerData("point_marker", [tweet]);
	animatePoint("point_marker", Date.now());
}

function drawTrends(extraId) {
	var jsonData = [];
	var yExtend = [];
	if (selectedTab == "hash") {
		if (extraId != -1) {
			jsonData.push({
				"key": hashRank[extraId][0],
				"trends": lastHashData.get(hashRank[extraId][0]).trends	
			});
			yExtend.push(lastHashData.get(hashRank[extraId][0]).trends);	
		} else {
			for (var i = 0; i < 3 && i < hashRank.length; i++) {
				jsonData.push({
					"key": hashRank[i][0],
					"trends": lastHashData.get(hashRank[i][0]).trends
				});
				yExtend.push(lastHashData.get(hashRank[i][0]).trends);
			}			
		}

	} else {
		if (extraId == -1) {
			for (var i = 0; i < 3 && i < mentionRank.length; i++) {
				jsonData.push({
					"key": mentionRank[i][0],
					"trends": lastMentionData.get(mentionRank[i][0]).trends	
				});
				yExtend.push(lastMentionData.get(mentionRank[i][0]).trends);
			}			
		} else {
			jsonData.push({
				"key": mentionRank[extraId][0],
				"trends": lastMentionData.get(mentionRank[extraId][0]).trends	
			});
			yExtend.push(lastMentionData.get(mentionRank[extraId][0]).trends);			
		}
	}
	
	d3.selectAll("path").remove();
	d3.selectAll("#axis").remove();
	d3.selectAll("#xlabel").remove();
	
 	var vis = d3.select("#trend");
    var WIDTH = parseInt(vis.style('width')),
	HEIGHT = parseInt(vis.style('height'));
	console.log(WIDTH);
	console.log(HEIGHT);
	var MARGINS = {
		top: 50/287*HEIGHT,
		right: 40/444*WIDTH,
		bottom: 50/287*HEIGHT,
		left: 30/444*WIDTH
	};
	var xScale = d3.scale.linear().range([MARGINS.left, WIDTH - MARGINS.right-5]).domain([pastHrs*6,0]);
	var range = d3.extent(d3.merge(yExtend), function(d) {return d.cnt;});
	var yScale = d3.scale.linear().range([HEIGHT-MARGINS.top, MARGINS.bottom]).domain([range[0],range[1]*1.2]);
	
	var xAxis = d3.svg.axis()
	.tickFormat(d3.format("d"))
	.scale(xScale);
	
	var yAxis = d3.svg.axis()
	.scale(yScale)
	.tickFormat(d3.format("d"))
    .ticks(7)
	.orient("right");

	vis.append("svg:g")
		.attr("class", "x axis")
		.attr("id", "axis")
		.attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
		.call(xAxis)

    
	vis.append("svg:g")
		.attr("class", "y axis")
		.attr("id", "axis")
		.attr("transform", "translate(" + (WIDTH-MARGINS.right-5) + ",0)")
		.call(yAxis);
		
	var lineGen = d3.svg.line()
		.x(function(d) {
			return xScale((pastHrs*6 - d.idx));
		})
		.y(function(d) {
			return yScale(d.cnt);
		})
		.interpolate("basis");
		
	for (var i = 0; i < jsonData.length; i++) {
		vis.append('svg:path')
		.attr('d', lineGen(jsonData[i].trends))
		.attr('stroke', extraId==-1?listColor[i]: listColor[extraId])
		.attr('stroke-width', 2)
		.attr('fill', 'none');
		
		vis.append("text")
		.attr("id", "xlabel")
		.attr("text-anchor", "left")
		.text(jsonData[i].key)
		.style("fill", extraId==-1?listColor[i]: listColor[extraId])
		.attr("transform", "translate("+ (MARGINS.left) +","+(MARGINS.top+15*(i+1))+")");
	}
	
	vis.append("text")
		.attr("id", "xlabel")
		.attr("text-anchor", "middle")  
		.attr("transform", "translate("+ (WIDTH-3) +","+(HEIGHT/2-30/260*HEIGHT)+")rotate(-90)")  
		.text("Freqency");

	vis.append("text")
		.attr("id", "xlabel")
		.attr("text-anchor", "middle")  
		.attr("transform", "translate("+ (WIDTH/2) +","+(HEIGHT-5)+")")
		.text("Past Time (unit: 10min)");

	vis.append("text")
		.attr("id", "xlabel")
		.attr("text-anchor", "middle")  
		.attr("transform", "translate("+ (WIDTH/2) +","+(MARGINS.top-15/260*HEIGHT)+")")
		.text("Keys' Trend")
        .style("font-size", "14px")
        .style("stroke", "red");
}
