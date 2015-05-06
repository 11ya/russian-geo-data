var ogr2ogr = require('ogr2ogr');
var fs = require('fs');
var topojson = require('topojson');
var d3 = require('d3');
var jsdom = require('jsdom');

function saveSimplifiedTopoJson(data, proportion) {
	var options = {'retain-proportion': proportion, 'verbose': false};
	var topology = topojson.topology({collection: data}, options);
	topojson.simplify(topology, options);
	generateSvg(topology, './map-' + proportion + '.svg');

	fs.writeFile('./topo-' + proportion + '.json', JSON.stringify(topology), function(err) {
		if (err) {
			return console.log('Error: ' + err);
		}
		console.log('TopoJSON ' + proportion + ': ok');
	});
}

function cloneData(data) { //Necessary for topojson.topology, because it edit input data
	return JSON.parse(JSON.stringify(data));
}

function toTopoJson() {
	fs.readFile('./geo.json', 'utf8', function (err, data) {
		if (err) {
			return console.log('Error: ' + err);
		}

		data = JSON.parse(data);
		var options = {'verbose': false};
		var topology = topojson.topology({collection: cloneData(data)}, options);

		fs.writeFile('./topo.json', JSON.stringify(topology), function(err) {
			if (err) {
				return console.log('Error: ' + err);
			}
			console.log('TopoJSON: ok');
		});

		saveSimplifiedTopoJson(cloneData(data), 0.1);
		saveSimplifiedTopoJson(cloneData(data), 0.2);
		saveSimplifiedTopoJson(cloneData(data), 0.3);
	});
}
toTopoJson();

function toGeoJson(toTopoJson) {
	ogr2ogr('./shapefile/RUS_adm1.shp')
		.format('GeoJSON')
		.timeout(30000)
		.stream()
		.pipe(fs.createWriteStream('./geo.json').on('close', function() {
			console.log('GeoJSON: ok');

			toTopoJson();
		}));	
}

function generateSvg(map, filename) {
	jsdom.env('<html><body></body></html>', [], function(err, window) {
		console.log("generating svg...");

		var width = 1000,
			height = 500;

		var svg = d3.select("body")
	        .append("svg")
	        .attr("width", width)
	        .attr("height", height);

			var projection = d3.geo.albers()
				.rotate([-105, 0])
				.center([-10, 65])
				.parallels([52, 64])
				.scale(700)
				.translate([width / 2, height / 2]);

			var path = d3.geo.path().projection(projection);

			svg.append("g")
				.selectAll("path")
				.data(topojson.feature(map, map.objects.collection).features)
				.enter()
				.append("path")
				.attr("d", path)
				.attr("class", "region");

		    fs.writeFile(filename, d3.select("body").html(), function(err) {
				if (err) {
					return console.log('Error: ' + err);
				}
				console.log('svg ' + filename + ': ok');
			});

	});
}
// generateSvg('./topo-0.1.json');