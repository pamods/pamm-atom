exports.download = function(strURL, opts) {
    if(!opts) opts = {};
    
    var intCurrentMessageID = ++intMessageID;
    var datatype = opts.tofile ? "arraybuffer" : "text";
    
    intDownloading++;
    $("#downloading").show();
    jsAddLogMessage("[Message ID: " + intCurrentMessageID + "] GET <code class='log_url'>" + strURL + "</code>", 4);
    
    $.get(strURL, function(data, textStatus, jqXHR) {
        jsAddLogMessage("[Message ID: " + intCurrentMessageID + "] HTTP " + jqXHR.status, 4);
        
        if(opts.tofile) {
            fs.writeFileSync(opts.tofile, new Buffer(new Uint8Array(data)));
        }
        
        if(opts.success) {
            opts.success(data);
        }
    }, datatype)
    .fail(function(jqXHR, textStatus, errorThrown) {
        jsAddLogMessage("[Message ID: " + intCurrentMessageID + "] ERROR: " + errorThrown, 1);
        
        if(opts.error) {
            opts.error(errorThrown);
        }
    })
    .always(function() {
        var nbdl = --intDownloading;
        if (nbdl == 0) {
            $("#downloading").hide();
        }
    });
}
