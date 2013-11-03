var fs = require('fs');
if(fs.existsSync('./newrelic.js'))
	require('newrelic');

var express = require('express');
var app = express();
var moment = require('moment');
var im = require('imagemagick');
var cons = require('consolidate');

var mongo = new (require("mongolian"))({log:{debug:function(){}}});
var tc = mongo.db("leo");
var db = {};
db.images = tc.collection("images");

var includeIP = function(req, res, next){
	req.addr = req.header('cf-connecting-ip');
	if(!req.addr){
		req.addr = req.header('x-forwarded-for');
		if(req.addr){
			var temp = req.addr.split(',');
			if(temp.length > 1)
				req.addr = temp[temp.length - 1];
		}
	}if(!req.addr)
		req.addr = req.socket.remoteAddress;
    next();
}

var allowCrossDomain = function(req, res, next){
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
}

app.configure(function(){
	app.use(express.compress());
	app.use(allowCrossDomain);
	app.use(includeIP);
	app.use(express.static(__dirname + '/static'));
    app.engine("ejs", cons.ejs);
});

// If you're not using a reverse-proxy, change this to app.listen(80);
app.listen(8009, '127.0.0.1');

var logStream = fs.createWriteStream('log.txt', {'flags': 'w'});
function log(message){
	console.log(getTimestamp() + " " + message);
	logStream.write(getLongTimestamp() + " " + message + '\n');
}function getTimestamp(){
	return moment().format("H:mm");
}function getLongTimestamp(){
	return moment().format("MM/DD H:mm");
}

app.get('/', function(req, res){
	var host = req.headers.host;
	var index = req.headers.host.indexOf("www.");
	if(index != -1)
		host = host.substr(index + 4);
	var site = host.split(".")[0];
	var vars = {
		host: host,
		site: site
	};
	res.render(__dirname + '/index.ejs', {$: vars, open: "<?", close: "?>"});
});

function addImage(old, imgs, i, res){
	var image = imgs[i];
	if(old.indexOf(image) === -1){
		im.identify("./img/" + image, function(err, data){
			if(err || !data)
				return log("ERROR: " + err);
			db.images.insert({
				src: image,
				width: data.width,
				height: data.height
			});
			log("Added " + image);

			i++;
			if(i < imgs.length)
				addImage(old, imgs, i, res);
			else
				res.send("Done!");
		});
	}else{
		i++;
		if(i < imgs.length)
			addImage(old, imgs, i, res);
		else
			res.send("Done!");
	}
}

app.get('/update', function(req, res){
	log("UPDATE\t" + req.addr);
	var old = [];
	db.images.find().forEach(function(img){
		old.push(img.src);
	});
	// TODO: account for images being removed from the directory
	fs.readdir("img", function(err, imgs){
		if(!err && imgs){
			addImage(old, imgs, 0, res);
		}else
			res.send({error: err});
	});
});

function getCandidates(width, height, callback){
	// Lazy version: consider all images equal
	// TODO: choose images based on optimal resolution
	db.images.find().toArray(callback);
}

function chooseCandidate(width, height, imgs, callback){
	/*
	 * Currently, we're just using a random image from the list of candidates.
	 * In the future, some sort of hashing algorithm could be used here such
	 * that requesting an image with certain dimensions would always select the
	 * same candidate. However, since results are cached, this shouldn't be
	 * noticeable. Function is left asynchronous in case a future hashing method
	 * requires it.
	 */
	callback(null, imgs[Math.floor(Math.random() * imgs.length)]);
}

function serveFromCache(filename, req, res){
	// Future cache stats and cleanup could happen here
	log("REQUEST\t" + filename + "\t" + req.addr);
	res.sendfile("./cache/" + filename + ".jpg");
}

app.get('/:width/:height', function(req, res){
	var width = parseInt(req.params.width);
	var height = parseInt(req.params.height);
	if(width > 9000 || height > 9000)
		return res.send("Max size is 9000x9000");
	var size = width + "x" + height;

	fs.exists("cache/" + size + ".jpg", function(exists){
		if(exists)
			return serveFromCache(size, req, res);

		log("CREATE\t" + size + "\t" + req.addr);
		getCandidates(width, height, function(err, imgs){
			if(!err && imgs){
				chooseCandidate(width, height, imgs, function(err, img){
					if(!err && imgs){
						im.convert(["img/" + img.src,
							"-resize", size + "^",
							"-gravity", "center",
							"-extent", size,
							"cache/" + size + ".jpg"],
						function(err, stdout, stderr){
							fs.exists("cache/" + size + ".jpg", function(exists){
								if(!exists){
									log(JSON.stringify([err, stdout, stderr]));
									res.send("Error.");
								}else
									serveFromCache(size, req, res);
							});
						});
					}else
						res.send(err);
				});
			}else
				res.send(err);
		});
	});
});

app.get('/g/:width/:height', function(req, res){
	var width = parseInt(req.params.width);
	var height = parseInt(req.params.height);
	if(width > 9000 || height > 9000)
		return res.send("Max size is 9000x9000");
	var size = width + "x" + height;

	fs.exists("cache/g" + size + ".jpg", function(exists){
		if(exists)
			return serveFromCache("g" + size, req, res);

		log("CREATE\tg" + size + "\t" + req.addr);
		getCandidates(width, height, function(err, imgs){
			if(!err && imgs){
				chooseCandidate(width, height, imgs, function(err, img){
					if(!err && imgs){
						// TODO: Check the cache for a color version of the same resolution
						im.convert(["img/" + img.src,
							"-resize", size + "^",
							"-gravity", "center",
							"-extent", size,
							"-colorspace", "Gray",
							"cache/g" + size + ".jpg"],
						function(err, stdout, stderr){
							fs.exists("cache/g" + size + ".jpg", function(exists){
								if(!exists){
									log(JSON.stringify([err, stdout, stderr]));
									res.send("Error.");
								}else
									serveFromCache("g" + size, req, res);
							});
						});
					}else
						res.send(err);
				});
			}else
				res.send(err);
		});
	});
});

log("Running.");
