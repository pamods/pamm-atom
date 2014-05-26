window.$ = window.jQuery = require('./assets/js/jquery-1.10.2.min.js');
var JSZip = require('./assets/js/jszip.min.js');
var shell = require('shell');

//(function() {

var url = require('url');
var http = require('http');
var fs = require('fs');
var path = require('path');

var proxy; //"http://proxy.domain.tld:8080";

var objInstalledMods = [];
var objOnlineMods = [];
var objPAMMVersionData = {};
var objOptions = {};
var objOnlineModCategories = {};
var objInstalledModCategories = {};

var boolAutoWrite = true;
var boolOnline = true;
var intMessageID = 0;
var intDownloading = 0;
var strModInstalling = "";
var intLogLevel = 0;
var intLogNumber = 0;
var intLikeCountRemaining = 0;

var ONLINE_MODS_LIST_URL = "http://pamods.github.io/modlist.json";
var ONLINE_MODS_DOWNLOAD_COUNT_URL = "http://pa.raevn.com/modcount_json.php";
var MANAGE_URL = "http://pa.raevn.com/manage.php";
var MOD_IS_NEW_PERIOD_DAYS = 7;
var NEWS_URL = "http://pamods.github.io/news.html";
var PAMM_VERSION_DATA_URL = "http://pa.raevn.com/pammversion.json";
var PAMM_OPTIONS_FILENAME = "pamm.json";
var PAMM_ONLINE_TEST_URL = "http://pa.raevn.com/pamm_online.txt";
var MOD_GENERIC_ICON_URL = "assets/img/generic.png";
var PAMM_DEFAULT_LOCALE = "en";

var PAMM_MOD_ID = "PAMM";
var PAMM_MOD_IDENTIFIER = "com.pa.deathbydenim.dpamm";
if(process.platform === 'win32') {
    PAMM_MOD_ID = "rPAMM";
    PAMM_MOD_IDENTIFIER = "com.pa.raevn.rpamm";
}

var strLocalPath;
var strModsDirectoryPath;
var strPammModDirectoryPath;
var strPAMMCacheDirectoryPath;

var datePAMM = "2014/04/30";
var strPAMMversion = (function() {
	var remote = require('remote');
	var app = remote.require('app');
	return app.getVersion();
})();
var strPABuild = "";

/* Localisation Functions */
function jsGetLocaleText(strKey, strLocale) {
    if (strlocaleText[strKey] != null) {
        if (strlocaleText[strKey][strLocale] != null && strlocaleText[strKey][strLocale] != "") {
            return strlocaleText[strKey][strLocale];
        } else if (strlocaleText[strKey]["en"] != null) {
            return strlocaleText[strKey]["en"];
        }
    }
    return null;
}

function jsApplyLocaleText() {
    for (var i = 0; i < strLocaleTextItems.length; i++) {
        var objLocItems = $(".LOC_" + strLocaleTextItems[i]);
        if (objLocItems.length > 0) {
            if (objLocItems.prop("tagName") == "INPUT") {
                objLocItems.attr("value", jsGetLocaleText(strLocaleTextItems[i], objOptions["locale"]));
            } else {
                objLocItems.text(jsGetLocaleText(strLocaleTextItems[i], objOptions["locale"]));
            }
        }
    }
}

/* Sorting Functions */
function sort_random(){
    return (Math.round(Math.random())-0.5);
}

function sort_by(field, reverse, primer) {
    var key = primer ? function(x) {return primer(x[field])} : function(x) {return x[field]};
    reverse = [-1, 1][+!!reverse];

    return function (a, b) {
        return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    } 
}

function jsSortOnlineMods() {
    switch (objOptions["sort"]) {
        case "LAST_UPDATED":
            objOnlineMods.sort(sort_by('date', false, function(x) { return new Date(x); } ));
            $("#filter_area_sort_last_updated").addClass('filter_area_filter_item_selected');
            break;
        case "TITLE":
            objOnlineMods.sort(sort_by('display_name', true, null));
            $("#filter_area_sort_last_title").addClass('filter_area_filter_item_selected');
            break;
        case "AUTHOR":
            objOnlineMods.sort(sort_by('author', true, null));
            $("#filter_area_sort_last_author").addClass('filter_area_filter_item_selected');
            break;
        case "BUILD":
            objOnlineMods.sort(sort_by('build', false, null));
            $("#filter_area_sort_last_build").addClass('filter_area_filter_item_selected');
            break;
        case "LIKES":
            objOnlineMods.sort(sort_by('likes', false, parseInt));
            $("#filter_area_sort_last_likes").addClass('filter_area_filter_item_selected');
            break;
        case "DOWNLOADS":
            objOnlineMods.sort(sort_by('downloads', false, parseInt));
            $("#filter_area_sort_last_downloads").addClass('filter_area_filter_item_selected');
            break;
        case "RANDOM":
            objOnlineMods.sort(sort_random);
            $("#filter_area_sort_last_random").addClass('filter_area_filter_item_selected');
            break;
    }
}

/* Data Strings */
function jsGetInstalledModListDataString() {
    var strInstalledModsList = {};
    
    for (var i = 0; i < objInstalledMods.length; i++) {
        strInstalledModsList[objInstalledMods[i].id] = objInstalledMods[i]
    }
    return JSON.stringify(strInstalledModsList, null, 4);
}

function jsGetUIModListGlobalDataString() {
    var global_mod_list = [];
    objInstalledMods.sort(sort_by('priority', true, parseInt));

    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].enabled == true) {
            if (objInstalledMods[i]["global_mod_list"] != null) {
                for (var j = 0; j < objInstalledMods[i]["global_mod_list"].length; j++) {
                    global_mod_list.push(objInstalledMods[i]["global_mod_list"][j]);
                }
            }
            if (objInstalledMods[i]["scenes"] != null && objInstalledMods[i]["scenes"]["global_mod_list"] != null) {
                for (var j = 0; j < objInstalledMods[i]["scenes"]["global_mod_list"].length; j++) {
                    global_mod_list.push(objInstalledMods[i]["scenes"]["global_mod_list"][j]);
                }
            }
        }
    }
    return JSON.stringify(global_mod_list, null, 4);
}

function jsGetUIModListSceneDataString() {
    var scene_mod_list  = {"armory": [], "building_planets": [], "connect_to_game": [], "game_over": [], "icon_atlas": [], "live_game": [], "live_game_econ": [], "live_game_hover": [], "load_planet": [], "lobby": [], "matchmaking": [], "new_game": [], "replay_browser": [], "server_browser": [], "settings": [], "social": [], "special_icon_atlas": [], "start": [], "system_editor": [], "transit": []};
    objInstalledMods.sort(sort_by('priority', true, parseInt));
    
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].enabled == true) {
            for(var scene in objInstalledMods[i]) {
                if (scene_mod_list[scene] != null) {
                    for(var j = 0; j < objInstalledMods[i][scene].length; j++) {
                        scene_mod_list[scene].push(objInstalledMods[i][scene][j]);
                    }
                }
                if (scene == "scenes") {
                    for(var subscene in objInstalledMods[i][scene]) {
                        if (subscene != "global_mod_list") {
                            if (scene_mod_list[subscene] == null) {
                                scene_mod_list[subscene] = [];
                            }
                            for(var j = 0; j < objInstalledMods[i][scene][subscene].length; j++) {
                                scene_mod_list[subscene].push(objInstalledMods[i][scene][subscene][j]);
                            }
                        }
                    }
                }
            }
        }
    }
    return JSON.stringify(scene_mod_list, null, 4);
}

function jsGetInstalledModDataString(strModID) {
    if (jsGetInstalledMod(strModID) != null) { 
        return JSON.stringify(jsGetInstalledMod(strModID), null, 4);
    } else {
        return "";
    }
}

function jsGetModsJSONDataString() {
    var strOutput = {};
    strOutput["mount_order"] = [];
    
    objInstalledMods.sort(sort_by('priority', true, parseInt));
    
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].enabled == true) {
            strOutput["mount_order"].push(objInstalledMods[i].identifier);
        }
    }
    return JSON.stringify(strOutput, null, 4);
}

