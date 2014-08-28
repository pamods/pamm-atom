var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var pa = require('./pa.js');
var compat = require('./pamm-compat.js');

var URL_MODLIST = "https://pamm-mereth.rhcloud.com/api/mod";
var URL_USAGE = "http://pamm-mereth.rhcloud.com/api/usage";
var URL_OLD_MODCOUNT = "http://pa.raevn.com/manage.php";

var PAMM_MOD_ID = "PAMM";
var PAMM_MOD_IDENTIFIER = "com.pa.deathbydenim.dpamm";
if(process.platform === 'win32') {
    PAMM_MOD_ID = "rPAMM";
    PAMM_MOD_IDENTIFIER = "com.pa.raevn.rpamm";
}

var stream = pa.last ? pa.last.stream : 'stable';

var installed = {};
var available = {};

var paths = {
    cache: pa.cachepath
    ,mods: pa.modspath
    ,pamm: path.join(pa.modspath.client, PAMM_MOD_ID)
};

exports.setStream = function(newstream) {
    stream = newstream;
    installed = {};
    available = {};
    //TODO play with symlink for mods folders?
};

exports.getStream = function() {
    return stream;
};

exports.getAvailableMods = function (callback, force) {
    available = {};
    var mods = {};
    
    var _finish = function() {
        callback(_.toArray(available));
    };
    
    if(_.size(available) && !force)
        _finish();
    
    var prmModlist = jsDownload(URL_MODLIST);
    var prmModcount = jsDownload(URL_USAGE);
    
    prmModlist.done(function(data) {
        var modlist;
        
        try {
            modlist = JSON.parse(data);
        } catch (e) {
            jsAddLogMessage("Error loading modlist data: " + e.message, 1);
            _finish();
            return;
        }
        
        for (var i in modlist) {
            var mod = modlist[i];
            
            if(!mod.id)
                mod.id = mod.identifier;
            else
                compat.push(mod.identifier, mod.id);
            
            mod.downloads = 0;
            mod.likes = -2;
            
            mods[mod.identifier] = mod;
        }
        available = mods;
        
        prmModcount.done(function(data) {
            var usages;
            try {
                usages = JSON.parse(data);
                usages = _.indexBy(usages, 'identifier');
            } catch (e) {
                jsAddLogMessage("Error loading usage data: " + e.message, 1);
                return;
            }
            
            for (var identifier in available) {
                var mod = available[identifier];
                var usage = usages[identifier];
                mod.downloads = usage ? usage.total : 0;
                mod.popularity = usage ? usage.popularity : 0;
            }
        })
        .always(function() {
            _finish();
        });
    })
    .fail(function() {
        _finish();
    });
};

