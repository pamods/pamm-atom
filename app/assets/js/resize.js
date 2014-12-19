$(function() {
    var remote = require('remote');
    var _ = require('lodash');
    
    // restore previous window size
    try {
        if(localStorage.pamm_resize !== "disabled" && localStorage.pamm_screenSize) {
            localStorage.pamm_resize = "disabled";
            var size = localStorage.pamm_screenSize.split(',');
            remote.getCurrentWindow().setSize(parseInt(size[0]), parseInt(size[1]));
            remote.getCurrentWindow().center();
            localStorage.pamm_resize = "enabled";
        }
    } catch(error) {
        console.log('ERROR: ' + error);
    }
    
    // remember size
    var remembersize = function() {
        try {
            localStorage.pamm_screenSize = remote.getCurrentWindow().getSize();
        } catch(error) {
            console.log('ERROR: ' + error);
        }
    }
    $(window).on('resize', _.debounce(remembersize, 100));
});