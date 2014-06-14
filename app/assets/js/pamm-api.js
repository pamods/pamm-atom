var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var pa = require('./pa.js');

var ONLINE_MODS_LIST_URL = {
    client: "http://pamods.github.io/modlist.json"
    ,server: "http://pamods.github.io/servermods.json"
}

var PAMM_MOD_ID = "PAMM";
var PAMM_MOD_IDENTIFIER = "com.pa.deathbydenim.dpamm";
if(process.platform === 'win32') {
    PAMM_MOD_ID = "rPAMM";
    PAMM_MOD_IDENTIFIER = "com.pa.raevn.rpamm";
}

var context = "client";
var stream = pa.last ? pa.last.stream : 'stable';

var installed = {};
var available = {};

var paths = {
    cache: pa.cachepath
    ,mods: pa.modspath.client
    ,pamm: path.join(pa.modspath.client, PAMM_MOD_ID)
};

exports.setContext = function(newcontext) {
    context = newcontext;
    paths.mods = pa.modspath[context];
};

exports.getContext = function() {
    return context;
};

exports.setStream = function(newstream) {
    stream = newstream;
    //TODO play with symlink for mods folders?
};

exports.getStream = function() {
    return stream;
};

exports.getAvailableMods = function (callback) {
    jsDownload(ONLINE_MODS_LIST_URL[context], {
        success: function(data) {
            try {
                var mods = {};
                
                var modlist = JSON.parse(data);
                for (var id in modlist) {
                    var mod = modlist[id];
                    
                    if(context === 'client') {
                        mod.id = id;
                    }
                    else {
                        mod.id = mod.identifier; // for internal use only
                    }
                    
                    mod.likes = -2;
                    
                    //if (jsGetInstalledMod(id) != null && jsGetInstalledMod(id)["date"] < objModData[id]["date"]) {
                        //jsAddLogMessage("Update available for installed mod '" + jsGetInstalledMod(id)["display_name"] + "': " + objModData[id]["version"] + " (" + objModData[id]["date"] + ")", 3);
                    //}
                    
                    mods[mod.id] = mod;
                }
                
                available = mods;
            } catch (e) {
                jsAddLogMessage("Error loading online mod data: " + e.message, 1);
            }
            finally {
                callback(_.toArray(mods));
            }
        }
        ,error: function(e) {
            callback([]);
        }
    });
};

exports.getInstalledMods = function (callback) {
    findInstalledMods();
    callback(
        _.filter(
            _.toArray(installed)
            ,function(mod) { return mod.id !== PAMM_MOD_ID }
        )
    );
};

exports.groupByCategories = function(mods) {
    var categories = {};
    var count = 0;
    for(var key in mods) {
        if (mods.hasOwnProperty(key)) {
            var mod = mods[key];
            count++;
            
            if (!mod.category)
                continue;
            
            for (var i = 0; i < mod.category.length; i++) {
                var category = mod.category[i].replace(" ", "-").toUpperCase();
                if (categories[category] == null) {
                    categories[category] = 1;
                } else {
                    categories[category]++;
                }
            }
        }
    }
    categories['ALL'] = count;
    return categories;
};

exports.getPaths = function () {
    return paths;
};

var getRequires = function(id, requires) {
    var mod = available[id];
    if(!mod) {
        mod = installed[id];
        if(!mod) {
            throw "Mod '" + id + "' not found.";
        }
    }
    
    if(!requires)
        requires = {};
    
    if(mod.requires) {
        //TODO some protection against infinite recurse
        for(var i = 0; i < mod.requires.length; ++i) {
            var require = mod.requires[i];
            requires[require] = require;
            getRequires(require, requires);
        }
    }
    return _.toArray(requires);
};
exports.getRequires = getRequires;

var getRequiredBy = function(id, requiredby) {
    if(!requiredby)
        requiredby = {};
    
    for(var key in installed) {
        if (installed.hasOwnProperty(key)) {
            var mod = installed[key];
            if(mod.requires && mod.requires.indexOf(id) !== -1) {
                requiredby[mod.id] = mod.id;
                getRequiredBy(mod.id, requiredby);
            }
        }
    }
    
    return _.toArray(requiredby);
};
exports.getRequiredBy = getRequiredBy;

