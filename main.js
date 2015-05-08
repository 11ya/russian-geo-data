var ogr2ogr = require('ogr2ogr');
var fs = require('fs');
var topojson = require('topojson');
var d3 = require('d3');
var jsdom = require('jsdom');
var SVGO = require('svgo');

svgo = new SVGO({plugins: [
	{cleanupAttrs: false},
	{cleanupEnableBackground: false},
	{cleanupIDs: false},
	{cleanupListOfValues: false},
	{cleanupNumericValues: true},
	{collapseGroups: false},
	{convertColors: false},
	{convertPathData: true},
	{convertShapeToPath: false},
	{convertStyleToAttrs: false},
	{convertTransform: false},
	{mergePaths: false},
	{moveElemsAttrsToGroup: false},
	{moveGroupAttrsToElems: false},
	{removeComments: false},
	{removeDesc: false},
	{removeDoctype: false},
	{removeEditorsNSData: false},
	{removeEmptyAttrs: false},
	{removeEmptyContainers: false},
	{removeEmptyText: false},
	{removeHiddenElems: false},
	{removeMetadata: false},
	{removeNonInheritableGroupAttrs: false},
	{removeRasterImages: false},
	{removeTitle: false},
	{removeUnknownsAndDefaults: false},
	{removeUnusedNS: false},
	{removeUselessDefs: false},
	{removeUselessStrokeAndFill: false},
	{removeViewBox: false},
	{removeXMLProcInst: false},
	{sortAttrs: false},
	{transformsWithOnePath: false}
]});

toTopoJson('./geo.json');

function toGeoJson(toTopoJson) {
	ogr2ogr('./shapefile/RUS_adm1.shp')
		.format('GeoJSON')
		.timeout(30000)
		.stream()
		.pipe(fs.createWriteStream('./geo.json').on('close', function() {
			console.log('GeoJSON: ok');

			toTopoJson('./geo.json');
		}));	
}

function cloneData(data) { //Necessary for topojson.topology, because it has to edit input data
	return JSON.parse(JSON.stringify(data));
}

function toTopoJson(filename) {
	fs.readFile(filename, 'utf8', function (err, data) {
		if (err) {
			return console.log('Error: ' + err);
		}

		data = JSON.parse(data);
		var options = {'verbose': false};
		var topology = topojson.topology({collection: cloneData(data)}, options);

		simplifyAndSaveSvg(cloneData(data), 1);
		simplifyAndSaveSvg(cloneData(data), 0.1);
		simplifyAndSaveSvg(cloneData(data), 0.2);
		simplifyAndSaveSvg(cloneData(data), 0.3);
	});
}

function simplifyAndSaveSvg(data, proportion) {
	simplifyTopoJson(data, proportion, function(topology) {
		var fileSuffix = proportion == 1 ? "" : "-" + proportion;

		saveTopoJson(topology, './topo' + fileSuffix + '.json');

		generateSvg(topology, function(data) {
			saveSvg(data, './map' + fileSuffix + '.svg');
		});
	});
}

function simplifyTopoJson(data, proportion, callback) {
	var options = {'retain-proportion': proportion, 'verbose': false};
	var topology = cloneData(topojson.topology({collection: data}, options));
	topology = topojson.simplify(topology, options);
	console.log('Simplify to ' + proportion + ': ok');
	callback(topology);
}

function saveTopoJson(topology, filename) {
	fs.writeFile(filename, JSON.stringify(topology), function(err) {
		if (err) {
			return console.log('Error: ' + err);
		}
		console.log('TopoJSON ' + filename + ': ok');
	});
}

function generateSvg(topology, callback) {
	jsdom.env('<html><body></body></html>', [], function(err, window) {
		console.log("generating svg...");
		
		var width = 1000,
			height = 500;

		d3.select("body")
			.selectAll("svg")
			.remove();

		var svg = d3.select("body")
	        .append("svg")
	        .attr("width", width)
	        .attr("height", height)
	        .attr("xmlns", 'http://www.w3.org/2000/svg')
	        .attr("xmlns:xlink", 'http://www.w3.org/1999/xlink');

	    var styleDef = svg.append('defs')
	    	.append('style')
	    	.text('path {stroke: #8C8F7C; stroke-width: 1px; fill-opacity: 0.8; fill: #C0C0C0;} ' +
	    		'path:hover {fill-opacity: 1;}');

		var projection = d3.geo.albers()
			.rotate([-105, 0])
			.center([-10, 65])
			.parallels([52, 64])
			.scale(700)
			.translate([width / 2, height / 2]);

		var path = d3.geo.path().projection(projection);

		svg.append("g")
			.selectAll("path")
			.data(topojson.feature(topology, topology.objects.collection).features)
			.enter()
			.append("path")
			.attr("d", path)
			.attr("class", "region");

		var svgData = d3.select("body").html();

		optimizeSvg(svgData, callback);
	});
}

function optimizeSvg(data, callback) {
	console.log("optimizing svg...");
	svgo.optimize(data, function(result) {
		callback(result.data);
    });
}

function saveSvg(data, filename) {
    fs.writeFile(filename, data, function(err) {
		if (err) {
			return console.log('Error: ' + err);
		}
		console.log('svg ' + filename + ': ok');
	});
}