/* Option Functions */
function jsLoadOptionsData(strOptionsDataString) {
    objOptions = {};
    try {
        objOptions = JSON.parse(strOptionsDataString);
    } catch (err) {
        alert("An error occurred loading options file");
    }
    
    var papath = objOptions["pa_path"];
    if (!papath || !CheckPAPresent(papath)) {
        papath = findPA();
        if(papath && !CheckPAPresent(papath)) {
            papath = "";
        }
        objOptions["pa_path"] = papath;
    }
    
    var forcetab;
    if(!papath) {
        var remote = require('remote');
        var dialog = remote.require('dialog');
        dialog.showMessageBox(remote.getCurrentWindow(), {
            title : "Planetary Annihilation Not Found"
            ,message : "Could not find Planetary Annihilation. Please start Planetary Annihilation manually at least once before restarting PAMM."
            ,buttons : ["Ok"]
        });
        forcetab = "settings";
    }
    else {
        strPABuild = findPAVersion();
        $('#current_pa_build').text(strPABuild);
    }
    document.getElementById("btnLaunch").disabled = (papath?false:true);
    
    document.getElementById("setting_installLocation").value = objOptions["pa_path"];
	
	var modLocation = strModsDirectoryPath;
	if(process.platform === 'win32') {
		modLocation = modLocation.replace(/\//g, "\\");
	}
    document.getElementById("setting_modLocation").value = modLocation;
    
    if (objOptions["debug"] != null) {
        document.getElementById("setting_debug").checked = objOptions["debug"];
    } else {
        document.getElementById("setting_debug").checked = false;
    }
    jsToggleDebugMode(true);
    
    if (objOptions["verbose"] != null) {
        document.getElementById("setting_verbose").checked = objOptions["verbose"];
    } else {
        document.getElementById("setting_verbose").checked = false;
    }
    jsToggleVerboseMode(true);
    
    if (objOptions["modlikes"] != null) {
        document.getElementById("setting_likes").checked = objOptions["modlikes"];
    } else {
        document.getElementById("setting_likes").checked = false;
    }
    jsToggleModLikes(true);
    
    if (objOptions["available_filter"] == null) {
        objOptions["available_filter"] = 'ALL';
    }
    
    if (objOptions["available_category"] == null) {
        objOptions["available_category"] = 'ALL';
    }			
    
    if (objOptions["installed_category"] == null) {
        objOptions["installed_category"] = 'ALL';
    }			
    
    if (objOptions["sort"] == null) {
        objOptions["sort"] = 'LAST_UPDATED';
    }
    
    if (objOptions["tab"] == null) {
        objOptions["tab"] = 'news';
    }
    document.getElementById('setting_defaultTab').value = objOptions["tab"];
    jsDisplayPanel(forcetab?forcetab:objOptions["tab"]);
    
    if (objOptions["locale"] != null) {
        document.getElementById('setting_language').value = objOptions["locale"];
        if (objOptions["locale"] != PAMM_DEFAULT_LOCALE) {
            jsSetLanguage(true);
        }
    }
    
    if (objOptions["available_view"] == null) {
        objOptions["available_view"] = 'detailed';
    }
    document.getElementById('setting_available_view').value = objOptions["available_view"];
    jsSetModsListView(false, true);
    
    if (objOptions["installed_view"] != null) {
        objOptions["installed_view"] = 'summary';
    }
    document.getElementById('setting_installed_view').value = objOptions["installed_view"];
    jsSetModsListView(true, true);
    
    if (objOptions["available_icon"] == null) {
        objOptions["available_icon"] = true;
    }
    document.getElementById('setting_available_icon').checked = objOptions["available_icon"];
    jsSetModsListIcon(false, true);
    
    if (objOptions["installed_icon"] == null) {
        objOptions["installed_icon"] = false;
    }
    document.getElementById('setting_installed_icon').checked = objOptions["installed_icon"];
    jsSetModsListIcon(true, true);
    
    if (objOptions["show_available_filters"] == null) {
        objOptions["show_available_filters"] = false;
    }
    jsUpdateOptionsToggle(false)

    if (objOptions["show_installed_filters"] == null) {
        objOptions["show_installed_filters"] = false;
    }
    jsUpdateOptionsToggle(true)
    
    WriteOptionsJSON();
}

function jsGetOptionsDataString() {
    return JSON.stringify(objOptions, null, 4);
}

function jsGetOption(strOption) {
    return objOptions[strOption];
}

/* Installed Mod Functions */
function jsUpdateAll() {
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (jsGetOnlineMod(objInstalledMods[i].id) != null && objInstalledMods[i].date < jsGetOnlineMod(objInstalledMods[i].id).date) {
            jsPreInstallMod(jsGetOnlineMod(objInstalledMods[i].id).url, objInstalledMods[i].id, {});
        }
    }
}
    
function jsLoadInstalledModData(strModID, strModDataString) {
    var objCurrentMod = {};
    try {
        objCurrentMod = JSON.parse(strModDataString);
        
        objCurrentMod["priority"] = objCurrentMod["priority"] ? objCurrentMod["priority"] : 100;
        if (objCurrentMod["enabled"] == null || strModID == PAMM_MOD_ID) {
            objCurrentMod["enabled"] = true;
        }
        objCurrentMod["id"] = strModID;
        
        
        if (objCurrentMod.category != null) {
            for (var i = 0; i < objCurrentMod.category.length; i++) {
                var strCurrentCategory = objCurrentMod.category[i].replace(" ", "-").toUpperCase();
                if (objInstalledModCategories[strCurrentCategory] == null) {
                    objInstalledModCategories[strCurrentCategory] = 1;
                } else {
                    objInstalledModCategories[strCurrentCategory]++;
                }
            }
        }
        
        objInstalledModCategories["ALL"]++;
        objInstalledMods.push(objCurrentMod);
    } catch (err) {
        var strName = strModID;
        if (objCurrentMod["display_name"] != null) {
            strName = objCurrentMod["display_name"];
        }
        alert("Error loading installed mod '" + strName + "'");
    }
}

function jsClearInstalledModData() {
    objInstalledMods = [];
}

function jsRemoveInstalledMod(strModID) {
    jsSetModEnabledStatus(strModID, false);
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].id == strModID) {
            objInstalledMods.splice(i,1);
        }
    }
}

function jsModEnabledToggle(strModID) {
    var $checkbox = $('#mod' + strModID);
    var $image = $checkbox.next('#modimg' + strModID);
    
    $checkbox.prop("checked", !($checkbox.prop("checked")));
    
    if($checkbox.prop("checked") == true) {
        $image.attr('src', "assets/img/checkbox_checked.png");
    } else {
        $image.attr('src', "assets/img/checkbox_unchecked.png");
    }
    
    jsSetModEnabledStatus(strModID, document.getElementById("mod" + strModID).checked);			
    jsUpdateFiles();
}

function jsSetModEnabledStatus(strModID, boolEnabled) {
    var objThisMod = jsGetInstalledMod(strModID);
    objThisMod.enabled = boolEnabled;
    jsAddLogMessage("Mod '" + objThisMod.display_name + "' " + (boolEnabled ? "ENABLED" : "DISABLED"), 3);
                
    if (boolEnabled == true) {
        var boolReadyToEnable = true;
        if (objThisMod["requires"] != null) {
            for (var i = 0; i < objThisMod["requires"].length; i++) {
                if (jsGetInstalledMod(objThisMod["requires"][i]) == null) {
                    
                    var strName = objThisMod["requires"][i];
                    if (jsGetOnlineMod(objThisMod["requires"][i]) != null) {
                        strName = jsGetOnlineMod(objThisMod["requires"][i]).display_name;
                    }
                    alert("Cannot enable Mod: Required dependency '" + strName + "' is missing");
                    boolReadyToEnable = false;
                } else {
                    jsSetModEnabledStatus(objThisMod["requires"][i], boolEnabled);
                }
            }
        }
        if (document.getElementById("mod" + strModID)) {
            document.getElementById("mod" + strModID).checked = boolReadyToEnable;
            
            if (boolReadyToEnable) {
                document.getElementById("modimg" + strModID).src = "assets/img/checkbox_checked.png";
            } else {
                document.getElementById("modimg" + strModID).src = "assets/img/checkbox_unchecked.png";
            }
        }
    } else {
        for(var i = 0; i < objInstalledMods.length; i++) {
            if (objInstalledMods[i]["requires"] != null) {
                for (var j = 0; j < objInstalledMods[i]["requires"].length; j++) {
                    if (objInstalledMods[i]["requires"][j] == strModID) {
                        jsSetModEnabledStatus(objInstalledMods[i].id, false);
                    }
                }
            }
        }
        if (document.getElementById("mod" + strModID)) {
            document.getElementById("mod" + strModID).checked = false;
            document.getElementById("modimg" + strModID).src = "assets/img/checkbox_unchecked.png";
        }
    }
    WriteModinfoJSON(strModID);
}

