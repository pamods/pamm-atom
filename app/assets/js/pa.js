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
        if(!stat.isFile())
            continue;
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
            var osxapp;
            
            if(platform === "win32") {
                papath = path.join(papath, '../..'); // remove /x64/host
            }
            else if(platform === "linux") {
                papath = path.join(papath, '..'); // remove /host
            }
            else {
                osxapp = path.basename(path.join(papath, '../../..'));
                papath = path.join(papath, '../../../..') // remove /PA.app/Contents/MacOS/host
            }
            
            return {papath: papath, osxapp: osxapp};
        }
    }
    
    return "";
};

function createStreamObject(paPath, osxapp) {
    var platform = process.platform;
    var stream = path.basename(paPath);
    var streamLabel = stream;
    
    var resourcesPath = paPath;
        
    if (platform === 'darwin') {
        if (osxapp && osxapp != 'PA.app' ) {
            stream = osxapp;
            streamLabel = osxapp;
        } else {
            osxapp = 'PA.app';
        }
        resourcesPath = path.join(paPath, '/' + osxapp + '/Contents/Resources');
    }

    var versionPath = path.join(resourcesPath, 'version.txt');

    if(!fs.existsSync(versionPath))
        return;
    var version = fs.readFileSync(versionPath, { encoding: 'utf8' });
    version = (version.split(/\r?\n/))[0];
    
    var buildidPath = path.join(resourcesPath, 'buildid.txt');
    if(!fs.existsSync(buildidPath))
        return;
    var buildid = fs.readFileSync(buildidPath, { encoding: 'utf8' });
    
    var binPath = path.join(resourcesPath, 'PA');

    if (platform === 'win32') {
        binPath = path.join(paPath, 'bin_x64/PA.exe');
    }

    var stockmodspath = path.join(resourcesPath, '/media/stockmods');

    var titans = paPath.indexOf('Planetary Annihilation Titans') != -1;

    var steam = paPath.toLowerCase().indexOf('steamapps') != -1;
    var uberLauncher = !steam;

    var steamId;
    var steamLabel;

    if (steam) {
        stream = 'steam';
        steamId = titans ? '386070' : '233250';
        streamLabel = 'Steam ' + ( titans ? 'Titans' : 'Classic' );
    }

    var communityMods = buildid.substr(0,4) == '2016';
    
    if (communityMods) {
        streamLabel = streamLabel + ' with Community Mods';
    }

    return {
        stream: stream,
        streamLabel: streamLabel,
        paPath: paPath,
        resourcesPath: resourcesPath,
        bin: binPath,
        build: version,
        stockmods: stockmodspath,
        buildid: buildid,
        uberLauncher: uberLauncher,
        steam: steam,
        steamId: steamId,
        steamLabel: steamLabel,
        titans: titans,
        communityMods: communityMods
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
        var papath = lastrunpath.papath;
        var osxapp = lastrunpath.osxapp;
        
        var last = createStreamObject(papath, osxapp);

        if(last) {
            var stream = last.stream;

            streams[stream] = last;

            if (last.uberLauncher) {

                if (last.stream !== 'stable') {
                    var stablePath = path.join(papath, '../stable');
                    var stable = createStreamObject(stablePath);
                    if (stable) {
                        streams['stable'] = stable;
                    }
                }

                if (last.stream !== 'PTE') {
                    var ptePath = path.join(papath, '../PTE');
                    var pte = createStreamObject(ptePath);
                    if (pte) {
                        streams['PTE'] = pte;
                    }
                }
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
