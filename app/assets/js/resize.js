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
    
    // remember size
    var remembersize = function() {
        try {
            localStorage.screenSize = remote.getCurrentWindow().getSize();
        } catch(error) {
            console.log('ERROR: ' + error);
        }
    }
     $(window).on('resize', _.debounce(remembersize, 100));
});