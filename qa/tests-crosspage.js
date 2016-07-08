var Browser = require('zombie'),
	assert = require('chai').assert;

var browser;

suite('Cross-Page Tests', function() {
	setup(function() {
		browser = new Browser();
	});
	
	test('requesting information from the website project page should populate the referrer field', function(done) {
		var referrer = 'http://localhost:3000/projects/website';
		browser.visit(referrer, function() {
			browser.clickLink('.requestInformation', function() {
				assert(browser.field('referrer').value === referrer);
				done();
			});
		});
	});

	test('visiting the "request information" page directly should result in an empty referrer field', function(done) {
		browser.visit('http://localhost:3000/projects/request-information', function() {
			assert(browser.field('referrer').value === '');
			done();
		});
	});
});