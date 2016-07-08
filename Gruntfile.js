module.exports = function(grunt) {
	// load plugins
	[
		'grunt-contrib-jshint',
		'grunt-link-checker'
	].forEach(function(task) {
		grunt.loadNpmTasks(task);
	});

	// configuration
	grunt.initConfig({
		jshint: {
			app: ['mars.js', 'public/js/**/*.js', 'lib/**/*.js'],
			qa: ['Gruntfile.js', 'public/qa/**/*.js', 'qa/**/*.js']
		},
		linkChecker: {
			dev: {
				site: 'localhost',
				options: {
					initialPort: 3000
				}
			}
		}
	});

	// register tasks
	grunt.registerTask('default', ['jshint', 'linkChecker']);
};