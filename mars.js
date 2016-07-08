var credentials = require('./credentials.js'); // contains cookieSecret, use for db settings etc. later
var express = require('express');
var app = express();
var http = require('http');
var bodyParser = require('body-parser');
var handlebars = require('express-handlebars');
var cookieParser = require('cookie-parser')(credentials.cookieSecret);
var expressSession = require('express-session');
var connect = require('connect');
var compression = require('compression');
var morgan = require('morgan');
var fs = require('fs');

handlebars = handlebars.create({ 
	defaultLayout: 'main',
	helpers: {
		section: function(name, options){
			if(!this._sections) this._sections = {};
			this._sections[name] = options.fn(this);
			return null;
		}
	} 
});

var accessLogStream = fs.createWriteStream(__dirname + '/log/requests.log', { flags: 'a' });

app.engine('handlebars', handlebars.engine);

app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 3000);

// =======================================
// ERROR HANDLING
// TO DO: replace, domain is deprecated
// https://nodejs.org/api/domain.html
// =======================================

app.use(function(req, res, next) {
	// Create a domain for this request
	var domain = require('domain').create();
	// Handle errors
	domain.on('error', function(err) {
		console.error('DOMAIN ERROR CAUGHT\n', err.stack);
		try {
			// Failsafe shutdown in five
			setTimeout(function() {
				console.error('Failsafe shutdown.');
				process.exit(1);
			}, 5000);

			// Disconnect worker from cluster
			var worker = require('cluster').worker;
			if (worker) worker.disconnect();
			server.close();

			try {
				// Try to use Express error route
				next(err);
			} catch(error) {
				// If that doesn't work, try plain Node
				console.error('Express error mechanism failed.\n', error.stack);
				res.statusCode = 500;
				res.setHeader('content-type', 'text/plain');
				res.end('Server error.'); 
			}
		} catch(error) {
			console.error('Unable to send 500 response.\n', error.stack);
		}
	});
	// add req and res objects to domain
	domain.add(req);
	domain.add(res);

	// execute the rest of the request chain in domain
	domain.run(next);
});

// =======================================
// BIND MIDDLEWARE
// =======================================

app.use(compression()); // gzip
app.use(express.static(__dirname + '/public'));
app.use(cookieParser);
app.use(expressSession({
	secret: credentials.cookieSecret,
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(function(req, res, next) {
	res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
	next();
});
app.use(function(req, res, next) {
	if(!res.locals.partials) res.locals.partials = {};
	res.locals.partials.weatherData = getWeatherData();
	next();
});
app.use(function(req, res, next) {
	res.locals.flash = req.session.flash;
	delete req.session.flash;
	next();
});
// See if code gets handled by different workers (bashing F5)
app.use(function(req, res, next) {
	var cluster = require('cluster');
	if(cluster.isWorker) console.log('Worker %d received this request.', cluster.worker.id);
	next();
});

// =======================================
// LOGGING 
// To do: rotate log files
// =======================================

if (app.get('env') == 'production') {
	app.use(morgan('common', { 
		skip: function(req, res) { 
			return res.statusCode < 400; 
		}, 
		stream: accessLogStream 
	}));
} else {
	app.use(morgan('dev'));
}

// =======================================
// ROUTES
// =======================================

app.get('/', function(req, res) {
	res.render('home');
});
app.get('/about', function(req, res) {
	res.render('about', {
		pageTestScript: '/qa/tests-about.js'
	});
});
app.get('/projects/website', function(req, res) {
	res.render('projects/website');
});
app.get('/projects/request-information', function(req, res) {
	res.render('projects/request-information');
});
app.get('/newsletter', function(req, res) {
	res.render('newsletter', { csrf: 'token goes here' });
});
app.post('/process', function(req, res) {
	console.log('Formulier van: ' + req.query.form);
	console.log('CSRF token: ' + req.body._csrf);
	console.log('Name: ' + req.body.name);
	console.log('Mail: ' + req.body.email);
	req.session.flash = {
		type: 'success',
		intro: 'Thank you!',
		message: 'Signup was succesful!'
	};
	res.redirect(303, '/thank-you');
});

app.get('/epic-fail', function(req, res) {
	process.nextTick(function() {
		throw new Error('Kaboom!');
	});
});

// =======================================
// ERROR HANDLING
// =======================================

app.use(function(req, res) {
	res.status(404);
	res.render('404');
});
app.use(function(err, req, res, next) {
	console.error(err.stack);
	app.status(500).render('500');
});

// =======================================
// BOGUS WEATHER FUNCTION
// =======================================

function getWeatherData() {
	return {
		locations: [
			{
				name: 'Krimpen aan den IJssel',
				forecastUrl: 'http://www.weeronline.nl/Europa/Nederland/Krimpen-aan-den-IJssel/4057872',
				iconUrl: 'http://icons.wxug.com/i/c/a/sunny.gif',
				weather: 'Sunny',
				temp: '20.4 C'
			}
		]
	};
}

// =======================================
// SERVER START
// =======================================
// Wrap server start in a function for cluster support
function startServer() {
	http.createServer(app).listen(app.get('port'), function() {
		console.log('Express gestart in ' + app.get('env') + ' mode op http://localhost:' + app.get('port') + '.');
	});
}

if(require.main === module) {
	// runs directly
	startServer();
} else {
	// app is imported as a module, export function
	module.exports = startServer;
}