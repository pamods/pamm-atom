$(function() {
    var remote = require('remote');
    var _ = require('lodash');
    
    // restore previous window size
    try {
        if(localStorage.screenSize) {
            var size = localStorage.screenSize.split(',');
            remote.getCurrentWindow().setSize(parseInt(size[0]), parseInt(size[1]));
            remote.getCurrentWindow().center()
        }
    } catch(error) {
        console.log('ERROR: ' + error);
    }
    
    // autoresize body with window
    var $window = $(window);
    var $body = $('body');
    
    var autoresize = function() {
        $body.height($window.height() - 180);
    }
    
    $window.on('resize', _.debounce(autoresize, 50, { maxWait: 50 }));
    $window.trigger('resize');
    
    // remember size
    var remembersize = function() {
        try {
            localStorage.screenSize = remote.getCurrentWindow().getSize();
        } catch(error) {
            console.log('ERROR: ' + error);
        }
    }
    $window.on('resize', _.debounce(remembersize, 100));
});