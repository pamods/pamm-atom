var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var paths = {};

var ONLINE_MODS_LIST_URL = "http://pamods.github.io/modlist.json";

var PAMM_MOD_ID = "PAMM";
var PAMM_MOD_IDENTIFIER = "com.pa.deathbydenim.dpamm";
if(process.platform === 'win32') {
    PAMM_MOD_ID = "rPAMM";
    PAMM_MOD_IDENTIFIER = "com.pa.raevn.rpamm";
}

var installed = {};
var available = {};

exports.getAvailableMods = function (callback) {
    jsDownload(ONLINE_MODS_LIST_URL, {
        success: function(data) {
            try {
                var mods = {};
                
                var objModData = JSON.parse(data);
                for (var id in objModData) {
                    var mod = objModData[id];
                    
                    mod.id = id;
                    mod.likes = -2;
                    
                    //if (jsGetInstalledMod(id) != null && jsGetInstalledMod(id)["date"] < objModData[id]["date"]) {
                        //jsAddLogMessage("Update available for installed mod '" + jsGetInstalledMod(id)["display_name"] + "': " + objModData[id]["version"] + " (" + objModData[id]["date"] + ")", 3);
                    //}
                    
                    mods[id] = mod;
                }
                
                available = mods;
                callback(_.toArray(mods));
            } catch (e) {
                jsAddLogMessage("Error loading online mod data: " + e.message, 1);
            }
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
        if(!mod) {
            var mod = installed[id];
        }
        
        var basename = id + "_v" + mod.version;
        var destination = path.join(paths.mods, id);
        var cachefile = path.join(paths.cache, basename + ".zip");
        
        if(fs.existsSync(destination)) {
            var modinfopath = path.join(destination, "modinfo.json");
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
            
            rmdirRecurseSync(destination);
        }
        
        var _extract = function() {
            unzipSync(id, cachefile, paths.mods);
            installed[id] = mod;
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

exports.uninstall = function(id, callback) {
    var mod = installed[id];
    var modpath = path.join(paths.mods, id);
    if(fs.existsSync(modpath)) {
        jsAddLogMessage("Uninstalling mod '" + id + "'", 2);
        _disablemod(id);
        rmdirRecurseSync(modpath);
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
    var moddirs = fs.readdirSync(strModsDirectoryPath);
    for (var i = 0; i < moddirs.length; ++i) {
        var id = moddirs[i];
        var moddir = strModsDirectoryPath + '/' + id;
        if (fs.statSync(moddir).isDirectory()) {
            jsAddLogMessage("Found installed mod: " + id, 3)
            
            var modinfopath = moddir + '/modinfo.json';
            var strmodinfo = fs.readFileSync(modinfopath, {encoding: 'utf8'});
            
            var mod = {};
            try {
                mod = JSON.parse(strmodinfo);
                
                if(mod.enabled === false) {
                    // revert old modinfo updates, or mod packaging error
                    mod.enabled = true;
                    fs.writeFileSync(modinfopath, JSON.stringify(mod, null, 4), { encoding: 'utf8' });
                }
                
                mod.id = id;
                
                if (!mod.priority)
                    mod.priority = 100;
                
                mod.enabled = (_.indexOf(mounted, mod.identifier) !== -1);
                
                mods[id] = mod;
            } catch (err) {
                var name = mod.display_name ? mod.display_name : id;
                //alert("Error loading installed mod '" + name + "'");
            }
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
    
    // mods/pamm/uimodlist
    jsAddLogMessage("Writing ui_mod_list.js", 4);
    var globalmodlist = [];
    var scenemodlist = {};
    var scenes = ["armory", "building_planets", "connect_to_game", "game_over", "icon_atlas", "live_game", "live_game_econ", "live_game_hover", "load_planet", "lobby", "matchmaking", "new_game", "replay_browser", "server_browser", "settings", "social", "special_icon_atlas", "start", "system_editor", "transit"] // deprecated
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
        path.join(paths.mods, PAMM_MOD_ID, 'ui/mods/ui_mod_list.js')
        ,uimodlist
        ,{ encoding: 'utf8' }
    );
    
    // mods/pamm/modlist
    jsAddLogMessage("Writing mods_list.json", 4);
    fs.writeFileSync(
        path.join(paths.mods, PAMM_MOD_ID, 'ui/mods/mods_list.json')
        ,JSON.stringify(installed, null, 4)
        ,{ encoding: 'utf8' }
    );
};

var init = function() {
    var localpath;
    if(process.platform === 'win32') {
        localpath = process.env.LOCALAPPDATA
        localpath = localpath.replace(/\\/g,"/");
    }
    else if(process.platform === 'linux') {
        localpath = process.env.HOME + "/.local"
    }
    else if(process.platform === 'darwin') {
        localpath = process.env.HOME + "/Library/Application Support"
    }
    else {
        throw "Unsupported platform: " + process.platform;
    }
    
    var strLocalPath = localpath + "/Uber Entertainment/Planetary Annihilation"
    var strModsDirectoryPath = strLocalPath + "/mods"
    var strPammModDirectoryPath = strModsDirectoryPath + "/" + PAMM_MOD_ID;
    var strPAMMCacheDirectoryPath = strLocalPath + "/pamm_cache"
    
    paths.local = strLocalPath;
    paths.mods = strModsDirectoryPath;
    paths.pamm = strPammModDirectoryPath;
    paths.cache = strPAMMCacheDirectoryPath;
    
    CreateFolderIfNotExists(localpath + "/Uber Entertainment");
    CreateFolderIfNotExists(localpath + "/Uber Entertainment/Planetary Annihilation");
    CreateFolderIfNotExists(strPAMMCacheDirectoryPath);
    CreateFolderIfNotExists(strModsDirectoryPath);
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
    fs.writeFileSync(strPammModDirectoryPath + "/modinfo.json", JSON.stringify(modinfo, null, 4));
};

init();