exports.getInstalledMods = function (context, callback, force) {
    if(force || !_.size(installed)) {
        try {
            findInstalledMods();
        }
        catch(e) {
            jsAddLogMessage("Error loading installed " + context + " mods: " + e, 4);
        }
    }
    callback(
        _.filter(
            _.toArray(installed)
            ,function(mod) { return mod.identifier !== PAMM_MOD_IDENTIFIER && mod.context === context }
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
    
    if(mod.dependencies) {
        //TODO some protection against infinite recurse
        for(var i = 0; i < mod.dependencies.length; ++i) {
            var require = mod.dependencies[i];
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
            if(mod.dependencies && mod.dependencies.indexOf(id) !== -1) {
                requiredby[mod.identifier] = mod.identifier;
                getRequiredBy(mod.identifier, requiredby);
            }
        }
    }
    
    return _.toArray(requiredby);
};
exports.getRequiredBy = getRequiredBy;

exports.install = function (id, callback, progressCallback) {
    var mod = available[id];
    
    var ids = getRequires(id);
    ids.push(id);
    
    var _finish = function(error, id) {
        _fixDependencies(installed);
        _updateFiles();
        if(error)
            error = "Failed to install '" + id + "'. " + error
        if(callback)
            callback(error);
    }
    
    var _install = function(ids, callback) {
        if(ids.length === 0) {
            _finish();
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
        
        var installpath = update ? update.installpath : path.join(paths.mods[mod.context], id);
        
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
            if(!modinfo.context)
                throw "no context property in modinfo"
            if(modinfo.context === 'server' || !modinfo.id)
                modinfo.id = modinfo.identifier;
            if (!modinfo.priority)
                modinfo.priority = 100;
            modinfo.enabled = true;
            modinfo.installpath = installpath;
            
            installed[id] = modinfo;
            
            if(!devmode) {
                jsDownload(URL_OLD_MODCOUNT + "?download=" + id);
                $.post(URL_USAGE, { identifier: id, action: (update ? "update" : "install") });
                mod.downloads++;
            }
        };
        
        if(!fs.existsSync(cachefile)) {
            jsAddLogMessage("Downloading mod '" + id + "'", 3)
            jsDownload(mod.url, {
                tofile: cachefile
                ,success: function() {
                    try {
                        _extract();
                    }
                    catch(e) {
                        _finish("An unexpected error occured during the mod archive extraction: " + e, id);
                        return;
                    }
                    _install(ids, callback);
                }
                ,error: function(e) {
                    _finish("An unexpected error occured during the download: " + e, id);
                }
                ,progress: function(state) {
                    if(progressCallback)
                        progressCallback(mod.identifier, state);
                }
            });
        }
        else {
            jsAddLogMessage("Using cache for mod '" + id + "'", 3);
            try {
                _extract();
            }
            catch(e) {
                jsAddLogMessage("An unexpected error occured during the cached mod archive extraction: " + e, 3);
                try {
                    //remove from cache and try again
                    fs.unlinkSync(cachefile);
                    ids.unshift(id);
                }
                catch(e) {
                    _finish("An unexpected error occured while removing the cached mod archive: " + e, id);
                    return;
                }
            }
            _install(ids, callback);
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
        
        if(!devmode) {
            $.post(URL_USAGE, { identifier: id, action: "uninstall" });
        }
        
        _updateFiles();
        callback();
    }
};

exports.setEnabled = function(id, enabled) {
    var ids = enabled ? _enablemod(id) : _disablemod(id);
    _updateFiles();
    return ids;
}

exports.setAllEnabled = function(enabled, context) {
    var ids = [];
    for(var key in installed) {
        if(key === PAMM_MOD_IDENTIFIER)
            continue;
        
        if (installed.hasOwnProperty(key)) {
            var mod = installed[key];
            try {
                if(context && mod.context !== context)
                    continue;
                
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
            jsAddLogMessage("Mod '" + mod.identifier + "' ENABLED", 3);
            enabled.push(mod.identifier);
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
            jsAddLogMessage("Mod '" + mod.identifier + "' DISABLED", 3);
            disabled.push(mod.identifier);
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
    var _loadMountedMods = function(context) {
        var modsjsonpath = path.join(paths.mods[context], 'mods.json');
        if(fs.existsSync(modsjsonpath)) {
            var modsjson = fs.readFileSync(modsjsonpath, { encoding: 'utf8' });
            modsjson = JSON.parse(modsjson);
            if(modsjson.mount_order) {
                mounted = _.union(mounted, modsjson.mount_order);
            }
        }
    };
    _loadMountedMods('client');
    _loadMountedMods('server');
    
    // load user mods
    var _loadUserMods = function(context) {
        var moddirs = fs.readdirSync(paths.mods[context]);
        for (var i = 0; i < moddirs.length; ++i) {
            var dirname = moddirs[i];
            var moddir = path.join(paths.mods[context], dirname);
            if (fs.statSync(moddir).isDirectory()) {
                try {
                    var modinfopath = path.join(moddir, 'modinfo.json');
                    var strmodinfo = fs.readFileSync(modinfopath, {encoding: 'utf8'});
                    
                    var mod = {};
                    mod = JSON.parse(strmodinfo);
                    
                    if(mod.enabled === false) {
                        // revert old modinfo updates, or mod packaging error
                        mod.enabled = true;
                        fs.writeFileSync(modinfopath, JSON.stringify(mod, null, 4), { encoding: 'utf8' });
                    }
                    
                    if(mod.context !== context)
                        throw "invalid context property in modinfo"
                    
                    if(mod.context === 'server' || !mod.id)
                        mod.id = mod.identifier;
                    else
                        compat.push(mod.identifier, mod.id)
                    
                    if (!mod.priority)
                        mod.priority = 100;
                    
                    mod.enabled = (_.indexOf(mounted, mod.identifier) !== -1);
                    
                    mod.installpath = moddir;
                    
                    mods[mod.identifier] = mod;
                    
                    var logid = mod.identifier === dirname ? mod.identifier : mod.identifier + " (/" + dirname + ")";
                    jsAddLogMessage("Found installed " + context + " mod: " + logid, 3)
                } catch (err) {
                    jsAddLogMessage("Error loading installed " + context + " mod from '/" + dirname + "'", 4)
                }
            }
        }
    };
    _loadUserMods('client');
    _loadUserMods('server');
    
    // load stock mods
    if(pa.streams[stream]) {
        var _loadStockMods = function(context) {
            var stockmodspath = path.join(pa.streams[stream].stockmods, context);
            if(fs.existsSync(stockmodspath)) {
                var moddirs = fs.readdirSync(stockmodspath);
                for (var i = 0; i < moddirs.length; ++i) {
                    var dirname = moddirs[i];
                    var moddir = stockmodspath + '/' + dirname;
                    if (fs.statSync(moddir).isDirectory()) {
                        var modinfopath = moddir + '/modinfo.json';
                        var strmodinfo = fs.readFileSync(modinfopath, {encoding: 'utf8'});
                        
                        var mod = {};
                        try {
                            mod = JSON.parse(strmodinfo);
                            
                            if(mods[mod.identifier]) {
                                jsAddLogMessage("Skipped " + context + " stock mod: " + mod.identifier, 3);
                                continue;
                            }
                            else {
                                jsAddLogMessage("Found " + context + " stock mod: " + mod.identifier, 3);
                            }
                            
                            mod.id = dirname;
                            
                            if (!mod.priority)
                                mod.priority = 100;
                            
                            mod.enabled = (_.indexOf(mounted, mod.identifier) !== -1);
                            
                            mod.stockmod = true;
                            
                            mods[mod.identifier] = mod;
                        } catch (err) {
                            var name = mod.display_name ? mod.display_name : dirname;
                            //alert("Error loading installed mod '" + name + "'");
                        }
                    }
                }
            }
            else {
                jsAddLogMessage("Stock mods folder not found: " + stockmodspath, 1);
            }
        };
        _loadStockMods('client');
        _loadStockMods('server');
    }
    
    _fixDependencies(mods);
    
    installed = mods;
    
    _updateFiles();
}

var _fixDependencies = function(mods) {
    for(var identifier in mods) {
        var mod = mods[identifier];
        if(mod.requires) {
            // replace requires by dependencies with the identifiers
            var dependencies = [];
            var mismatch = false;
            for(var i = 0; i < mod.requires.length; ++i) {
                var id = mod.requires[i];
                var identifier = compat.toIdentifier(id);
                if(identifier) {
                    dependencies.push(identifier);
                }
                else {
                    mismatch = true;
                    dependencies.push(id);
                }
            }
            mod.dependencies = dependencies;
            delete mod.requires;
            
            // rewrite modinfo.json if no mismatch ids
            if(!mismatch) {
                var modinfopath = path.join(mod.installpath, "modinfo.json");
                fs.writeFileSync(modinfopath, JSON.stringify(mod, null, 4), { encoding: 'utf8' });
            }
        }
    }
}

var _updateFiles = function(context) {
    if(!context) {
        _updateFiles('client');
        _updateFiles('server');
        return;
    }
    
    var enabledmods = _.sortBy(
        _.filter(
            _.toArray(installed)
            ,function(mod) { return mod.enabled !== false && mod.context === context; }
        )
        ,function(mod) { return mod.priority }
    );
    
    // mods/mods.json
    jsAddLogMessage("Writing " + context + " mods.json", 4)
    var mods = {
        mount_order:
            _.pluck(
                enabledmods
                ,'identifier'
            )
    };
    fs.writeFileSync(
        path.join(pa.modspath[context], 'mods.json')
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