exports.install = function (id, callback) {
    var mod = available[id];
    
    var ids = getRequires(id);
    ids.push(id);
    
    var _install = function(ids, callback) {
        if(ids.length === 0) {
            _updateFiles();
            if(callback)
                callback();
            return;
        }
        
        var id = ids.shift();
        jsAddLogMessage("Installing mod '" + id + "'", 3)
        
        var mod = available[id];
        var update = installed[id];
        
        if(!mod) {
            var mod = update;
        }
        
        var basename = id + "_v" + mod.version;
        var cachefile = path.join(paths.cache, basename + ".zip");
        
        var installpath = update ? update.installpath : path.join(paths.mods, id);
        
        if(fs.existsSync(installpath)) {
            var modinfopath = path.join(installpath, "modinfo.json");
            if(fs.existsSync(modinfopath)) {
                var modinfo = fs.readFileSync(modinfopath, { encoding: 'utf8' });
                modinfo = JSON.parse(modinfo);
                if(modinfo.version === mod.version) {
                    if(modinfo.enabled === false) {
                        _enablemod(id, true);
                    }
                    else {
                        jsAddLogMessage("Skipping mod '" + id + "', same version already installed.", 3)
                    }
                    _install(ids, callback);
                    return;
                }
            }
            
            rmdirRecurseSync(installpath);
        }
        
        var _extract = function() {
            var modinfo = _uncompress(id, cachefile, installpath);
            
            if(context === 'server' || !modinfo.id)
                modinfo.id = modinfo.identifier;
            if (!modinfo.priority)
                modinfo.priority = 100;
            modinfo.enabled = true;
            modinfo.installpath = installpath;
            
            installed[id] = modinfo;
            _install(ids, callback);
        };
        
        if(!fs.existsSync(cachefile)) {
            jsAddLogMessage("Downloading mod '" + id + "'", 3)
            jsDownload(mod.url, {
                tofile: cachefile
                ,success: function() {
                    _extract();
                }
                ,error: function(e) {
                    _updateFiles();
                    if(callback)
                        callback(e, id);
                }
            });
        }
        else {
            jsAddLogMessage("Using cache for mod '" + id + "'", 3);
            _extract();
        }
    };
    _install(ids, callback);
};

var _uncompress = function(modid, zipfile, targetfolder) {
    var zipdata = fs.readFileSync(zipfile);
    var zip = new JSZip(zipdata.toArrayBuffer());
    
    // zip.folders not reliable, some directories are not detected as directory (eg. instant_sandbox zip)
    
    // digging modinfo files
    modinfofiles = _.filter(zip.files, function(file) {
        var filepath = file.name;
        return path.basename(filepath) === 'modinfo.json'
    });
    
    if(modinfofiles.length === 0) {
        throw "No modinfo.json found in this achive"
    }
    
    var basepath;
    var modinfo;
    _.forEach(modinfofiles, function(modinfofile) {
        modinfo = JSON.parse(modinfofile.asText());
        if(modid === modinfo.id || modid === modinfo.identifier) {
            basepath = path.dirname(modinfofile.name);
            if(basepath === '.')
                basepath = '';
            return false;
        }
    });
    
    if (basepath === undefined) {
        throw "Mod '" + modid + "' not found in this achive";
    }
    
    var files = zip.files;
    if (basepath !== '') {
        files = _.filter(files, function(file) {
            return file.name.indexOf(basepath + '/') === 0;
        });
    }
    
    if (!fs.existsSync(targetfolder))
        fs.mkdirSync(targetfolder);
    
    for(var i in files) {
        var file = files[i];
        
        var extractpath = path.join(targetfolder, file.name.substring(basepath.length));
        
        if(file.name.indexOf('/', file.name.length - 1) !== -1) {
            if (fs.existsSync(extractpath))
                continue;
            fs.mkdirSync(extractpath);
        }
        else {
            fs.writeFileSync(extractpath, new Buffer(file.asUint8Array()));
        }
    }
    
    return modinfo;
};

exports.uninstall = function(id, callback) {
    var mod = installed[id];
    var installpath = mod.installpath;
    if(fs.existsSync(installpath)) {
        jsAddLogMessage("Uninstalling mod '" + id + "'", 2);
        _disablemod(id);
        rmdirRecurseSync(installpath);
        delete installed[id];
        
        _updateFiles();
        callback();
    }
};

exports.setEnabled = function(id, enabled) {
    var ids = enabled ? _enablemod(id) : _disablemod(id);
    _updateFiles();
    return ids;
}

