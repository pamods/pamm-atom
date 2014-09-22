var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var rootpath;
var modspath;
var cachepath;

var logpath;
var lastlogfile;

var streams = {};
var last;

function findLastRunPath() {
    var platform = process.platform;
    
    if(!fs.existsSync(logpath))
        return "";
    
    var logfiles = fs.readdirSync(logpath);
    
    if(logfiles.length === 0)
        return "";
    
    // find last log file
    var laststat;
    for(var i = 0; i < logfiles.length; ++i) {
        var logfile = path.join(logpath, logfiles[i]);
        var stat = fs.statSync(logfile);
        if(lastlogfile) {
            if(stat.mtime.getTime() < laststat.mtime.getTime())
                continue;
        }
        lastlogfile = logfile;
        laststat = stat;
    }
    
    // read log file & split to lines
    var logs = fs.readFileSync(lastlogfile, { encoding: 'utf8' });
    var lines = logs.split(/\r?\n/);
    
    // find the right line
    for(i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if(line.indexOf("Coherent host dir: ") !== -1) {
            // extract PA path
            var spos = line.indexOf('"') + 1;
            var epos = line.lastIndexOf('"');
            var papath = line.substring(spos, epos);
            
            if(platform === "win32") {
                papath = path.join(papath, '../..'); // remove /x64/host
            }
            else if(platform === "linux") {
                papath = path.join(papath, '..'); // remove /host
            }
            else {
                papath = path.join(papath, '../../../..') // remove /PA.app/Contents/MacOS/host
            }
            
            return papath;
        }
    }
    
    return "";
};

function createStreamObject(papath) {
    var platform = process.platform;
    var stream = path.basename(papath);
    
    var versionpath = path.join(papath, platform === 'darwin' ? '/PA.app/Contents/Resources' : '', 'version.txt');
    if(!fs.existsSync(versionpath))
        return;
    var version = fs.readFileSync(versionpath, { encoding: 'utf8' });
    version = (version.split(/\r?\n/))[0];
    
    var binpath;
    var stockmodspath;
    if (platform === 'win32') {
        binpath = path.join(papath, 'PA.exe');
        stockmodspath = path.join(papath, '/media/stockmods');
    }
    else if (platform === 'linux') {
        binpath = path.join(papath, 'PA');
        stockmodspath = path.join(papath, '/media/stockmods');
    }
    else if (platform === 'darwin') {
        binpath = path.join(papath, '/PA.app/Contents/MacOS/PA');
        stockmodspath = path.join(papath, '/PA.app/Contents/Resources/stockmods/');
        if(!fs.existsSync(stockmodspath)) {
            stockmodspath = path.join(papath, '/PA.app/Contents/Resources/media/stockmods/');
        }
    }
    
    return {
        stream: stream
        ,build: version
        ,bin: binpath
        ,stockmods: stockmodspath
    }
}

var initialize = function() {
    var localpath;
    if (process.platform === 'win32') {
        localpath = process.env.LOCALAPPDATA
    }
    else if (process.platform === 'linux') {
        localpath = path.join(process.env.HOME, "/.local")
    }
    else if (process.platform === 'darwin') {
        localpath = path.join(process.env.HOME, "/Library/Application Support")
    }
    else {
        throw new Error("Unsupported platform: " + process.platform);
    }
    
    rootpath = path.join(localpath, "/Uber Entertainment/Planetary Annihilation");
    if(!rootpath.match(/^[\x00-\x7F]+$/i)) {
        throw new Error("Non-ASCII characters found in '" + rootpath + "'. Sorry, but Planetary Annihilation is known to not work properly with unicode characters.");
    }
    
    logpath = path.join(rootpath, '/log');
    
    modspath = {};
    
    modspath.client = path.join(rootpath, "/client_mods");
    if(!fs.existsSync(modspath.client)) {
        var oldclient = path.join(rootpath, "/mods");
        if(!fs.existsSync(oldclient)) {
            mkdirp.sync(modspath.client);
        }
        else {
            modspath.client = oldclient;
        }
    }
    
    mkdirp.sync(modspath.client);
    
    modspath.server = path.join(rootpath, "/server_mods");
    mkdirp.sync(modspath.server);
    
    cachepath = path.join(rootpath, "/pamm_cache");
    mkdirp.sync(cachepath);
    
    var lastrunpath = findLastRunPath();
    if (lastrunpath) {
        var obj = createStreamObject(lastrunpath);
        var obj2;
        
        if(obj) {
            if (obj.stream === 'stable') {
                var obj2 = createStreamObject(path.join(lastrunpath, '../PTE'));
            }
            else if (obj.stream === 'PTE') {
                var obj2 = createStreamObject(path.join(lastrunpath, '../stable'));
            }
            else {
                // Steam distrib ?
                obj.stream = 'steam'
            }
            
            streams[obj.stream] = obj;
            last = obj;
            if(obj2) {
                streams[obj2.stream] = obj2;
            }
        }
    }
    
    exports.rootpath = rootpath;
    exports.modspath = modspath;
    exports.cachepath = cachepath;
    exports.last = last;
    exports.streams = streams;
};

var deferredInitialize = $.Deferred(function(deferred) {
    try {
        initialize();
        deferred.resolve();
    }
    catch(error) {
        deferred.reject(error);
    }
});

exports.ready = deferredInitialize.promise();
