var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var pa = require('./pa.js');
var compat = require('./pamm-compat.js');

var URL_MODLIST = "http://pamm-mereth.rhcloud.com/api/mod";
var URL_USAGE = "http://pamm-mereth.rhcloud.com/api/usage";

var PAMM_MOD_ID = "PAMM";
var PAMM_MOD_IDENTIFIER = "com.pa.deathbydenim.dpamm";
var PAMM_SERVER_MOD_IDENTIFIER = "com.pa.pamm.server";
if(process.platform === 'win32') {
    PAMM_MOD_ID = "rPAMM";
    PAMM_MOD_IDENTIFIER = "com.pa.raevn.rpamm";
}

var communityMods = pa.last && pa.last.communityMods;

var stream = pa.last ? pa.last.stream : 'stable';

var installed = {};
var available = {};

var paths = {};

var isBuiltinMod = function(identifier) {
  return identifier === PAMM_MOD_ID ||
    identifier === PAMM_MOD_IDENTIFIER ||
    identifier === PAMM_SERVER_MOD_IDENTIFIER;
}

exports.setStream = function(newStream) {
    stream = newStream;
    installed = {};
    available = {};
    setup(pa.streams[stream]);
    //TODO play with symlink for mods folders?
};

exports.getStream = function() {
    return stream;
};

exports.isCommunityMods = function() {
    return !!communityMods;
}