exports.setAllEnabled = function(enabled) {
    var ids = [];
    for(var key in installed) {
        if (installed.hasOwnProperty(key)) {
            var mod = installed[key];
            try {
                if(enabled) {
                    if(mod.enabled === false) {
                        ids = ids.concat(_enablemod(key));
                    }
                }
                else {
                    if(mod.enabled !== false) {
                        ids = ids.concat(_disablemod(key));
                    }
                }
            }
            catch(e) {}
        }
    }
    _updateFiles();
    return ids;
}

var _enablemod = function(id, force) {
    var enabled = [];
    
    var ids = getRequires(id); // should use "installed" list in this case
    ids.push(id);
    
    for(var i = 0; i < ids.length; ++i) {
        var mod = installed[ids[i]];
        if(!mod && !force) {
            throw "Cannot enable Mod: Required dependency '" + ids[i] + "' is missing"
            return enabled;
        }
    }
    
    for(var i = 0; i < ids.length; ++i) {
        var mod = installed[ids[i]];
        
        if(mod && !mod.enabled) {
            jsAddLogMessage("Mod '" + mod.id + "' ENABLED", 3);
            enabled.push(mod.id);
            mod.enabled = true;
        }
    }
    return enabled;
};

var _disablemod = function(id) {
    var disabled = [];
    
    if(id === PAMM_MOD_ID)
        return disabled;
    
    var ids = getRequiredBy(id);
    ids.push(id);
    
    for(var i = 0; i < ids.length; ++i) {
        var mod = installed[ids[i]];
        
        if(mod && mod.enabled) {
            jsAddLogMessage("Mod '" + mod.id + "' DISABLED", 3);
            disabled.push(mod.id);
            mod.enabled = false;
        }
    }
    return disabled;
};

