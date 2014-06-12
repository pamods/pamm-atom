var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var rootpath;
var modspath;
var cachepath;

var streams = {};
var last;

function findLastRunPath() {
    var logpath = path.join(rootpath, '/log');
    if(!fs.existsSync(logpath))
        return "";
    
    var logfiles = fs.readdirSync(logpath);
    
    if(logfiles.length === 0)
        return "";
    
    // find last log file
    var lastlogfile
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
            
            if(process.platform === "win32") {
                papath = path.join(papath, '../..'); // remove /x64/host
            }
            else if(process.platform === "linux") {
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
    var stream = path.basename(papath);
    
    var versionpath = path.join(papath, 'version.txt');
    if(!fs.existsSync(versionpath))
        return;
    var version = fs.readFileSync(versionpath, { encoding: 'utf8' });
    
    var binpath;
    var stockmodspath;
    if (process.platform === 'win32') {
        binpath = path.join(papath, 'PA.exe');
        stockmodspath = path.join(papath, '/media/stockmods');
    }
    else if (process.platform === 'linux') {
        binpath = path.join(papath, 'PA');
        stockmodspath = path.join(papath, '/media/stockmods');
    }
    else if (process.platform === 'darwin') {
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

var init = function() {
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
        throw "Unsupported platform: " + process.platform;
    }
    rootpath = path.join(localpath, "/Uber Entertainment/Planetary Annihilation");
    
    modspath = {
        client: path.join(rootpath, "/mods") // client_mods soon(tm)
        ,server: path.join(rootpath, "/server_mods")
    };
    cachepath = path.join(rootpath, "/pamm_cache");
    
    mkdirp.sync(modspath.client);
    mkdirp.sync(modspath.server);
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
                obj.stream = 'stable'
            }
            
            streams[obj.stream] = obj;
            last = obj;
            if(obj2) {
                streams[obj2.stream] = obj2;
            }
        }
    }
};
init();

exports.rootpath = rootpath;
exports.modspath = modspath;
exports.cachepath = cachepath;
exports.last = last;
exports.streams = streams;