function jsGenerateModEntryHTML(objMod, boolIsInstalled) {
    var strHTML_classes = "mod_entry";
    var id = objMod.id;
                
    /* Icon */
    var strHTML_icon_source = MOD_GENERIC_ICON_URL;
    if (objMod.icon != null) {
        strHTML_icon_source = objMod.icon;
    }
    var strHTML_icon = "<div class='mod_entry_icon'><img width='100%' height='100%' src='" + strHTML_icon_source + "'></div>";
            
    /* Name */
    var strHTML_display_name = "<div class='mod_entry_name'>" + objMod.display_name + "</div>";
    if (objMod["display_name_" + objOptions["locale"]] != null ) {
        strHTML_display_name = "<div class='mod_entry_name'>" + objMod["display_name_" + objOptions["locale"]] + "</div>";
    }
    
    /* Author */
    var strHTML_author = "<div class='mod_entry_author'>" + jsGetLocaleText('by', objOptions["locale"]) + " " + objMod.author + "</div>";
    
    /* Version */
    var strHTML_version = jsGetLocaleText('Version', objOptions["locale"]) + ": " + objMod.version;
    
    /* Build */
    var strHTML_build = "";
    if (objMod.build != null) {
        strHTML_build = ", " + jsGetLocaleText('build', objOptions["locale"]) + " " + objMod.build;
    }
    
    /* Date */
    var strHTML_date = "";
    if (objMod.date != null) {
        strHTML_date = " (" + objMod.date + ")";
    }
    
    /* Requires */
    var strHTML_requires = "";
    if (objMod.requires != null) {
        for (var j = 0; j < objMod.requires.length; j++) {
            if (jsGetInstalledMod(objMod.requires[j]) == null) {
                strHTML_requires += "<span class='mod_requirement_missing'>" + objMod.requires[j] + "</span>";
            } else {
                strHTML_requires += "<span class='mod_requirement'>" + objMod.requires[j] + "</span>";
            }
            
            if (j < objMod.requires.length - 1) {
                strHTML_requires += ", ";
            }
        }
        strHTML_requires = "<div class='mod_entry_requires'>" + jsGetLocaleText('REQUIRES', objOptions["locale"]) + ": " + strHTML_requires + "</div>";
    }

    
    /* Description */
    var strHTML_description = "<div class='mod_entry_description'>" + objMod.description + "</div>";
    if (objMod["description_" + objOptions["locale"]] != null) {
        strHTML_description = "<div class='mod_entry_description'>" + objMod["description_" + objOptions["locale"]] + "</div>";
    }
    
    /* Category */
    var strHTML_category = "";
    if (objMod.category != null) {
        for (var j = 0; j < objMod.category.length; j++) {
            strHTML_category += "<span class='mod_entry_category'>" + objMod.category[j] +"</span>";
            
            //TODO: additional safety
            var strSafeCategoryName = objMod.category[j].replace(" ", "-").toUpperCase(); 
            
            /* Update Classes */
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_category_' + strSafeCategoryName);
            
            if (j < objMod.category.length - 1) {
                strHTML_category += ", ";
            }
        }
        strHTML_category = "<div class='mod_entry_categories'>" + strHTML_category + "</div>";
    }
    
    /* Forum Link */
    var strHTML_forum_link = "";
    if (objMod.forum != null) {
        strHTML_forum_link = "<div class='mod_entry_link' onclick='window.event.cancelBubble = true'>[ <a href='#' onClick='LaunchURL(\"" + objMod.forum + "\")'>" + jsGetLocaleText('forum', objOptions["locale"]) + "</a> ]</div>";
    }
    
    /* Installed Mods List Only */
    var strHTML_checkbox = "";
    var strHTML_checkbox_image = "";
    var strHTML_entry_onclick = "";
    var strHTML_uninstall_link = "";
    var strHTML_update_available = "";
    var strHTML_update_link = "";
    if (boolIsInstalled == true) {
        var objOnlineMod = jsGetOnlineMod(id);
    
        /* Update Classes */
        if (objOptions["installed_view"] == 'detailed') {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_detailed');
        } else {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_summary');
        }
        
        if (objOptions["installed_icon"] == false) {
            strHTML_icon = strHTML_icon.replace('mod_entry_icon', 'mod_entry_icon mod_entry_icon_disabled');
        }
        
        /* Enabled Checkbox, Image */
        if (objMod.enabled == true) {
            strHTML_checkbox = "<input type='checkbox' class='mod_entry_enabled' id='mod" + id + "' checked='checked'>";
            strHTML_checkbox_image = "<div class='mod_entry_enabled_image'><img id='modimg" + id + "' src='assets/img/checkbox_checked.png' /></div>";
        } else {
            strHTML_checkbox = "<input type='checkbox' class='mod_entry_enabled' id='mod" + id + "'>";
            strHTML_checkbox_image = "<div class='mod_entry_enabled_image'><img id='modimg" + id + "' src='assets/img/checkbox_unchecked.png' /></div>";
        }
        
        /* Mod OnClick Function */
        strHTML_entry_onclick = "onClick='jsModEnabledToggle(\"" + id + "\");'"
        
        /* Update Available Notification */
        if (objOnlineMod != null) {
            if (objMod.date < objOnlineMod.date) {
                strHTML_update_link = "<div class='mod_entry_link mod_entry_update_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objOnlineMod.url + "\",\"" + id + "\", {})'>" + jsGetLocaleText('update', objOptions["locale"]) + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_update_available');
            }
        }
        
        /* Uninstall Link */
        strHTML_uninstall_link = "<div class='mod_entry_link mod_entry_uninstall_link' onclick='window.event.cancelBubble = true'>[ <a href='#' onClick='jsPreUninstallMod(\"" + id + "\")'>" + jsGetLocaleText('uninstall', objOptions["locale"]) + "</a> ]</div>";
    }
    
    /* Available Mods List Only */
    var strHTML_new = "";
    var strHTML_downloads = "";
    var strHTML_likes = "";
    var strHTML_install_link = "";
    if (boolIsInstalled == false) {
        var objInstalledMod = jsGetInstalledMod(id);
        var dateNow = new Date();
        var dateUpdate = new Date(objMod.date);
        
        /* Update Classes */
        if (objOptions["available_view"] == 'detailed') {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_detailed');
        } else {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_summary');
        }
    
        if (objOptions["available_icon"] == false) {
            strHTML_icon = strHTML_icon.replace('mod_entry_icon', 'mod_entry_icon mod_entry_icon_disabled');
        }
        
        /* Mod Newly Updated */
        if ((dateNow - dateUpdate)/(1000*60*60*24) < MOD_IS_NEW_PERIOD_DAYS) {
            strHTML_new = "<span class='mod_entry_new'> ! " + jsGetLocaleText('NEW', objOptions["locale"]) + "</span>";
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_new');
        }
        
        /* Install Link */
        
        if (objInstalledMod != null) {
            if (objMod.date > objInstalledMod.date) {
                strHTML_install_link = "<div class='mod_entry_link mod_entry_update_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('update', objOptions["locale"]) + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_update_available');
            } else {
                strHTML_install_link = "<div class='mod_entry_link mod_entry_reinstall_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('reinstall', objOptions["locale"]) + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_installed');
            }
        } else {
            strHTML_install_link = "<div class='mod_entry_link mod_entry_install_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('install', objOptions["locale"]) + "</a> ]</div>";
            
            /* Update Classes */
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_not_installed');
        }
        
        /* Install Count */
        strHTML_downloads = "<img src='assets/img/download.png' style='position: absolute; margin-top:4px'> <div class='mod_entry_count'>" + objMod.downloads + "</div>"; //TODO: Fix Up
        
        /* Like Count */			
        if (objOptions["loadlikes"] == true) {
            if (objMod.likes != null) {
                if (objMod.likes == -2) {
                    strHTML_likes = "<span id='" + id + "_like_count' class='mod_entry_likes'>" + jsGetLocaleText('Loading', objOptions["locale"]) + "...</span>" //TODO: Fix Up
                }
                if (objMod.likes >= 0) {
                    strHTML_likes = "<img src='assets/img/like.png' height='15' width='15' style='position: absolute; margin-top:4px; margin-left: 8px;'> <div class='mod_entry_likes'>" + objMod.likes + "</div>"; //TODO: Fix Up
                }
            }
        }
    }
                
    var strHTML = "<div class='" + strHTML_classes + "' " + strHTML_entry_onclick + ">" + strHTML_icon + "<div class='mod_entry_container'>" + strHTML_checkbox + strHTML_checkbox_image + "<div>" + strHTML_display_name + strHTML_author + "</div>" + "<div class='mod_entry_details'>" + strHTML_version + strHTML_build + strHTML_date + strHTML_update_available + strHTML_new + "</div>" + strHTML_requires + strHTML_description + strHTML_category + strHTML_forum_link + strHTML_update_link + strHTML_install_link + strHTML_uninstall_link + strHTML_downloads + strHTML_likes + "</div></div>";
    
    return strHTML;
}