var CreateFolderIfNotExists = function(path) {
    if(!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
};

var findInstalledMods = function() {
    var mods = {};
    var categories = {};
    var mounted = [PAMM_MOD_IDENTIFIER];
    
    // load mounted mods list (aka enabled mods)
    var modsjsonpath = path.join(paths.mods, 'mods.json');
    if(fs.existsSync(modsjsonpath)) {
        var modsjson = fs.readFileSync(modsjsonpath, { encoding: 'utf8' });
        modsjson = JSON.parse(modsjson);
        if(modsjson.mount_order) {
            mounted = _.union(mounted, modsjson.mount_order);
        }
    }
    
    // load user mods
    var moddirs = fs.readdirSync(paths.mods);
    for (var i = 0; i < moddirs.length; ++i) {
        var dirname = moddirs[i];
        var moddir = paths.mods + '/' + dirname;
        if (fs.statSync(moddir).isDirectory()) {
            try {
                var modinfopath = moddir + '/modinfo.json';
                var strmodinfo = fs.readFileSync(modinfopath, {encoding: 'utf8'});
                
                var mod = {};
                mod = JSON.parse(strmodinfo);
                
                if(mod.enabled === false) {
                    // revert old modinfo updates, or mod packaging error
                    mod.enabled = true;
                    fs.writeFileSync(modinfopath, JSON.stringify(mod, null, 4), { encoding: 'utf8' });
                }
                
                if(context === 'server' || !mod.id)
                    mod.id = mod.identifier;
                
                if (!mod.priority)
                    mod.priority = 100;
                
                mod.enabled = (_.indexOf(mounted, mod.identifier) !== -1);
                
                mod.installpath = moddir;
                
                mods[mod.id] = mod;
                
                var logid = mod.id === dirname ? mod.id : mod.id + " (/" + dirname + ")";
                jsAddLogMessage("Found installed mod: " + logid, 3)
            } catch (err) {
                jsAddLogMessage("Error loading installed mod from '/" + dirname + "'", 4)
            }
        }
    }
    
    // load stock mods
    if(pa.streams[stream]) {
        var stockmodspath = path.join(pa.streams[stream].stockmods, context);
        if(fs.existsSync(stockmodspath)) {
            var moddirs = fs.readdirSync(stockmodspath);
            for (var i = 0; i < moddirs.length; ++i) {
                var id = moddirs[i];
                var moddir = stockmodspath + '/' + id;
                if (fs.statSync(moddir).isDirectory()) {
                    if(mods[id]) {
                        jsAddLogMessage("Skipped stock mod: " + id, 3);
                        continue;
                    }
                    else {
                        jsAddLogMessage("Found stock mod: " + id, 3);
                    }
                    
                    var modinfopath = moddir + '/modinfo.json';
                    var strmodinfo = fs.readFileSync(modinfopath, {encoding: 'utf8'});
                    
                    var mod = {};
                    try {
                        mod = JSON.parse(strmodinfo);
                        
                        mod.id = id;
                        
                        if (!mod.priority)
                            mod.priority = 100;
                        
                        mod.enabled = (_.indexOf(mounted, mod.identifier) !== -1);
                        
                        mod.stockmod = true;
                        
                        mods[id] = mod;
                    } catch (err) {
                        var name = mod.display_name ? mod.display_name : id;
                        //alert("Error loading installed mod '" + name + "'");
                    }
                }
            }
        }
        else {
            jsAddLogMessage("Stock mods folder not found: " + stockmodspath, 1);
        }
    }
    
    installed = mods;
    
    _updateFiles();
}

var _updateFiles = function() {
    var enabledmods = _.sortBy(
        _.filter(
            _.toArray(installed)
            ,function(mod) { return mod.enabled !== false; }
        )
        ,function(mod) { return mod.priority }
    );
    
    // mods/mods.json
    jsAddLogMessage("Writing mods.json", 4)
    var mods = {
        mount_order:
            _.pluck(
                enabledmods
                ,'identifier'
            )
    };
    fs.writeFileSync(
        path.join(paths.mods, 'mods.json')
        ,JSON.stringify(mods, null, 4)
        ,{ encoding: 'utf8' }
    );
    
    if(context === 'server')
        return;
    
    // mods/pamm/uimodlist
    jsAddLogMessage("Writing ui_mod_list.js", 4);
    var globalmodlist = [];
    var scenemodlist = {};
    var scenes = ["armory", "building_planets", "connect_to_game", "game_over", "icon_atlas", "live_game", "live_game_econ", "live_game_hover", "load_planet", "lobby", "matchmaking", "new_game", "replay_browser", "server_browser", "settings", "social", "special_icon_atlas", "start", "system_editor", "transit"] // deprecated
    _.each(scenes, function(scene) { scenemodlist[scene] = []; }); // temp fix for PA Stats => all scenes must be initialized by empty an array
    _.each(enabledmods, function(mod) {
        // deprecated global_mod_list at modinfo root
        if(mod.global_mod_list) {
            globalmodlist = globalmodlist.concat(mod.global_mod_list);
        }
        
        // deprecated scenes at modinfo root
        _.each(scenes, function(scene) {
            if(mod[scene]) {
                if(!scenemodlist[scene])
                    scenemodlist[scene] = []
                scenemodlist[scene] = scenemodlist[scene].concat(mod[scene]);
            }
        });
        
        // scenes
        if(mod.scenes) {
            _.each(mod.scenes, function(modlist, scene) {
                if(scene === "global_mod_list") {
                    globalmodlist = globalmodlist.concat(modlist);
                }
                else {
                    if(!scenemodlist[scene])
                        scenemodlist[scene] = []
                    scenemodlist[scene] = scenemodlist[scene].concat(modlist);
                }
            });
        }
    });
    var uimodlist = "var global_mod_list = " + JSON.stringify(globalmodlist, null, 4) + ";\n\nvar scene_mod_list = " + JSON.stringify(scenemodlist, null, 4) + ";";
    fs.writeFileSync(
        path.join(paths.pamm, 'ui/mods/ui_mod_list.js')
        ,uimodlist
        ,{ encoding: 'utf8' }
    );
    
    // mods/pamm/modlist
    jsAddLogMessage("Writing mods_list.json", 4);
    fs.writeFileSync(
        path.join(paths.pamm, 'ui/mods/mods_list.json')
        ,JSON.stringify(installed, null, 4)
        ,{ encoding: 'utf8' }
    );
};

var init = function() {
    var strPammModDirectoryPath = paths.pamm;
    CreateFolderIfNotExists(strPammModDirectoryPath);
    CreateFolderIfNotExists(strPammModDirectoryPath + "/ui");
    CreateFolderIfNotExists(strPammModDirectoryPath + "/ui/mods");
    
    var modinfo = {
        "context": "client",
        "identifier": PAMM_MOD_IDENTIFIER,
        "display_name": "PA Mod Manager",
        "description": " ",
        "author": "pamm-atom",
        "version": "1.0.0",
        "signature": "not yet implemented",
        "priority": 0,
        "enabled": true,
        "id": PAMM_MOD_ID
    };
    fs.writeFileSync(path.join(strPammModDirectoryPath, "modinfo.json"), JSON.stringify(modinfo, null, 4));
};
init();