exports.getAvailableMods = function (force) {
    available = {};
    var mods = {};
    
    var deferred = $.Deferred();
    
    var _finish = function() {
        deferred.resolve(_.toArray(available));
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
            deferred.reject("Failed to parse modlist data: " + e.message);
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
                jsAddLogMessage("Failed to parse usage data: " + e.message, 1);
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
    .fail(function(jqXHR, textStatus, errorThrown) {
        if(!errorThrown) {
            errorThrown = "network issue";
        }
        deferred.reject("Failed to load modlist data: " + errorThrown);
    });
    
    return deferred.promise();
};

var deferInstalledMods;
exports.getInstalledMods = function (context, force) {
    var localDeferInstalledMods = deferInstalledMods;
    
    if(!localDeferInstalledMods) {
        deferInstalledMods = $.Deferred(function(defer) {
            process.nextTick(function() {
                try {
                    if(force || !_.size(installed)) {
                        findInstalledMods();
                    }
                    defer.resolve();
                }
                catch(e) {
                    defer.reject("Failed to load installed mods: " + e);
                }
            });
        })
        .promise();
        
        localDeferInstalledMods = deferInstalledMods;
    }
    
    var deferred = $.Deferred();
    
    localDeferInstalledMods.done(function() {
        deferred.resolve(
            _.filter(
                _.toArray(installed)
                ,function(mod) { return !isBuiltinMod(mod.identifier) && mod.context === context }
            )
        );
    }).fail(function(err) {
        deferred.reject(err);
    }).always(function() {
        deferInstalledMods = null;
    });
    
    return deferred.promise();
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

var getRequires = function(id, modpool) {
    var requires = {};
    requires[id] = id;
    
    var _fillrequires = function(id, requires) {
        var mod = modpool[id];
        if(!mod) {
            throw "Mod '" + id + "' not found.";
        }
        
        var dependencies = mod.dependencies;
        if(dependencies) {
            for(var i = 0; i < dependencies.length; ++i) {
                var dependency = mod.dependencies[i];
                if(!requires[dependency]) {
                    requires[dependency] = dependency;
                    _fillrequires(dependency, requires);
                }
            }
        }
    };
    
    _fillrequires(id, requires);
    delete requires[id];
    
    return _.toArray(requires);
};

var getRequiredToInstall = function(id) {
    return getRequires(id, available);
}
exports.getRequiredToInstall = getRequiredToInstall;

var getRequiredBy = function(id) {
    requiredby = {};
    requiredby[id] = id;
    
    var _fillrequiredby = function(id, requiredby) {
        for(var key in installed) {
            if (installed.hasOwnProperty(key)) {
                var mod = installed[key];
                if(mod.dependencies && mod.dependencies.indexOf(id) !== -1) {
                    if(!requiredby[mod.identifier]) {
                        requiredby[mod.identifier] = mod.identifier;
                        _fillrequiredby(mod.identifier, requiredby);
                    }
                }
            }
        }
    }
    
    _fillrequiredby(id, requiredby);
    delete requiredby[id];
    
    return _.toArray(requiredby);
};
exports.getRequiredBy = getRequiredBy;

exports.hasUpdate = function(id) {
    var mod = installed[id];
    var online = available[id];
    
    if(!mod || !online) {
        return false;
    }
    
    if(!semver.valid(mod.version) || !semver.valid(online.version)) {
        return mod.version !== online.version;
    }
    
    return semver.lt(mod.version, online.version);
};

exports.install = function (id, callback, progressCallback) {
    var mod = available[id];
    
    var ids = getRequires(id, available);
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
        
        if(update && update.stockmod) {
            if(update.enabled === false) {
                _enablemod(id, true);
            }
            else {
                jsAddLogMessage("Skipping mod '" + id + "', it's a 'stockmod'.", 3)
            }
            _install(ids, callback);
            return;
        }
        
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
            if (modinfo.priority === undefined)
                modinfo.priority = 100;
            modinfo.enabled = true;
            modinfo.installpath = installpath;
            
            installed[id] = modinfo;
            
            if(!devmode) {
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
    var zip = new JSZip(zipdata);
    
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
        if(isBuiltinMod(key))
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
    
    var ids = getRequires(id, installed);
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
    
    if(isBuiltinMod(id))
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
    var mounted = [PAMM_MOD_IDENTIFIER,PAMM_SERVER_MOD_IDENTIFIER];
    
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
                    
                    if (mod.priority === undefined)
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
    if(!communityMods && pa.streams[stream]) {
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
                            
                            if (mod.priority === undefined)
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

    if (communityMods) {
        return;
    }

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
    
    // mods/pamm/uimodlist
    jsAddLogMessage("Processing " + context + " scenes", 4);
    
    var globalmodlist = [];
    var scenemodlist = {};
    var scenes = context === 'server' ? [] : ["armory", "building_planets", "connect_to_game", "game_over", "icon_atlas", "live_game", "live_game_econ", "live_game_hover", "load_planet", "lobby", "matchmaking", "new_game", "replay_browser", "server_browser", "settings", "social", "special_icon_atlas", "start", "system_editor", "transit"] // deprecated
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
    
    var pamm_path, uimodlist;
 
    var mount_order = _.pluck( enabledmods,'identifier'); // may be modified for server mods
    
    switch ( context )
    {
        
        case 'server':
        
            pamm_path = paths.pamm_server;
    
            // server version of ui_mod_list.js loads local client copy of ui_mod_list_for_server.js then merges server scenes into client scenes
    
            uimodlist = "var global_server_mod_list = " + JSON.stringify(globalmodlist, null, 4) + ";\n\nvar scene_server_mod_list = " + JSON.stringify(scenemodlist, null, 4) + ";\n\ntry { \n\nloadScript('coui://ui/mods/ui_mod_list_for_server.js');\n\ntry { global_mod_list = _.union( global_mod_list, global_server_mod_list ) } catch (e) { console.log(e); } ;\n\ntry { _.forOwn( scene_server_mod_list, function( value, key ) { if ( scene_mod_list[ key ] ) { scene_mod_list[ key ] = _.union( scene_mod_list[ key ], value ) } else { scene_mod_list[ key ] = value } } ); } catch (e) { console.log(e); } \n\n\} catch (e) {\n\nconsole.log(e);\n\nvar global_mod_list = global_server_mod_list;\n\nvar scene_mod_list = scene_server_mod_list;\n\n}\n\n";
    
            // for server mods we only enable the PA Server Mod Manager if there are other server mods enabled that use scenes
    
            var sceneCount = globalmodlist.length + _.flatten( _.values( scenemodlist ) ).length;
            
            jsAddLogMessage( 'Found ' + sceneCount + ' server mod scenes', 4);
            
            if ( sceneCount == 0 )
            {
                jsAddLogMessage( 'Disabling PA Server Mod Manager as not needed', 4);
                mount_order = _.without( mount_order, PAMM_SERVER_MOD_IDENTIFIER );
            }
            else
            {
                jsAddLogMessage( 'Enabling PA Server Mod Manager', 4);                
            }
    
            break;
        
        case 'client':
        
            pamm_path = paths.pamm;
    
            uimodlist = "var global_mod_list = " + JSON.stringify(globalmodlist, null, 4) + ";\n\nvar scene_mod_list = " + JSON.stringify(scenemodlist, null, 4) + ";";
    
            // extra copy of client ui_mod_list.js that can be loaded by server version of ui_mod_list.js for merging
            
            fs.writeFileSync(
                path.join(pamm_path, 'ui/mods/ui_mod_list_for_server.js' )
                ,uimodlist
                ,{ encoding: 'utf8' }
            );
    
            // mods/pamm/modlist
            jsAddLogMessage("Writing mods_list.json", 4);
            fs.writeFileSync(
                path.join(pamm_path, 'ui/mods/mods_list.json')
                ,JSON.stringify(installed, null, 4)
                ,{ encoding: 'utf8' }
            );
        
            break;
            
        default:

            jsAddLogMessage("Unknown context " + context, 4);
        
    }
    
// some error checking

    if ( ! pamm_path )
    {
        return;
    }

    if ( uimodlist )
    {
        jsAddLogMessage("Writing " + context + " ui_mod_list.js", 4);
        fs.writeFileSync(
            path.join(pamm_path, 'ui/mods/ui_mod_list.js' )
            ,uimodlist
            ,{ encoding: 'utf8' }
        );
    }
    
    // mods/mods.json
    
    jsAddLogMessage("Writing " + context + " mods.json", 4);

    var mods = { mount_order:mount_order };
    
    fs.writeFileSync(
        path.join(pa.modspath[context], 'mods.json')
        ,JSON.stringify(mods, null, 4)
        ,{ encoding: 'utf8' }
    );
};

var setup = function(stream) {

    communityMods = stream.communityMods;

    var clientPath = pa.modspath['client'];
    var serverPath = pa.modspath['server'];
    
    var clientModsPath = path.join(clientPath, 'mods.json');
    var serverModsPath = path.join(serverPath, 'mods.json');

    var clientModsBackupPath = path.join(clientPath, 'pamm-mods.json');
    var serverModsBackupPath = path.join(serverPath, 'pamm-mods.json');

 
    if (communityMods) {
        rmdirRecurseSync(paths.pamm);
        rmdirRecurseSync(paths.pamm_server);
        
        if (fs.existsSync(clientModsPath)) {
            fs.renameSync(clientModsPath, clientModsBackupPath);
        }

        if (fs.existsSync(serverModsPath)) {
            fs.renameSync(serverModsPath, serverModsBackupPath);
        }
        return;
    }

    if (!fs.existsSync(clientModsPath) && fs.existsSync(clientModsBackupPath)) {
        fs.renameSync(clientModsBackupPath, clientModsPath);
    }

    if (!fs.existsSync(serverModsPath) && fs.existsSync(serverModsBackupPath)) {
        fs.renameSync(serverModsBackupPath, serverModsPath);
    }

    var strPammClientModDirectoryPath = paths.pamm;

    CreateFolderIfNotExists(strPammClientModDirectoryPath);
    CreateFolderIfNotExists(strPammClientModDirectoryPath + "/ui");
    CreateFolderIfNotExists(strPammClientModDirectoryPath + "/ui/mods");
    
    var modinfo = {
        "context": "client",
        "identifier": PAMM_MOD_IDENTIFIER,
        "display_name": "PA Mod Manager",
        "description": " ",
        "author": "pamm-atom",
        "version": "1.0.0",
        "signature": "not yet implemented",
        "priority": 0
    };
    fs.writeFileSync(path.join(strPammClientModDirectoryPath, "modinfo.json"), JSON.stringify(modinfo, null, 4));

    var strPammServerModDirectoryPath = paths.pamm_server;
    CreateFolderIfNotExists(strPammServerModDirectoryPath);
    CreateFolderIfNotExists(strPammServerModDirectoryPath + "/ui");
    CreateFolderIfNotExists(strPammServerModDirectoryPath + "/ui/mods");

    var server_modinfo = {
        "context": "server",
        "identifier": PAMM_SERVER_MOD_IDENTIFIER,
        "display_name": "PA Server Mod Manager",
        "description": " ",
        "author": "pamm-atom",
        "version": "1.0.0",
        "signature": "not yet implemented",
        "priority": 0
    };
    fs.writeFileSync(path.join(strPammServerModDirectoryPath, "modinfo.json"), JSON.stringify(server_modinfo, null, 4));

};

var initialize = function() {
    paths.cache = pa.cachepath;
    paths.mods = pa.modspath;
    
    paths.pamm = path.join(pa.modspath.client, PAMM_MOD_ID);
    paths.pamm_server = path.join(pa.modspath.server, PAMM_SERVER_MOD_IDENTIFIER);
    
    setup(pa.last);
};

var deferredInitialize = $.Deferred();

pa.ready.done(function() {
    try {
        initialize();
        deferredInitialize.resolve();
    }
    catch(error) {
        deferredInitialize.reject(error);
    }
})
.fail(function(err) {
    deferredInitialize.reject(err);
});

exports.ready = deferredInitialize.promise();
