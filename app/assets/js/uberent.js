var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');

var host = 'https://uberent.com';
var platforms = {
    'win32': 'Windows'
    ,'linux': 'Linux'
    ,'darwin': 'OSX'
}

var login = function(login, password) {
    var postdata;
    if (login) {
        postdata = JSON.stringify({ TitleId: 4, AuthMethod: "UberCredentials", UberName: login, Password: password })
    }
    else if (getSessionTicket()) {
        postdata = JSON.stringify({ TitleId: 4, AuthMethod: "UberCredentials", SessionTicket: getSessionTicket() })
    }
    else {
        var deferred = $.Deferred()
        deferred.reject();
        return deferred.promise();
    }
    
    var promise = $.ajax(host + '/GC/Authenticate', {
        type: 'post'
        ,data: postdata
        ,dataType: 'json'
        ,success: function(data, textStatus, jqXHR) {
            console.log(data);
            setSessionTicket(data.SessionTicket);
        }
        ,error: function(jqXHR, textStatus, errorThrown) {
            console.log(errorThrown);
            logout();
        }
    });
    
    return promise;
};

var logout = function() {
    setSessionTicket();
}

var setSessionTicket = function(sessionTicket) {
    if(sessionTicket)
        localStorage.SessionTicket = sessionTicket;
    else
        localStorage.removeItem('SessionTicket');
}

var getSessionTicket = function() {
    return localStorage.SessionTicket;
}

var listStreams = function() {
    $.ajax(host + '/Launcher/ListStreams', {
        data: { Platform: 'Windows' }
        ,headers: { "X-Authorization": localStorage.SessionTicket }
        ,dataType: 'json'
        ,success: function(data) {
            getManifest(data.Streams[0]);
        }
    })
}

var getManifest = function(stream) {
    var downloadurl = stream.DownloadUrl + "/" + stream.TitleFolder + "/" + stream.ManifestName + stream.AuthSuffix
    
    $.get(downloadurl, function(gzdata) {
        var gzbuffer = new Buffer(new Uint8Array(gzdata));
        zlib.gunzip(gzbuffer, function(err, buffer) {
            var manifest = JSON.parse(buffer);
            console.time('verify');
            for(var i = 0; i < manifest.bundles.length; ++i) {
                var bundle = manifest.bundles[i];
                
                for(var j = 0; j < bundle.entries.length; ++j) {
                    var entry = bundle.entries[j];
                    
                    var checksum = entry.checksum;
                    var filename = entry.filename;
                    
                    var filepath = path.join('D:/Games/Planetary Annihilation/Planetary Annihilation/stable', filename);
                    
                    if(fs.existsSync(filepath)) {
                        var fsbuffer = fs.readFileSync(filepath);
                        var sha1 = crypto.createHash('sha1').update(fsbuffer).digest("hex");
                    }
                    
                    if(checksum !== sha1) {
                        console.log(filename);
                    }
                }
            }
            console.timeEnd('verify');
        });
    }
    ,"arraybuffer");
}

exports.login = login;
exports.logout = logout;
exports.getSessionTicket = getSessionTicket;

exports.experimental = listStreams;