function jsGenerateOnlineModsListHTML() {
    jsAddLogMessage("Generating Available Mods List", 3);
    
    var strCategoryHTML = "";
    
    for (var category in objOnlineModCategories) {
        if(objOnlineModCategories.hasOwnProperty(category)){
            strCategoryHTML += "<div class='filter_area_category'><a href='#' id='filter_area_available_category_" + category + "' onClick='jsSetAvailableModsFilterCategory(\"" + category + "\")'>" + category + "</a> (" + objOnlineModCategories[category] + ")</div>";
        }
    }

    $("#mod_list_available").html("<div class='filter_area'>" +
        "<div class='filter_area_additional_options_toggle'>" +
            "<a href='#' id='filter_area_available_toggle' onClick='jsToggleModListOptions(false)'>" + jsGetLocaleText('Hide_Additional_Options', objOptions["locale"]) + "</a>" + 
        "</div>" + 
        "<table>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Name_Filter', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_text_filter'>" +
                    "<input id='filter_area_available_text_filter' type='text' class='filter_area_textbox'>" + 
                "</td>" +
            "</tr>" + 
        "</table>" +
        "<table class='filter_area_container'>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Show_Only', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_show'>" +
                    "<a href='#' id='filter_area_show_all' onClick='jsSetAvailableModsFilter(\"ALL\")'>" + jsGetLocaleText('ALL', objOptions["locale"]) + "</a> - " +
                    "<a href='#' id='filter_area_show_installed' onClick='jsSetAvailableModsFilter(\"INSTALLED\")'>" + jsGetLocaleText('INSTALLED', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_show_not_installed' onClick='jsSetAvailableModsFilter(\"NOT_INSTALLED\")'>" + jsGetLocaleText('NOT_INSTALLED', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_show_requires_update' onClick='jsSetAvailableModsFilter(\"REQUIRES_UPDATE\")'>" + jsGetLocaleText('NEEDS_UPDATE', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_show_newly_updated' onClick='jsSetAvailableModsFilter(\"NEWLY_UPDATED\")'>" + jsGetLocaleText('NEWLY_UPDATED', objOptions["locale"]) + "</a>" + 
                "</td>" + 
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Sort_By', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_sort'>" + 
                    "<a href='#' id='filter_area_sort_last_updated' onClick='jsSetAvailableModsSort(\"LAST_UPDATED\")'>" + jsGetLocaleText('LAST_UPDATED', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_title' onClick='jsSetAvailableModsSort(\"TITLE\")'>" + jsGetLocaleText('TITLE', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_author' onClick='jsSetAvailableModsSort(\"AUTHOR\")'>" + jsGetLocaleText('AUTHOR', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_build' onClick='jsSetAvailableModsSort(\"BUILD\")'>" + jsGetLocaleText('BUILD', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_downloads' onClick='jsSetAvailableModsSort(\"DOWNLOADS\")'>" + jsGetLocaleText('DOWNLOADS', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_likes' onClick='jsSetAvailableModsSort(\"LIKES\")'>" + jsGetLocaleText('LIKES', objOptions["locale"]) + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_random' onClick='jsSetAvailableModsSort(\"RANDOM\")'>" + jsGetLocaleText('RANDOM', objOptions["locale"]) + "</a>" + 
                "</td>" +
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Category', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_category'>" + strCategoryHTML + "</td>" +
            "</tr>" +
        "</table>" +
        "<div id='filters_on_available'>" + 
            "<img class='filter_area_img' src='assets/img/filter.png'>" +
            "<div class='filter_area_message'> " + jsGetLocaleText('One_or_more_filters_are_currently_applied', objOptions["locale"]) + " " +
                "<span class='filter_area_link'>[ <a href='#' onClick='document.getElementById(\"filter_area_available_text_filter\").value=\"\"; jsSetAvailableModsFilter(\"ALL\"); jsSetAvailableModsFilterCategory(\"ALL\")'>" + jsGetLocaleText('clear', objOptions["locale"]) + "</a> ]</span>" +
            "</div>" +
        "</div>" +
    "</div>");
                
    $('#filter_area_available_text_filter').on("keyup", jsApplyOnlineModFilter);
    
    jsSortOnlineMods();
    
    var strHTML = "";
    
    for(var i = 0; i < objOnlineMods.length; i++) {
        strHTML += jsGenerateModEntryHTML(objOnlineMods[i], false);
    }
    
    $("#mod_list_available").append(strHTML);
    
    jsUpdateOptionsToggle(false);
    jsApplyOnlineModFilter();
}

function jsGenerateInstalledModsListHTML() {
    jsAddLogMessage("Generating Installed Mods List", 3);
                
    var strCategoryHTML = "";
    for (var category in objInstalledModCategories) {
        if(objInstalledModCategories.hasOwnProperty(category)){
            strCategoryHTML += "<div class='filter_area_category'><a href='#' id='filter_area_installed_category_" + category + "' onClick='jsSetInstalledModsFilterCategory(\"" + category + "\")'>" + category + "</a> (" + objInstalledModCategories[category] + ")</div>";
        }
    }
    
    $("#mod_list_installed").html("<div class='filter_area'>" +
        "<div class='filter_area_additional_options_toggle'>" +
            "<a href='#' id='filter_area_installed_toggle' onClick='jsToggleModListOptions(true)'>" + jsGetLocaleText('Hide_Additional_Options', objOptions["locale"]) + "</a>" + 
        "</div>" + 
        "<table>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Name_Filter', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_text_filter'>" + 
                    "<input id='filter_area_installed_text_filter' type='text' class='filter_area_textbox'>" + 
                "</td>" +
            "</tr>" + 
        "</table>" +
        "<table class='filter_area_container'>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Category', objOptions["locale"]) + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_category'>" + strCategoryHTML + "</td>" +
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Options', objOptions["locale"]) + ":</td>" +
                "<td>" + 
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_checked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(true)'>" + jsGetLocaleText('Enable_All', objOptions["locale"]) + "</a></div>" +
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_unchecked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(false)'>" + jsGetLocaleText('Disable_All', objOptions["locale"]) + "</a></div>" +
                "</td>" +
            "</tr>" +
        "</table>" +
        "<div id='filters_on_installed'>" +
            "<img class='filter_area_img' src='assets/img/filter.png'>" +
            "<div class='filter_area_message'> " + jsGetLocaleText('One_or_more_filters_are_currently_applied', objOptions["locale"]) + " " +
                "<span class='filter_area_link'>[ <a href='#' onClick='document.getElementById(\"filter_area_installed_text_filter\").value=\"\"; jsSetInstalledModsFilterCategory(\"ALL\")'>" + jsGetLocaleText('clear', objOptions["locale"]) + "</a> ]</span>" +
            "</div>" +
        "</div>" +
    "</div>");
    
    $('#filter_area_installed_text_filter').on("keyup", jsApplyInstalledModFilter);
    
    var strHTML = "";
    
    for(var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].id != PAMM_MOD_ID) {
            strHTML += jsGenerateModEntryHTML(objInstalledMods[i], true);
        }
    }
    
    if (jsGetModsRequiringUpdates() > 0) {
        $("#mod_list_installed").append("<div class='alert_area'>" + 
            "<img class='alert_img' src='assets/img/alert.png'>" + 
            "<div class='alert_message'>" + jsGetModsRequiringUpdates() + " " + jsGetLocaleText('mod_s__require_updates', objOptions["locale"]) + " " + 
                "<span class='alert_link'>[ <a href='#' onClick='jsUpdateAll()'><span class='LOC_update_all'>" + jsGetLocaleText('update_all', objOptions["locale"]) + "</span></a> ]</span>" + 
            "</div>" + 
        "</div>");
        
        $("#ui_tab_installed_needing_update").html("&nbsp;(<span class='ui_tab_installed_needing_update_count'>" + jsGetModsRequiringUpdates() + "</span>)");
    } else {
        $("#ui_tab_installed_needing_update").html("");
    }
    
    $("#mod_list_installed").append(strHTML);
                
    jsUpdateOptionsToggle(true);
    jsApplyInstalledModFilter();
}

/* Mod Getter Functions */
function jsGetOnlineMod(strModID) {
    for (var i = 0; i < objOnlineMods.length; i++) {
        if (objOnlineMods[i].id == strModID) {
            return objOnlineMods[i];
        }
    }
    return null;
}

function jsGetInstalledMod(strModID) {
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].id == strModID) {
            return objInstalledMods[i];
        }
    }
    return null;
}

/* HTML Function Calls */
function jsSetAllModStatus(boolStatus) {
    for (var i = 0; i < objInstalledMods.length; i++) {
        if (objInstalledMods[i].id != PAMM_MOD_ID) {
            if (objInstalledMods[i].enabled != boolStatus) {
                jsModEnabledToggle(objInstalledMods[i].id);
            }
        }
    }
}

function jsToggleModListOptions(boolInstalled) {
    var strListName = 'available';
    if (boolInstalled == true) {
        strListName = 'installed';
    }
    
    objOptions["show_" + strListName + "_filters"] = !objOptions["show_" + strListName + "_filters"];
    WriteOptionsJSON();
    jsUpdateOptionsToggle(boolInstalled)
}
        
function jsUpdateOptionsToggle(boolInstalled) {
    var strListName = 'available';
    if (boolInstalled == true) {
        strListName = 'installed';
    }
    
    if (objOptions["show_" + strListName + "_filters"] == true) {
        $("#filter_area_" + strListName + "_toggle").text(jsGetLocaleText('Hide_Additional_Options', objOptions["locale"]));
        $("#mod_list_" + strListName).find(".filter_area_container").show();
    } else {
        $("#filter_area_" + strListName + "_toggle").text(jsGetLocaleText('Show_Additional_Options', objOptions["locale"]));
        $("#mod_list_" + strListName).find(".filter_area_container").hide();
    }
}

function jsSetLanguage(boolSupressWrite) {
    objOptions["locale"] = document.getElementById("setting_language").value;
    jsAddLogMessage("Setting locale to " + objOptions["locale"], 3);
    $("#mod_list_available").html("");
    $("#mod_list_installed").html("");
    jsApplyLocaleText();
    jsGenerateInstalledModsListHTML();
    jsGenerateOnlineModsListHTML();
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
}

function jsSetAvailableModsSort(strNewSort) {
    objOptions["sort"] = strNewSort;
    jsAddLogMessage("Available Mods sort by " + objOptions["sort"] + " applied", 4);
    WriteOptionsJSON();
    jsGenerateOnlineModsListHTML();
}

function jsSetAvailableModsFilter(strNewFilter) {
    objOptions["available_filter"] = strNewFilter;
    jsAddLogMessage("Available Mods filter " + objOptions["available_filter"] + " applied", 4);
    WriteOptionsJSON();
    jsApplyOnlineModFilter();
}

function jsSetInstalledModsFilterCategory(strNewCategory) {
    objOptions["installed_category"] = strNewCategory;
    jsAddLogMessage("Installed Mods category filter " + objOptions["installed_category"] + " applied", 4);
    WriteOptionsJSON();
    jsApplyInstalledModFilter();
}

function jsSetAvailableModsFilterCategory(strNewCategory) {
    objOptions["available_category"] = strNewCategory;
    jsAddLogMessage("Available Mod category filter " + objOptions["available_category"] + " applied", 4);
    WriteOptionsJSON();
    jsApplyOnlineModFilter();
}

function jsApplyOnlineModFilter() {
    var boolFiltersEnabled = true;

    $('#mod_list_available').find('.mod_entry').removeClass('mod_entry_filtered');
    $('#mod_list_available .filter_area_filter_list_show a').removeClass('filter_area_filter_item_selected');
    switch (objOptions["available_filter"]) {
        case "ALL":
            $('#filter_area_show_all').addClass('filter_area_filter_item_selected');
            boolFiltersEnabled = false;
            break;
        case "INSTALLED":
            $('#mod_list_available').find('.mod_entry').not('.mod_entry_filter_installed').addClass('mod_entry_filtered');
            $('#filter_area_show_installed').addClass('filter_area_filter_item_selected');
            break;
        case "REQUIRES_UPDATE":
            $('#mod_list_available').find('.mod_entry').not('.mod_entry_filter_update_available').addClass('mod_entry_filtered');
            $('#filter_area_show_requires_update').addClass('filter_area_filter_item_selected');
            break;
        case "NEWLY_UPDATED":
            $('#mod_list_available').find('.mod_entry').not('.mod_entry_filter_new').addClass('mod_entry_filtered');
            $('#filter_area_show_newly_updated').addClass('filter_area_filter_item_selected');
            break;
        case "NOT_INSTALLED":
            $('#mod_list_available').find('.mod_entry').not('.mod_entry_filter_not_installed').addClass('mod_entry_filtered');
            $('#filter_area_show_not_installed').addClass('filter_area_filter_item_selected');
            break;
    }
    
    if (objOptions["available_category"] != "ALL") {
        $('#mod_list_available').find('.mod_entry').not('.mod_entry_category_' + objOptions["available_category"]).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $('#mod_list_available .filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_available_category_' + objOptions["available_category"]).addClass('filter_area_filter_item_selected');
    
    if ($('#filter_area_available_text_filter').val() != '') {
        var strSearch = $('#filter_area_available_text_filter').val().toLowerCase();
        $('#mod_list_available').find('.mod_entry').each(function() {
            if ($(this).find('.mod_entry_name').text().toLowerCase().indexOf(strSearch) < 0) {
                $(this).addClass('mod_entry_filtered');
            }
        });
        boolFiltersEnabled = true;
    }
    
    if (boolFiltersEnabled == true) {
        $('#filters_on_available').show();
    } else {
        $('#filters_on_available').hide();
    }
}

function jsApplyInstalledModFilter() {
    var boolFiltersEnabled = false;
    
    $('#mod_list_installed').find('.mod_entry').removeClass('mod_entry_filtered');
            
    if (objOptions["installed_category"] != "ALL") {
        $('#mod_list_installed').find('.mod_entry').not('.mod_entry_category_' + objOptions["installed_category"]).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $('#mod_list_installed .filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_installed_category_' + objOptions["installed_category"]).addClass('filter_area_filter_item_selected');
    
    if ($('#filter_area_installed_text_filter').val() != '') {
        var strSearch = $('#filter_area_installed_text_filter').val().toLowerCase();
        $('#mod_list_installed').find('.mod_entry').each(function() {
            if ($(this).find('.mod_entry_name').text().toLowerCase().indexOf(strSearch) < 0) {
                $(this).addClass('mod_entry_filtered');
            }
        });
        boolFiltersEnabled = true;
    }
    
    if (boolFiltersEnabled == true) {
        $('#filters_on_installed').show();
    } else {
        $('#filters_on_installed').hide();
    }
}

function jsDisplayPanel(strPanelName) {
    $('div.tab').hide();
    $('#'+strPanelName).show();
    
    $('.ui_tabs a').removeClass('ui_tab_link_selected');
    $('.ui_tabs a').each(function() {
        var $button = $(this);
        var target = $button.data('target');
        if(target === strPanelName) {
            $button.addClass('ui_tab_link_selected');
        }
    });
    
    document.getElementById('log_icon').src = strPanelName == 'log' ? 'assets/img/log_select.png' : 'assets/img/log.png';
    document.getElementById('settings_icon').src = strPanelName == 'settings' ? 'assets/img/settings_select.png' : 'assets/img/settings.png';
    document.getElementById('about_icon').src = strPanelName == 'about' ? 'assets/img/about_select.png' : 'assets/img/about.png';
}

function jsPreInstallMod(strURL, strModID, objModsPreInstalled) {
    
    var objThisMod = jsGetOnlineMod(strModID);
    
    if (objThisMod["requires"] != null) {
        for (var i = 0; i < objThisMod["requires"].length; i++) {
            if (jsGetInstalledMod(objThisMod["requires"][i]) == null && objModsPreInstalled[objThisMod["requires"][i]] == null) {
                objModsPreInstalled[objThisMod["requires"][i]] = true;
                var strName = objThisMod["requires"][i];
                if (jsGetOnlineMod(objThisMod["requires"][i]) != null) {
                    strName = jsGetOnlineMod(objThisMod["requires"][i]).display_name;
                    var boolConfirm = confirm("Install required dependency '" + strName + "'?");
                    if (boolConfirm == true) {
                        objModsPreInstalled = jsPreInstallMod(jsGetOnlineMod(objThisMod["requires"][i]).url, objThisMod["requires"][i], objModsPreInstalled);
                    }
                } else {
                    alert("Warning: Required dependency '" + strName + "' unavailable");
                }
            }
        }
    }
    
    jsDelayedInstall(strURL, strModID);
    return objModsPreInstalled;
}

function jsDelayedInstall(strURL, strModID) {
    if (strModInstalling != "") {
        setTimeout(function() { 
            jsDelayedInstall(strURL, strModID);
        }, 500);
    } else {
        strModInstalling = strModID;
        InstallMod(strURL, strModID);
    }
}

function jsPreUninstallMod(strModID) {
    var boolConfirm = confirm("Are you sure you want to uninstall '" + jsGetInstalledMod(strModID).display_name + "'?");
    
    if (boolConfirm == true) {
        UninstallMod(strModID);
        jsRefresh(false, false);
    }
}

function jsSetModsListView(boolInstalled, boolSupressWrite) {
    var strListName = 'available';
    if (boolInstalled == true) {
        strListName = 'installed';
    }
    
    objOptions[strListName + "_view"] = document.getElementById("setting_" + strListName + "_view").value;
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
    
    if (objOptions[strListName + "_view"] == 'detailed') {
        $("#mod_list_" + strListName).find(".mod_entry").addClass("mod_entry_detailed");
        $("#mod_list_" + strListName).find(".mod_entry").removeClass("mod_entry_summary");
    } else {
        $("#mod_list_" + strListName).find(".mod_entry").removeClass("mod_entry_detailed");
        $("#mod_list_" + strListName).find(".mod_entry").addClass("mod_entry_summary");
    }
}
        
function jsSetModsListIcon(boolInstalled, boolSupressWrite) {
    var strListName = 'available';
    if (boolInstalled == true) {
        strListName = 'installed';
    }
    
    objOptions[strListName + "_icon"] = document.getElementById("setting_" + strListName + "_icon").checked;
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
    
    if (objOptions[strListName + "_icon"] == true) {
        $("#mod_list_" + strListName).find(".mod_entry_icon").removeClass("mod_entry_icon_disabled");
    } else {
        $("#mod_list_" + strListName).find(".mod_entry_icon").addClass("mod_entry_icon_disabled");
    }
}

/* Download Functions */
function jsCheckOnlineStatus() {
    jsAddLogMessage("Checking online status", 3);
    boolOnline = false;
    jsDownload(PAMM_ONLINE_TEST_URL, {
		success: function() {
			boolOnline = true;
			jsAddLogMessage("Online status: " + (boolOnline == true ? "ONLINE" : "OFFLINE"), 2);
			jsRefresh_asynch(true);
		}
		,error: function() {
			jsAddLogMessage("Online status: " + (boolOnline == true ? "ONLINE" : "OFFLINE"), 2);
			jsRefresh_asynch(true);
		}
	});
}

function jsDownload(strURL, opts) {
    if(!opts) opts = {};
	
	var options = url.parse(strURL);
    if(proxy) {
        var proxyOpts = url.parse(proxy);
        proxyOpts.path = strURL;
        proxyOpts.headers = {
            Host: options.host
        }
        options = proxyOpts;
    }
    
    var outputstream;
    if(opts.tofile) {
        outputstream = fs.createWriteStream(opts.tofile);
    }
    
    intMessageID++;
    var intCurrentMessageID = intMessageID;
    
    var req = http.request(options, function(res) {
        jsAddLogMessage("[Message ID: " + intCurrentMessageID + "] HTTP " + res.statusCode, 4);
        
		res.on("end", function() {
			intDownloading--;
			if (intDownloading == 0) {
				document.getElementById("downloading").style.display = "none";
			}
		});
        
		if(res.statusCode !== 200) {
			if(outputstream) {
				outputstream.end();
			}
			if(opts.error) {
				opts.error();
			}
			return;
		}
		
        var body = "";
        
        if(opts.success) {
            if(outputstream) {
                outputstream.on("finish", function() {
                    opts.success();
                });
            }
            else {
                res.on("end", function() {
                    opts.success(body);
                });
            }
        }
        
        if(outputstream) {
            res.pipe(outputstream);
        }
        else {
            res.on("data", function(chunk) {
                body = body + chunk;
            });
        }
    });
    
    req.on('error', function(e) {
        intDownloading--;
        if (intDownloading == 0) {
            document.getElementById("downloading").style.display = "none";
        }
        jsAddLogMessage("Network Error: attempting to send request to " + strURL + ": " + e.message, 1);
		
		if(opts.error) {
			opts.error();
		}
    });
    
    document.getElementById("downloading").style.display = "block";
    jsAddLogMessage("[Message ID: " + intCurrentMessageID + "] GET <code class='log_url'>" + strURL + "</code>", 4);
    intDownloading++;
    
    req.end();
}

/* Refresh & Update Functions */
function jsUpdateFiles() {
    if (boolAutoWrite == true) {
        WriteModsJSON();
        WriteUIModListJS();
        WriterModListJS();
    }
}

function jsRefresh(boolShowLoading, boolDownloadData) {
    //TODO: Localisation
    if (boolShowLoading == true) {
        document.getElementById("news_data").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading', objOptions["locale"]) + "...</div>";
        document.getElementById("mod_list_installed").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading', objOptions["locale"]) + "...</div>";
        document.getElementById("mod_list_available").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading', objOptions["locale"]) + "...</div>";
        document.getElementById('total_available_mods').innerHTML = jsGetLocaleText('Loading', objOptions["locale"]) + "...";
        document.getElementById('total_available_mod_downloads').innerHTML = jsGetLocaleText('Loading', objOptions["locale"]) + "...";
    }
    
    if (boolDownloadData == true) {
        jsCheckOnlineStatus();
    } else {
        jsRefresh_asynch(boolDownloadData)
    }
}

function jsRefresh_asynch(boolDownloadData) {
    if (boolOnline == false) {
        document.getElementById("news_data").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline', objOptions["locale"]) + "</div>";	
        document.getElementById("mod_list_available").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline', objOptions["locale"]) + "</div>";
        document.getElementById('total_available_mods').innerHTML = jsGetLocaleText('Mod_Manager_is_offline', objOptions["locale"]);
        document.getElementById('total_available_mod_downloads').innerHTML = jsGetLocaleText('Mod_Manager_is_offline', objOptions["locale"]);
    }
    
    if (boolOnline == true) {
        jsDownloadPAMMversion();
    }
    
    jsAddLogMessage("Refreshing Data", 2);
    
    objInstalledModCategories["ALL"] = 0;
    FindInstalledMods();
    document.getElementById('total_installed_mods').innerHTML = objInstalledMods.length;
    objInstalledMods.sort(sort_by('display_name', true, null));

    if (boolOnline == true && boolDownloadData == true) {
        jsDownloadNews();
        jsDownloadOnlineMods();
    } else {
        jsGenerateInstalledModsListHTML();
        if (boolOnline == true) {
            jsGenerateOnlineModsListHTML();
        }
    }
}

function jsGetModsRequiringUpdates() {
    var intModsRequiringUpdate = 0;

    for(var i = 0; i < objInstalledMods.length; i++) {
        if (jsGetOnlineMod(objInstalledMods[i]["id"]) != null && objInstalledMods[i]["date"] < jsGetOnlineMod(objInstalledMods[i]["id"])["date"]) {
            intModsRequiringUpdate++;
        }
    }
    return intModsRequiringUpdate;
}

/* Settings Functions */
function jsToggleModLikes(boolSupressWrite) {
    objOptions["modlikes"] = document.getElementById("setting_likes").checked;
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
}

function jsToggleDebugMode(boolSupressWrite) {
    jsSetLogLevel(document.getElementById("setting_debug").checked ? 4 : objOptions["verbose"] ? 3 : 2);
    objOptions["debug"] = document.getElementById("setting_debug").checked;
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
}

function jsToggleVerboseMode(boolSupressWrite) {
    jsSetLogLevel(document.getElementById("setting_debug").checked ? 4 : document.getElementById("setting_verbose").checked ? 3 : 2);
    objOptions["verbose"] = document.getElementById("setting_verbose").checked;
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
}

function jsSetDefaultTab(boolSupressWrite) {
    objOptions["tab"] = document.getElementById("setting_defaultTab").value;
    jsAddLogMessage("Setting default tab to " + objOptions["tab"], 3);
    if (boolSupressWrite !== true) {
        WriteOptionsJSON();
    }
}

function jsAddLogMessage(strText, intLevel) {
	console.log('LOG: ' + strText);
    var strType = "INFO";
    if (intLevel == 1) { 
        strType = "ERROR"; 
    }
    if (intLevel == 4) { 
        strType = "DEBUG"; 
    }
    
    var objCurrentTime = new Date();
    var strHours = objCurrentTime.getHours() < 10 ? "0" + objCurrentTime.getHours() : objCurrentTime.getHours();
    var strMinutes = objCurrentTime.getMinutes() < 10 ? "0" + objCurrentTime.getMinutes() : objCurrentTime.getMinutes();
    var strSeconds = objCurrentTime.getSeconds() < 10 ? "0" + objCurrentTime.getSeconds() : objCurrentTime.getSeconds();

    document.getElementById("log_data").innerHTML += '<div id="log_' + intLogNumber + '" class="log_entry' + (intLevel == 4 ? "_debug" : "") + ' log_level' + intLevel + '"><div class="log_time">' + strHours + ':' + strMinutes + ':' + strSeconds + '</div><div class="log_type">[' + strType + ']</div> ' + strText + '</div>';
    
    if (intLevel <= intLogLevel) { 
        $("#log_" + intLogNumber).css({display: "block"});
    }

    document.getElementById("log_data").scrollTop = document.getElementById("log_data").scrollHeight;
    intLogNumber++;
}

function jsSetLogLevel(intLevel) {
    var strLevel = "INFO";
    if (intLevel == 1) { 
        strLevel = "ERROR"; 
    }
    if (intLevel == 3) { 
        strLevel = "INFO - VERBOSE"; 
    }
    if (intLevel == 4) { 
        strLevel = "DEBUG"; 
    }
    if (intLevel != intLogLevel) {
        jsAddLogMessage("Setting log level to " + intLevel + " (" + strLevel + ")", 3);
        intLogLevel = intLevel;
        $(".log_level3").css({display: intLogLevel >= 3 ? "block" : "none"});
        $(".log_level4").css({display: intLogLevel >= 4 ? "block" : "none"});
    }
}

function jsDownloadOnlineMods() {
    if (boolOnline == true) {
        jsAddLogMessage("Downloading available mods list", 2);
        jsDownload(ONLINE_MODS_LIST_URL, {
			success: function(data) {
				try {
					objOnlineMods = [];
					objOnlineModCategories = {};
					
					objOnlineModCategories["ALL"] = 0;
				
					var objModData = JSON.parse(data);
					for (var id in objModData) {
						objModData[id]["id"] = id;
						objModData[id]["likes"] = -2;
						objOnlineMods.push(objModData[id]);
						if (jsGetInstalledMod(id) != null && jsGetInstalledMod(id)["date"] < objModData[id]["date"]) {
							jsAddLogMessage("Update available for installed mod '" + jsGetInstalledMod(id)["display_name"] + "': " + objModData[id]["version"] + " (" + objModData[id]["date"] + ")", 3);
						}
						
						if (objModData[id].category != null) {
							for (var i = 0; i < objModData[id].category.length; i++) {
								var strCurrentCategory = objModData[id].category[i].replace(" ", "-").toUpperCase();
								if (objOnlineModCategories[strCurrentCategory] == null) {
									objOnlineModCategories[strCurrentCategory] = 1;
								} else {
									objOnlineModCategories[strCurrentCategory]++;
								}
							}
						}
						objOnlineModCategories["ALL"]++;
					}
					document.getElementById('total_available_mods').innerHTML = objOnlineMods.length;
					jsDownloadOnlineModDownloadCount();
				} catch (e) {
					jsAddLogMessage("Error loading online mod data: " + e.message, 1);
				}
			}
		});
    }
}

function jsDownloadOnlineModDownloadCount() {
    if (boolOnline == true) {
        jsAddLogMessage("Getting availailable mod download counts", 2);
        jsDownload(ONLINE_MODS_DOWNLOAD_COUNT_URL, {
			success: function(strResult) {
				var intTotalDownloadCount = 0;
				try {
					var objOnlineModsDownloadCount = JSON.parse(strResult);
					for (var i = 0; i < objOnlineMods.length; i++) {
						objOnlineMods[i]["downloads"] = objOnlineModsDownloadCount[objOnlineMods[i].id] ? objOnlineModsDownloadCount[objOnlineMods[i].id] : 0;
						intTotalDownloadCount += objOnlineMods[i]["downloads"];
					}
					
					jsGenerateOnlineModsListHTML();
					jsGenerateInstalledModsListHTML();
					if (objOptions["modlikes"] == true) {
						jsDownloadOnlineModLikeCount();
					}
					//WriterModListJS();
				} catch (e) {
					jsAddLogMessage("Error loading online mod download count data: " + e.message, 1);
				}
				document.getElementById('total_available_mod_downloads').innerHTML = intTotalDownloadCount;
			}
        });
    }
}

function jsDownloadOnlineModLikeCount() {
    jsAddLogMessage("Getting mod likes", 2);
    for (var i = 0; i < objOnlineMods.length; i++) {
        if (objOnlineMods[i]["forum"] != null) {
            if (objOnlineMods[i]["forum"].indexOf("forums.uberent.com") > -1) {
                intLikeCountRemaining++;
                jsDownload(objOnlineMods[i]["forum"], {
					success: function(strResult) {
						var intModID = objOnlineMods[i].id;
						var objOnlineMod = jsGetOnlineMod(intModID);
						try {
							var objNodes = $(strResult).find(".message").first().find(".LikeText");
							var intLikes = objNodes.children(".username").length;
							if  (objNodes.children(".OverlayTrigger").length > 0) {
								var strText = objNodes.children(".OverlayTrigger").text();
								intLikes += parseInt(strText);
							}
							objOnlineMod["likes"] = intLikes;
							jsAddLogMessage("Like count for mod '" + objOnlineMod["display_name"] + "': " + intLikes, 3);
						} catch (e) {
							jsAddLogMessage("Error loading online mod like count data: " + e.message, 1);
							objOnlineMod["likes"] = -1;
						}
						intLikeCountRemaining--;
					}
                });
            } else {
                jsAddLogMessage("Invalid forum link for mod '" + objOnlineMods[i]["display_name"] + "' (Not from forums.uberent.com)", 3);
                objOnlineMods[i]["likes"] = -1;
            }
        } else {
            jsAddLogMessage("Missing forum link for mod '" + objOnlineMods[i]["display_name"] + "'", 3);
            objOnlineMods[i]["likes"] = -1;
        }
    }
    
    var objTimer = setInterval(function() {
        if(intLikeCountRemaining == 0) {
            jsGenerateOnlineModsListHTML();
            clearInterval(objTimer);
        }
    }, 100);
}

function jsDownloadPAMMversion() {
    if (boolOnline == true) {
        jsAddLogMessage("Checking for PAMM updates", 2);
        jsDownload(PAMM_VERSION_DATA_URL, {
			success: function(data) {
				try {
					objPAMMVersionData = JSON.parse(data);
					var dateLatestPAMM = new Date(objPAMMVersionData.date);
					
					jsAddLogMessage("Latest version of PAMM: " + objPAMMVersionData.version + " (" + objPAMMVersionData.date + ")", 2);
					if (new Date(datePAMM) < dateLatestPAMM) {
						jsAddLogMessage("New version of PAMM available: " + objPAMMVersionData.version + " (" + objPAMMVersionData.date + ")", 2);
						//UpdatePAMM(objPAMMVersionData.version, objPAMMVersionData.filename);
					} else {
						jsAddLogMessage("Latest version of PAMM installed", 2);
					}
				} catch (e) {
					jsAddLogMessage("Error loading PAMM version data: " + e.message, 1);
				}
			}
        });
    }
}

function jsDownloadNews() {
    if (boolOnline == true) {
        jsAddLogMessage("Downloading news", 2);
        jsDownload(NEWS_URL, {
			success: function(html) {
				document.getElementById("news_data").innerHTML = html;
			}
        });
    }
}

/**
** Old VBSCRIPT part
**/

function Initialise() {
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
    
    strLocalPath = localpath + "/Uber Entertainment/Planetary Annihilation"
    strModsDirectoryPath = strLocalPath + "/mods"
    strPammModDirectoryPath = strModsDirectoryPath + "/" + PAMM_MOD_ID;
    strPAMMCacheDirectoryPath = strLocalPath + "/pamm_cache"
    
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
        "version": strPAMMversion,
        "build": strPABuild,
        "signature": "not yet implemented",
        "priority": 0,
        "enabled": true,
        "id": PAMM_MOD_ID
    };
    fs.writeFileSync(strPammModDirectoryPath + "/modinfo.json", JSON.stringify(modinfo, null, 4));
}

function CreateFolderIfNotExists(path) {
    if(!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
}

function LaunchURL(strURL) {
    shell.openExternal(strURL);
}

function ClosePAMM() {
    var remote = require('remote');
    var app = remote.require('app');
    app.quit();
}

function FindInstalledMods() {
    var intMods = 0;
    objInstalledMods = [];
    
    var moddirs = fs.readdirSync(strModsDirectoryPath);
    for(var i in moddirs) {
        var modname = moddirs[i];
        var moddir = strModsDirectoryPath + '/' + modname;
        if(fs.statSync(moddir).isDirectory()) {
            jsAddLogMessage("Found installed mod: " + modname, 3)
            
            var strmodinfo = fs.readFileSync(moddir + '/modinfo.json', {encoding: 'utf8'});
            
            var strModID = modname;
            var objCurrentMod = {};
			try {
				objCurrentMod = JSON.parse(strmodinfo);
				
				objCurrentMod["priority"] = objCurrentMod["priority"] ? objCurrentMod["priority"] : 100;
				if (objCurrentMod["enabled"] == null || strModID == PAMM_MOD_ID) {
					objCurrentMod["enabled"] = true;
				}
				objCurrentMod["id"] = strModID;
				
				if (objCurrentMod.category != null) {
					for (var i = 0; i < objCurrentMod.category.length; i++) {
						var strCurrentCategory = objCurrentMod.category[i].replace(" ", "-").toUpperCase();
						if (objInstalledModCategories[strCurrentCategory] == null) {
							objInstalledModCategories[strCurrentCategory] = 1;
						} else {
							objInstalledModCategories[strCurrentCategory]++;
						}
					}
				}
				
				objInstalledModCategories["ALL"]++;
				objInstalledMods.push(objCurrentMod);
			} catch (err) {
				var strName = strModID;
				if (objCurrentMod["display_name"] != null) {
					strName = objCurrentMod["display_name"];
				}
				alert("Error loading installed mod '" + strName + "'");
			}
            
            intMods = intMods + 1;
        }
    }
    
    jsAddLogMessage("Found " + intMods + " installed mods", 2);
    jsUpdateFiles();
}

function LoadOptions() {
    try {
        var strOptions = fs.readFileSync(strPAMMCacheDirectoryPath + '/' + PAMM_OPTIONS_FILENAME, { encoding: 'utf8' });
        jsLoadOptionsData(strOptions);
    }
    catch(e) {
        jsAddLogMessage("Options file not found, using defaults", 3);
        jsLoadOptionsData("{}");
    }
}

function WriteOptionsJSON() {
    try {
        jsAddLogMessage("Writing options file", 4);
        var strOptions = jsGetOptionsDataString();
        fs.writeFileSync(strPAMMCacheDirectoryPath + '/' + PAMM_OPTIONS_FILENAME, strOptions);
    }
    catch(e) {
        jsAddLogMessage("Failed to write options file.", 3);
    }
}

function WriteUIModListJS() {
    jsAddLogMessage("Writing ui_mod_list.js", 4);
    var data = "var global_mod_list = " + jsGetUIModListGlobalDataString() + ";\n\nvar scene_mod_list = " + jsGetUIModListSceneDataString();
    fs.writeFileSync(strPammModDirectoryPath + "/ui/mods/ui_mod_list.js", data);
}

function WriterModListJS() {
    jsAddLogMessage("Writing mods_list.json", 4);
    var data = jsGetInstalledModListDataString();
    fs.writeFileSync(strPammModDirectoryPath + "/ui/mods/mods_list.json", data);
}

function WriteModsJSON() {
    jsAddLogMessage("Writing mods.json", 4)
    var data = jsGetModsJSONDataString();
    fs.writeFileSync(strModsDirectoryPath + "/mods.json", data);
}

function WriteModinfoJSON(strModID) {
    var modinfopath = strModsDirectoryPath + "/" + strModID + "/modinfo.json";
    
    if(!fs.existsSync(modinfopath))
        return;
    
    jsAddLogMessage("Writing modsinfo.json for mod '" + strModID + "'", 4)
    
    var data = jsGetInstalledModDataString(strModID);
    fs.writeFileSync(modinfopath, data);
}

// Downloads and installs a mod
function InstallMod(strURL, strModID) {
    var strModFileName = strURL.substring(strURL.lastIndexOf("/") + 1);
    
    if(strModFileName.indexOf("?") !== -1) {
        strModFileName = strModFileName.substring(0, strModFileName.indexOf("?"));
    }

    RemoveFileFromCache(strModFileName);
    
    //jsDownload(MANAGE_URL + "?download=" + strModID);
    
    jsAddLogMessage("Downloading mod '" + strModID + "'", 3)
    jsDownload(strURL, {
		tofile: strPAMMCacheDirectoryPath + "/" + strModFileName
		,success: function() {
			UninstallMod(strModID);
			ExtractMod(strModFileName, strModID);
		}
    });
}

// Extracts a Mod Zip file to the mods folder
function ExtractMod(strFileName, strModID) {
    var modfile = strPAMMCacheDirectoryPath + "/" + strFileName;
    
    if(fs.existsSync(modfile)) {
        jsAddLogMessage("Installing mod '" + strModID + "'", 3)
        
        unzipSync(strModID, modfile, strModsDirectoryPath);
        
        jsRefresh(false, false);
        jsSetModEnabledStatus(strModID, true);
    }
    
    if(strModInstalling !== "") {
        strModInstalling = "";
    }
}

// Removes a specified file from the cache, if it exists
function RemoveFileFromCache(strFileName) {
    var modfile = strPAMMCacheDirectoryPath + "/" + strFileName;
    if(fs.existsSync(modfile)) {
        jsAddLogMessage("Clearing cached file '" + strFileName + "'", 4)
        fs.unlinkSync(modfile);
    }
}

// Uninstalls a mod
function UninstallMod(strModID) {
    var modpath = strModsDirectoryPath + "/" + strModID;
    if(fs.existsSync(modpath)) {
        jsAddLogMessage("Uninstalling mod '" + strModID + "'", 2)
        rmdirRecurseSync(modpath);
        jsRemoveInstalledMod(strModID)
    }
}

function CheckPAPresent(strPath) {
    if (!fs.existsSync(strPath))
        return false;
    
    if(!fs.statSync(strPath).isFile())
        return false;
    
    return true;
}

function LaunchPA() {
    var child_process = require('child_process');
	var path = require('path');
	var papath = jsGetOption("pa_path");
	var wd = path.dirname(papath);
	var child = child_process.spawn(papath, null, { cwd: wd, detached: true });
	child.unref();
	ClosePAMM();
}

function OpenModsFolder() {
    //var item = strModsDirectoryPath + '/mods.json';
    //shell.showItemInFolder(item.replace(/\//g,"\\"));
}

function unzipSync(modid, zipfile, targetfolder) {
    if(!fs.existsSync(targetfolder)) {
        throw targetfolder + ' folder does not exists.' ;
    }
    
    var zipdata = fs.readFileSync(zipfile);
    var zip = new JSZip(zipdata.toArrayBuffer());
    
    // zip.folders not reliable, some directories are not detected as directory (eg. instant_sandbox zip)
    
    for(var i in zip.files) {
        var file = zip.files[i];
        
        if(file.name.indexOf(modid + '/') !== 0)
            continue;
        
        var path = targetfolder + '/' + file.name;
        
        if(path.indexOf('/', path.length - 1) !== -1) {
            if (fs.existsSync(path))
                continue;
            fs.mkdirSync(path);
        }
        else {
            fs.writeFileSync(path, new Buffer(file.asUint8Array()));
        }
    }
}

function rmdirRecurseSync(dir) {
    var list = fs.readdirSync(dir);
    for(var i = 0; i < list.length; ++i) {
        var filename = dir + "/" + list[i];
        var stat = fs.statSync(filename);
        if(stat.isDirectory()) {
            // rmdir recursively
            rmdirRecurseSync(filename);
        } else {
            // rm filename
            fs.unlinkSync(filename);
        }
    }
    fs.rmdirSync(dir);
};

function findPA() {
    var logpath = strLocalPath + '/log';
    var logfiles = fs.readdirSync(logpath);
    
    if(logfiles.length === 0)
        return "";
    
    // find last log file
    var lastlogfile;
    var laststat;
    for(var i=0; i<logfiles.length; ++i) {
        var logfile = logpath + '/' + logfiles[i];
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
    for(var i=0; i<lines.length; ++i) {
        var line = lines[i];
        if(line.indexOf("Coherent host dir: ") !== -1) {
            // extract PA path
            var spos = line.indexOf('"') + 1;
            var epos = line.lastIndexOf('"');
            var papath = line.substring(spos, epos);
            if(process.platform === "win32") {
                papath = papath.replace(/\\\\/g, "\\");
                papath = path.dirname(path.dirname(papath)); // remove /xXX/host
                papath = papath + "\\PA.exe";
            }
            else {
                papath = path.dirname(papath); // remove /host
                papath = papath + "/PA";
            }
            
            return papath;
        }
    }
    
    return "";
}

function findPAVersion() {
    var papath = objOptions["pa_path"];
    
    if(!papath)
        return "";
    
    // read version number
    var versionpath = path.join(path.dirname(papath),'version.txt');
    if(fs.existsSync(versionpath))
        return fs.readFileSync(versionpath, { encoding: 'utf8' });
    
    return "";
}

$(function() {
    $('.ui_tabs').on('click', 'a', function() {
        var panel = $(this).data('target');
        jsDisplayPanel(panel);
    });
    
    var setting_installLocation_timeout;
    $('#setting_installLocation').on('input',function(e){
        clearTimeout(setting_installLocation_timeout);
        var $input = $(this);
        setting_installLocation_timeout = setTimeout(function() {
            var papath = $input.val();
            if(CheckPAPresent(papath)) {
                objOptions["pa_path"] = papath;
                strPABuild = findPAVersion();
                WriteOptionsJSON();
            }
            else {
                papath = "";
                objOptions["pa_path"] = "";
                strPABuild = "";
            }
            $('#current_pa_build').text(strPABuild);
            document.getElementById("btnLaunch").disabled = (papath?false:true);
        }, 500);
    });
    
    // autoresize body with window
    var $window = $(window);
    var $body = $('body');
    $window.on('resize', function() {
        $body.height($window.height() - 180);
    });
    $window.trigger('resize');
    
    Initialise();
    LoadOptions();
    
    jsApplyLocaleText();
	$('#current_pamm_version').text(strPAMMversion);
    jsRefresh(true, true);
});

//})();