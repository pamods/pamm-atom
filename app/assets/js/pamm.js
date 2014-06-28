var semver = require('semver');
var sprintf = require('sprintf').sprintf;
var JSZip = require('jszip');
var shell = require('shell');
var _ = require('lodash');

var jsDownload = require('./assets/js/download.js').download;
var pamm = require('./assets/js/pamm-api.js');
var pa = require('./assets/js/pa.js');
//(function() {

var url = require('url');
var fs = require('fs');
var path = require('path');

var params = require('remote').getGlobal('params');
var settings;

var objInstalledMods = { client: [], server: [], union: [] };
var objOnlineMods = [];
var objOnlineModCategories = {};
var objInstalledModCategories = { client: {}, server: {} };

var boolOnline = params.offline ? false : true;
var intMessageID = 0;
var intDownloading = 0;
var intLogLevel = 0;
var intLogNumber = 0;
var intLikeCountRemaining = 0;

var UNINSTALL_LEGACY_PAMM = 1;
var ONLINE_MODS_DOWNLOAD_COUNT_URL = "http://pa.raevn.com/modcount_json.php";
var MANAGE_URL = "http://pa.raevn.com/manage.php";
var MOD_IS_NEW_PERIOD_DAYS = 7;
var NEWS_URL = "http://pamods.github.io/news.html";
var PAMM_VERSION_DATA_URL = "https://raw.githubusercontent.com/%(author)s/%(name)s/stable/app/package.json";
var PAMM_UPDATE_URL = "https://github.com/%(author)s/%(name)s/archive/stable.zip";
var PAMM_OPTIONS_FILENAME = "pamm.json";
var PA_VERSION_URL = "https://uberent.com/launcher/clientversion?titleid=4";
var MOD_GENERIC_ICON_URL = "assets/img/generic.png";

var strPAMMversion = params.info.version;

/* Localisation Functions */
function jsGetLocaleText(strKey) {
    var locale = settings.locale();
    if (strlocaleText[strKey]) {
        return strlocaleText[strKey][locale] ? strlocaleText[strKey][locale] : strlocaleText[strKey]["en"];
    }
    return strKey;
}

function jsApplyLocaleText() {
    for (var i = 0; i < strLocaleTextItems.length; i++) {
        var objLocItems = $(".LOC_" + strLocaleTextItems[i]);
        if (objLocItems.length > 0) {
            if (objLocItems.prop("tagName") == "INPUT") {
                objLocItems.attr("value", jsGetLocaleText(strLocaleTextItems[i]));
            } else {
                objLocItems.text(jsGetLocaleText(strLocaleTextItems[i]));
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
    switch (settings.sort()) {
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

/* Installed Mod Functions */
function jsUpdateAll(context) {
    var mods = objInstalledMods[context];
    for (var i = 0; i < mods.length; i++) {
        if (jsGetOnlineMod(mods[i].identifier) != null && mods[i].version !== jsGetOnlineMod(mods[i].identifier).version) {
            jsPreInstallMod(jsGetOnlineMod(mods[i].identifier).url, mods[i].identifier, {});
        }
    }
}

function jsModEnabledToggle(strModID) {
    var $checkbox = $('#mod' + strModID.replace(/\./g, '\\.'));
	var enabled = $checkbox.prop("checked") ? false : true;
	
	try {
        var ids = pamm.setEnabled(strModID, enabled);
	}
	catch(e) {
		alert(e);
		return;
	}
	
	for(var i = 0; i < ids.length; ++i) {
		var id = ids[i];
		id = id.replace(/\./g, '\\.');
        
		var $checkbox = $('#mod' + id);
		var $image = $('#modimg' + id);
		
		$checkbox.prop("checked", enabled);
		if(enabled === true) {
			$image.attr('src', "assets/img/checkbox_checked.png");
		} else {
			$image.attr('src', "assets/img/checkbox_unchecked.png");
		}
	}
}

function jsSetAllModStatus(enabled, context) {
	try {
        var ids = pamm.setAllEnabled(enabled, context);
	}
	catch(e) {
		alert(e);
		return;
	}
    
	for(var i = 0; i < ids.length; ++i) {
		var id = ids[i];
		id = id.replace(/\./g, '\\.');
        
		var $checkbox = $('#mod' + id);
		var $image = $('#modimg' + id);
		
		$checkbox.prop("checked", enabled);
		if(enabled === true) {
			$image.attr('src', "assets/img/checkbox_checked.png");
		} else {
			$image.attr('src', "assets/img/checkbox_unchecked.png");
		}
	}
}

function jsGenerateModEntryHTML(objMod, boolIsInstalled) {
    var id = objMod.identifier;
    var strHTML_classes = "mod_entry mod_entry_context_" + objMod.context;
    
    /* Icon */
    var strHTML_icon_source = MOD_GENERIC_ICON_URL;
    if (objMod.icon != null) {
        strHTML_icon_source = objMod.icon;
    }
    var strHTML_icon = "<div class='mod_entry_icon'><img width='100%' height='100%' src='" + strHTML_icon_source + "'></div>";
            
    /* Name */
    var strHTML_display_name = "<div class='mod_entry_name'>" + objMod.display_name + "</div>";
    if (objMod["display_name_" + settings.locale()] != null ) {
        strHTML_display_name = "<div class='mod_entry_name'>" + objMod["display_name_" + settings.locale()] + "</div>";
    }
    
    /* Author */
    var strHTML_author = "<div class='mod_entry_author'>" + jsGetLocaleText('by') + " " + objMod.author + "</div>";
    
    /* Version */
    var strHTML_version = jsGetLocaleText('Version') + ": " + objMod.version;
    
    /* Build */
    var strHTML_build = "";
    if (objMod.build != null) {
        strHTML_build = ", " + jsGetLocaleText('build') + " " + objMod.build;
    }
    
    /* Date */
    var strHTML_date = "";
    if (objMod.date != null) {
        strHTML_date = " (" + objMod.date + ")";
    }
    
    /* Requires */
    var strHTML_requires = "";
    if (objMod.dependencies && objMod.dependencies.length > 0) {
        for (var j = 0; j < objMod.dependencies.length; j++) {
            var dependencyId = objMod.dependencies[j];
            var installedDependency = jsGetInstalledMod(dependencyId) ? true : false;
            
            if (!installedDependency) {
                strHTML_requires += "<span class='mod_requirement_missing'>" + dependencyId + "</span>";
            } else {
                strHTML_requires += "<span class='mod_requirement'>" + dependencyId + "</span>";
            }
            
            if (j < objMod.dependencies.length - 1) {
                strHTML_requires += ", ";
            }
        }
        strHTML_requires = "<div class='mod_entry_requires'>" + jsGetLocaleText('REQUIRES') + ": " + strHTML_requires + "</div>";
    }

    
    /* Description */
    var strHTML_description = "<div class='mod_entry_description'>" + objMod.description + "</div>";
    if (objMod["description_" + settings.locale()] != null) {
        strHTML_description = "<div class='mod_entry_description'>" + objMod["description_" + settings.locale()] + "</div>";
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
        strHTML_forum_link = "<div class='mod_entry_link' onclick='window.event.cancelBubble = true'>[ <a href='#' onClick='LaunchURL(\"" + objMod.forum + "\")'>" + jsGetLocaleText('forum') + "</a> ]</div>";
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
        if (settings['installed_' + objMod.context + '_view']() == 'detailed') {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_detailed');
        } else {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_summary');
        }
        
        if (settings['installed_' + objMod.context + '_icon']() == false) {
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
        strHTML_entry_onclick = " data-mod='" + id + "'";
        
        /* Update Available Notification */
        if (objOnlineMod != null) {
            if (objMod.version !== objOnlineMod.version) {
                strHTML_update_link = "<div class='mod_entry_link mod_entry_update_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objOnlineMod.url + "\",\"" + id + "\", {})'>" + jsGetLocaleText('update') + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_update_available');
            }
        }
        
        if(!objMod.stockmod) {
            /* Uninstall Link */
            strHTML_uninstall_link = "<div class='mod_entry_link mod_entry_uninstall_link' onclick='window.event.cancelBubble = true'>[ <a href='#' onClick='jsPreUninstallMod(\"" + id + "\")'>" + jsGetLocaleText('uninstall') + "</a> ]</div>";
        }
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
        if (settings.available_view() == 'detailed') {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_detailed');
        } else {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_summary');
        }
    
        if (settings.available_icon() == false) {
            strHTML_icon = strHTML_icon.replace('mod_entry_icon', 'mod_entry_icon mod_entry_icon_disabled');
        }
        
        /* Mod Newly Updated */
        if ((dateNow - dateUpdate)/(1000*60*60*24) < MOD_IS_NEW_PERIOD_DAYS) {
            strHTML_new = "<span class='mod_entry_new'> ! " + jsGetLocaleText('NEW') + "</span>";
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_new');
        }
        
        /* Install Link */
        
        if (objInstalledMod != null) {
            if (objMod.version !== objInstalledMod.version) {
                strHTML_install_link = "<div class='mod_entry_link mod_entry_update_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('update') + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_update_available');
            } else {
                strHTML_install_link = "<div class='mod_entry_link mod_entry_reinstall_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('reinstall') + "</a> ]</div>";
                
                /* Update Classes */
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_installed');
            }
        } else {
            strHTML_install_link = "<div class='mod_entry_link mod_entry_install_link'>[ <a href='#' onClick='jsPreInstallMod(\"" + objMod.url + "\", \"" + id + "\", {})'>" + jsGetLocaleText('install') + "</a> ]</div>";
            
            /* Update Classes */
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_not_installed');
        }
        
        /* Install Count */
        strHTML_downloads = "<img src='assets/img/download.png' style='position: absolute; margin-top:4px'> <div class='mod_entry_count'>" + objMod.downloads + "</div>"; //TODO: Fix Up
        
        /* Like Count */            
        if (settings.modlikes() == true) {
            if (objMod.likes != null) {
                if (objMod.likes == -2) {
                    strHTML_likes = "<span id='" + id + "_like_count' class='mod_entry_likes'>" + jsGetLocaleText('Loading') + "...</span>" //TODO: Fix Up
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
            "<a href='#' id='filter_area_available_toggle' onClick='jsToggleModListOptions(\"available\")'>" + jsGetLocaleText('Hide_Additional_Options') + "</a>" + 
        "</div>" + 
        "<table>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Name_Filter') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_text_filter'>" +
                    "<input id='filter_area_available_text_filter' type='text' class='filter_area_textbox'>" + 
                "</td>" +
            "</tr>" + 
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Context_Filter') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_show'>" +
                    "<a href='#' id='filter_area_show_client' onClick='jsSetAvailableModsFilterContext(\"client\")'>" + jsGetLocaleText('CLIENT_MOD') + "</a> - " +
                    "<a href='#' id='filter_area_show_server' onClick='jsSetAvailableModsFilterContext(\"server\")'>" + jsGetLocaleText('SERVER_MOD') + "</a>" + 
                "</td>" +
            "</tr>" + 
        "</table>" +
        "<table class='filter_area_container'>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Show_Only') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_show'>" +
                    "<a href='#' id='filter_area_show_all' onClick='jsSetAvailableModsFilter(\"ALL\")'>" + jsGetLocaleText('ALL') + "</a> - " +
                    "<a href='#' id='filter_area_show_installed' onClick='jsSetAvailableModsFilter(\"INSTALLED\")'>" + jsGetLocaleText('INSTALLED') + "</a> - " + 
                    "<a href='#' id='filter_area_show_not_installed' onClick='jsSetAvailableModsFilter(\"NOT_INSTALLED\")'>" + jsGetLocaleText('NOT_INSTALLED') + "</a> - " + 
                    "<a href='#' id='filter_area_show_requires_update' onClick='jsSetAvailableModsFilter(\"REQUIRES_UPDATE\")'>" + jsGetLocaleText('NEEDS_UPDATE') + "</a> - " + 
                    "<a href='#' id='filter_area_show_newly_updated' onClick='jsSetAvailableModsFilter(\"NEWLY_UPDATED\")'>" + jsGetLocaleText('NEWLY_UPDATED') + "</a>" + 
                "</td>" + 
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Sort_By') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_sort'>" + 
                    "<a href='#' id='filter_area_sort_last_updated' onClick='jsSetAvailableModsSort(\"LAST_UPDATED\")'>" + jsGetLocaleText('LAST_UPDATED') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_title' onClick='jsSetAvailableModsSort(\"TITLE\")'>" + jsGetLocaleText('TITLE') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_author' onClick='jsSetAvailableModsSort(\"AUTHOR\")'>" + jsGetLocaleText('AUTHOR') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_build' onClick='jsSetAvailableModsSort(\"BUILD\")'>" + jsGetLocaleText('BUILD') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_downloads' onClick='jsSetAvailableModsSort(\"DOWNLOADS\")'>" + jsGetLocaleText('DOWNLOADS') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_likes' onClick='jsSetAvailableModsSort(\"LIKES\")'>" + jsGetLocaleText('LIKES') + "</a> - " + 
                    "<a href='#' id='filter_area_sort_last_random' onClick='jsSetAvailableModsSort(\"RANDOM\")'>" + jsGetLocaleText('RANDOM') + "</a>" + 
                "</td>" +
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Category') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_category'>" + strCategoryHTML + "</td>" +
            "</tr>" +
        "</table>" +
        "<div id='filters_on_available'>" + 
            "<img class='filter_area_img' src='assets/img/filter.png'>" +
            "<div class='filter_area_message'> " + jsGetLocaleText('One_or_more_filters_are_currently_applied') + " " +
                "<span class='filter_area_link'>[ <a href='#' onClick='document.getElementById(\"filter_area_available_text_filter\").value=\"\"; jsSetAvailableModsFilter(\"ALL\"); jsSetAvailableModsFilterCategory(\"ALL\")'>" + jsGetLocaleText('clear') + "</a> ]</span>" +
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
    
    jsUpdateOptionsToggle("available");
    jsApplyOnlineModFilter();
}

function jsGenerateInstalledModsListHTML(context) {
    jsAddLogMessage("Generating Installed Mods List", 3);
    
    var installedcontext = 'installed_' + context;
    
    var strCategoryHTML = "";
    var installedCategories = objInstalledModCategories[context];
    for (var category in installedCategories) {
        if(installedCategories.hasOwnProperty(category)){
            strCategoryHTML += "<div class='filter_area_category'><a href='#' id='filter_area_" + installedcontext + "_category_" + category + "' onClick='jsSetInstalledModsFilterCategory(\"" + context + "\", \"" + category + "\")'>" + category + "</a> (" + installedCategories[category] + ")</div>";
        }
    }
    
    $("#mod_list_" + installedcontext + "").html("<div class='filter_area'>" +
        "<div class='filter_area_additional_options_toggle'>" +
            "<a href='#' id='filter_area_" + installedcontext + "_toggle' onClick='jsToggleModListOptions(\"installed_" + context + "\", \""+installedcontext+"\")'>" + jsGetLocaleText('Hide_Additional_Options') + "</a>" + 
        "</div>" + 
        "<table>" +
            "<tr>" +
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Name_Filter') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_text_filter'>" + 
                    "<input id='filter_area_" + installedcontext + "_text_filter' type='text' class='filter_area_textbox'>" + 
                "</td>" +
            "</tr>" + 
        "</table>" +
        "<table class='filter_area_container'>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Category') + ":</td>" +
                "<td class='filter_area_filter_list filter_area_filter_list_category'>" + strCategoryHTML + "</td>" +
            "</tr>" +
            "<tr>" + 
                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Options') + ":</td>" +
                "<td>" + 
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_checked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(true, \"" + context + "\")'>" + jsGetLocaleText('Enable_All') + "</a></div>" +
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_unchecked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(false, \"" + context + "\")'>" + jsGetLocaleText('Disable_All') + "</a></div>" +
                "</td>" +
            "</tr>" +
        "</table>" +
        "<div id='filters_on_" + installedcontext + "'>" +
            "<img class='filter_area_img' src='assets/img/filter.png'>" +
            "<div class='filter_area_message'> " + jsGetLocaleText('One_or_more_filters_are_currently_applied') + " " +
                "<span class='filter_area_link'>[ <a href='#' onClick='document.getElementById(\"filter_area_" + installedcontext + "_text_filter\").value=\"\"; jsSetInstalledModsFilterCategory(\"" + context + "\", \"ALL\")'>" + jsGetLocaleText('clear') + "</a> ]</span>" +
            "</div>" +
        "</div>" +
    "</div>");
    
    $("#filter_area_" + installedcontext + "_text_filter").on("keyup", function() { jsApplyInstalledModFilter(context) });
    
    var strHTML = "";
    
    for(var i = 0; i < objInstalledMods[context].length; i++) {
        strHTML += jsGenerateModEntryHTML(objInstalledMods[context][i], true);
    }
    
    var nbupdates = jsGetModsRequiringUpdates(context);
    if (nbupdates > 0) {
        $("#mod_list_" + installedcontext + "").append("<div class='alert_area'>" + 
            "<img class='alert_img' src='assets/img/alert.png'>" + 
            "<div class='alert_message'>" + nbupdates + " " + jsGetLocaleText('mod_s__require_updates') + " " + 
                "<span class='alert_link'>[ <a href='#' onClick='jsUpdateAll(\"" + context + "\")'><span class='LOC_update_all'>" + jsGetLocaleText('update_all') + "</span></a> ]</span>" + 
            "</div>" + 
        "</div>");
        
        $("#ui_tab_" + installedcontext + "_needing_update").html("&nbsp;(<span class='ui_tab_" + installedcontext + "_needing_update_count'>" + nbupdates + "</span>)");
    } else {
        $("#ui_tab_" + installedcontext + "_needing_update").html("");
    }
    
    $("#mod_list_" + installedcontext + "").append(strHTML);
    
    jsUpdateOptionsToggle(installedcontext);
    jsApplyInstalledModFilter(context);
}

/* Mod Getter Functions */
function jsGetOnlineMod(strModID) {
    for (var i = 0; i < objOnlineMods.length; i++) {
        if (objOnlineMods[i].identifier == strModID) {
            return objOnlineMods[i];
        }
    }
    return null;
}

function jsGetInstalledMod(strModID) {
    for (var i = 0; i < objInstalledMods.union.length; i++) {
        if (objInstalledMods.union[i].identifier === strModID) {
            return objInstalledMods.union[i];
        }
    }
    return null;
}

/* HTML Function Calls */
function jsToggleModListOptions(listname) {
    settings["show_" + listname + "_filters"](!settings["show_" + listname + "_filters"]());
    jsUpdateOptionsToggle(listname)
}

function jsUpdateOptionsToggle(listname) {
    if (settings["show_" + listname + "_filters"]() == true) {
        $("#filter_area_" + listname + "_toggle").text(jsGetLocaleText('Hide_Additional_Options'));
        $("#mod_list_" + listname).find(".filter_area_container").show();
    } else {
        $("#filter_area_" + listname + "_toggle").text(jsGetLocaleText('Show_Additional_Options'));
        $("#mod_list_" + listname).find(".filter_area_container").hide();
    }
}

function jsSetLanguage() {
    jsAddLogMessage("Setting locale to " + settings.locale(), 3);
    $("#mod_list_available").html("");
    $("#mod_list_installed_client").html("");
    $("#mod_list_installed_server").html("");
    jsApplyLocaleText();
    jsGenerateInstalledModsListHTML("client");
    jsGenerateInstalledModsListHTML("server");
    jsGenerateOnlineModsListHTML();
}

function jsSetAvailableModsSort(strNewSort) {
    settings.sort(strNewSort);
    jsAddLogMessage("Available Mods sort by " + settings.sort() + " applied", 4);
    jsGenerateOnlineModsListHTML();
}

function jsSetAvailableModsFilterContext(strNewFilter) {
    settings.available_context(strNewFilter);
    jsAddLogMessage("Available Mods context filter " + strNewFilter + " applied", 4);
    jsApplyOnlineModFilter();
}

function jsSetAvailableModsFilter(strNewFilter) {
    settings.available_filter(strNewFilter);
    jsAddLogMessage("Available Mods filter " + strNewFilter + " applied", 4);
    jsApplyOnlineModFilter();
}

function jsSetInstalledModsFilterCategory(context, strNewCategory) {
    settings["installed_" + context + "_category"](strNewCategory);
    jsAddLogMessage("Installed Mods category filter " + strNewCategory + " applied", 4);
    jsApplyInstalledModFilter(context);
}

function jsSetAvailableModsFilterCategory(strNewCategory) {
    settings.available_category(strNewCategory);
    jsAddLogMessage("Available Mod category filter " + strNewCategory + " applied", 4);
    jsApplyOnlineModFilter();
}

function jsApplyOnlineModFilter() {
    var boolFiltersEnabled = true;
    
	if(!$('#filter_area_available_text_filter')[0])
		return;
    
    $('#mod_list_available').find('.mod_entry').removeClass('mod_entry_filtered');
    $('#mod_list_available .filter_area_filter_list_show a').removeClass('filter_area_filter_item_selected');
    
    $('#mod_list_available').find('.mod_entry').not('.mod_entry_context_' + settings.available_context()).addClass('mod_entry_filtered');
    $('#filter_area_show_'+settings.available_context()).addClass('filter_area_filter_item_selected');
    
    switch (settings.available_filter()) {
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
    
    if (settings.available_category() != "ALL") {
        $('#mod_list_available').find('.mod_entry').not('.mod_entry_category_' + settings.available_category()).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $('#mod_list_available .filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_available_category_' + settings.available_category()).addClass('filter_area_filter_item_selected');
    
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

function jsApplyInstalledModFilter(context) {
    var boolFiltersEnabled = false;
    var installedcontext = 'installed_' + context;
    
    $('#mod_list_' + installedcontext).find('.mod_entry').removeClass('mod_entry_filtered');
            
    if (settings[installedcontext + '_category']() != "ALL") {
        $('#mod_list_' + installedcontext).find('.mod_entry').not('.mod_entry_category_' + settings[installedcontext + '_category']()).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $('#mod_list_' + installedcontext + ' .filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_' + installedcontext + '_category_' + settings[installedcontext + '_category']()).addClass('filter_area_filter_item_selected');
    
    if ($('#filter_area_' + installedcontext + '_text_filter').val() != '') {
        var strSearch = $('#filter_area_' + installedcontext + '_text_filter').val().toLowerCase();
        $('#mod_list_' + installedcontext).find('.mod_entry').each(function() {
            if ($(this).find('.mod_entry_name').text().toLowerCase().indexOf(strSearch) < 0) {
                $(this).addClass('mod_entry_filtered');
            }
        });
        boolFiltersEnabled = true;
    }
    
    if (boolFiltersEnabled == true) {
        $('#filters_on_' + installedcontext).show();
    } else {
        $('#filters_on_' + installedcontext).hide();
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
    
    if(strPanelName === "installed_client")
        jsSetAvailableModsFilterContext("client")
    else if (strPanelName === "installed_server")
        jsSetAvailableModsFilterContext("server");
}

function jsPreInstallMod(strURL, strModID, objModsPreInstalled) {
    var requires = pamm.getRequires(strModID);
    if(requires.length) {
        if(!confirm("Install required dependency '" + requires.join("', '") + "'?")) {
            return;
        }
    }
    
    pamm.install(strModID, function(error) {
        if(error) {
            alert(error);
            return
        }
        
        if(!params.devmode) {
            jsDownload(MANAGE_URL + "?download=" + strModID);
        }
        jsRefresh(false, false);
    });
}

function jsPreUninstallMod(strModID) {
    var boolConfirm = confirm("Are you sure you want to uninstall '" + jsGetInstalledMod(strModID).display_name + "'?");
    
    if (boolConfirm == true) {
        pamm.uninstall(strModID, function() {
            jsRefresh(false, false);
        });
    }
}

function jsSetModsListView(listname, mode) {
    var $list = $("#mod_list_" + listname);
    if (mode === "detailed") {
        $list.find(".mod_entry").addClass("mod_entry_detailed");
        $list.find(".mod_entry").removeClass("mod_entry_summary");
    } else {
        $list.find(".mod_entry").removeClass("mod_entry_detailed");
        $list.find(".mod_entry").addClass("mod_entry_summary");
    }
}

function jsSetModsListIcon(listname, mode) {
    var $list = $("#mod_list_" + listname);
    if (mode) {
        $list.find(".mod_entry_icon").removeClass("mod_entry_icon_disabled");
    } else {
        $list.find(".mod_entry_icon").addClass("mod_entry_icon_disabled");
    }
}

/* Refresh & Update Functions */
function jsRefresh(boolShowLoading, boolDownloadData) {
    //TODO: Localisation
    if (boolShowLoading == true) {
        document.getElementById("mod_list_installed_client").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading') + "...</div>";
        document.getElementById("mod_list_installed_server").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading') + "...</div>";
        document.getElementById("mod_list_available").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Loading') + "...</div>";
        document.getElementById('total_available_mods').innerHTML = jsGetLocaleText('Loading') + "...";
        document.getElementById('total_available_mod_downloads').innerHTML = jsGetLocaleText('Loading') + "...";
    }
    jsRefresh_asynch(boolDownloadData);
}

function jsRefresh_asynch(boolDownloadData) {
    if (boolOnline == false) {
        document.getElementById("news_data").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline') + "</div>";    
        document.getElementById("mod_list_available").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline') + "</div>";
        document.getElementById('total_available_mods').innerHTML = jsGetLocaleText('Mod_Manager_is_offline');
        document.getElementById('total_available_mod_downloads').innerHTML = jsGetLocaleText('Mod_Manager_is_offline');
    }
    
    jsAddLogMessage("Refreshing Data", 2);
    
    objInstalledModCategories.client["ALL"] = 0;
    objInstalledModCategories.server["ALL"] = 0;
    
    findInstalledMods(function() {
        document.getElementById('total_installed_mods').innerHTML = objInstalledMods.client.length + objInstalledMods.server.length;
        objInstalledMods.client.sort(sort_by('display_name', true, null));
        objInstalledMods.server.sort(sort_by('display_name', true, null));
        
        if (boolOnline == true && boolDownloadData == true) {
            jsDownloadNews();
            jsDownloadOnlineMods();
        } else {
            jsGenerateInstalledModsListHTML("client");
            jsGenerateInstalledModsListHTML("server");
            if (boolOnline == true) {
                jsGenerateOnlineModsListHTML();
            }
        }
    }, boolDownloadData);
}

function jsGetModsRequiringUpdates(context) {
    var intModsRequiringUpdate = 0;
    
    var mods = objInstalledMods[context];
    for(var i = 0; i < mods.length; i++) {
        if (jsGetOnlineMod(mods[i]["identifier"]) != null && mods[i]["version"] !== jsGetOnlineMod(mods[i]["identifier"])["version"]) {
            intModsRequiringUpdate++;
        }
    }
    return intModsRequiringUpdate;
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
        
        pamm.getAvailableMods(function(mods) {
            objOnlineMods = mods;
            objOnlineModCategories = pamm.groupByCategories(mods);
            
            document.getElementById('total_available_mods').innerHTML = objOnlineMods.length;
            jsDownloadOnlineModDownloadCount();
        }, true);
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
                        var mod = objOnlineMods[i];
                        mod.downloads = objOnlineModsDownloadCount[mod.identifier] ? objOnlineModsDownloadCount[mod.identifier] : 0;
                        if(mod.id) {
                            // legacy modcount :)
                            mod.downloads += objOnlineModsDownloadCount[mod.id] ? objOnlineModsDownloadCount[mod.id] : 0;
                        }
                        
                        intTotalDownloadCount += mod.downloads;
                    }
                    
                    jsGenerateOnlineModsListHTML();
                    jsGenerateInstalledModsListHTML("client");
                    jsGenerateInstalledModsListHTML("server");
                    if (settings.modlikes()) {
                        jsDownloadOnlineModLikeCount();
                    }
                    
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
        (function() {
            var mod = objOnlineMods[i];
            if (mod.forum) {
                if (mod.forum.match(/https?:\/\/forums.uberent.com\/threads\/[^\/]*\d+/)) {
                    intLikeCountRemaining++;
                    jsDownload(mod.forum, {
                        success: function(html) {
                            try {
                                var istart = html.indexOf('<span class="LikeText">');
                                var iend = html.indexOf('</span>', istart);
                                var html = html.substring(istart, iend+7);
                                var objNodes = $(html);
                                var intLikes = objNodes.children(".username").length;
                                if  (objNodes.children(".OverlayTrigger").length > 0) {
                                    var strText = objNodes.children(".OverlayTrigger").text();
                                    intLikes += parseInt(strText);
                                }
                                mod.likes = intLikes;
                                jsAddLogMessage("Like count for mod '" + mod.display_name + "': " + intLikes, 3);
                            } catch (e) {
                                jsAddLogMessage("Error loading online mod like count data: " + e.message, 1);
                                mod.likes = -1;
                            }
                            intLikeCountRemaining--;
                        }
                        ,error: function() {
                            intLikeCountRemaining--;
                        }
                    });
                } else {
                    jsAddLogMessage("Invalid forum link for mod '" + mod.display_name + "': " + mod.forum, 3);
                    mod.likes = -1;
                }
            } else {
                jsAddLogMessage("Missing forum link for mod '" + mod.display_name + "'", 3);
                mod.likes = -1;
            }
        })();
    }
    
    var objTimer = setInterval(function() {
        if(intLikeCountRemaining == 0) {
            jsGenerateOnlineModsListHTML();
            clearInterval(objTimer);
        }
    }, 500);
}

function checkPAMMversion() {
    if (boolOnline == true) {
        jsAddLogMessage("Checking for PAMM updates", 2);
        var intCurrentMessageID = ++intMessageID;
        var packageurl = sprintf(PAMM_VERSION_DATA_URL, params.info);
        
        jsDownload(packageurl, {
            success: function(data) {
                try {
                    var lastinfo = JSON.parse(data);
                    if (semver.gt(lastinfo.version, params.info.version)) {
                        jsAddLogMessage("PAMM update: " + params.info.version + " => " + lastinfo.version, 2);
                        UpdatePAMM(lastinfo);
                    }
                    else {
                        jsAddLogMessage("PAMM update: NONE", 2);
                    }
                }
                catch(e) {
                    jsAddLogMessage("Error loading PAMM version data: " + e.message, 1);
                }
            }
        });
    }
}

function jsDownloadNews() {
    if (boolOnline == true) {
        jsAddLogMessage("Downloading news", 2);
        var $news = $("#news_data");
        $news.html("<div class=\"loading\">" + jsGetLocaleText('Loading') + "...</div>");
        $news.load(NEWS_URL, function( response, status, xhr ) {
            if ( status == "error" ) {
                var msg = "Sorry but there was an error: ";
                $news.html("<div class=\"loading\">" +msg + xhr.status + " " + xhr.statusText + "</div>");
            }
        });
    }
}

function checkVersionPA() {
    if(!pa.streams.stable)
        return;
    
    if (!boolOnline)
        return;
    
    jsAddLogMessage("Checking for PA updates", 2);
    jsDownload(PA_VERSION_URL, {
        success: function(build) {
            if(build !== pa.streams.stable.build) {
                jsAddLogMessage("PA update: " + pa.streams.stable.build + " => " + build, 2);
                setTimeout(function() { alert("PA update available: " + build + "\nUse the UberLauncher to update your installation."); }, 1);
            }
            else {
                jsAddLogMessage("PA update: NONE", 2);
            }
        }
    });
}

/**
** Old VBSCRIPT part
**/

function Initialise() {
}

function LaunchURL(strURL) {
    shell.openExternal(strURL);
}

function ClosePAMM() {
    var remote = require('remote');
    var app = remote.require('app');
    app.quit();
}

function RestartPAMM() {
    var child_process = require('child_process');
    var path = require('path');
    var argv = require('remote').process.argv;
    
    var child = child_process.spawn(argv[0], argv.splice(1), { detached: true, stdio: 'inherit' });
    child.unref();
    ClosePAMM();
}

function findInstalledMods(callback, force) {
    pamm.getInstalledMods("client", function(mods) {
        objInstalledMods.client = mods;
        objInstalledModCategories.client = pamm.groupByCategories(mods);
        
        jsAddLogMessage("Found " + mods.length + " installed client mods", 2);
        
        pamm.getInstalledMods("server", function(mods) {
            objInstalledMods.server = mods;
            objInstalledModCategories.server = pamm.groupByCategories(mods);
            
            jsAddLogMessage("Found " + mods.length + " installed server mods", 2);
            
            objInstalledMods.union = objInstalledMods.client.concat(objInstalledMods.server);
            
            callback();
        });
    }, force);
}

function initSettings() {
    var filepath = path.join(pa.cachepath, PAMM_OPTIONS_FILENAME);
    var tmpoptions = {
        debug: false,
        verbose: false,
        tab: "news",
        locale: "en",
        available_context: "client",
        available_category: "ALL",
        available_view: "detailed",
        available_icon: true,
        available_filter: "ALL",
        show_available_filters: false,
        sort: "LAST_UPDATED",
        modlikes: false,
        installed_client_category: "ALL",
        installed_client_view: "",
        installed_client_icon: false,
        show_installed_client_filters: false,
        installed_server_category: "ALL",
        installed_server_view: "",
        installed_server_icon: false,
        show_installed_server_filters: false,
        nolegacypamm: false
    };
    
    if(fs.existsSync(filepath)) {
        try {
            var content = fs.readFileSync(filepath, { encoding: 'utf8' });
            _.assign(tmpoptions, JSON.parse(content));
        }
        catch(e) {
            jsAddLogMessage("Failed to load options file: " + e, 1);
        }
    }
    else {
        jsAddLogMessage("Using default options", 2);
    }
    
    jsSetLogLevel(tmpoptions.debug ? 4 : 2);
    
    settings = ko.mapping.fromJS(tmpoptions);
    settings.autosave = ko.computed(function() {
        // trigger all observable values
        return ko.mapping.toJS(settings);
    });
    
    settings.debug.subscribe(function(newValue) {
        jsSetLogLevel(newValue ? 4 : 2);
    });
    settings.locale.subscribe(function(value) {
        jsSetLanguage();
    });
    settings.available_view.subscribe(function(newValue) {
        jsSetModsListView('available', newValue);
    });
    settings.available_icon.subscribe(function(newValue) {
        jsSetModsListIcon('available', newValue);
    });
    settings.installed_client_view.subscribe(function(newValue) {
        jsSetModsListView('installed_client', newValue);
    });
    settings.installed_client_icon.subscribe(function(newValue) {
        jsSetModsListIcon('installed_client', newValue);
    });
    settings.installed_server_view.subscribe(function(newValue) {
        jsSetModsListView('installed_server', newValue);
    });
    settings.installed_server_icon.subscribe(function(newValue) {
        jsSetModsListIcon('installed_server', newValue);
    });
    
    settings.autosave.subscribe(function(data) {
        try {
            jsAddLogMessage("Writing options file", 4);
            var strOptions = JSON.stringify(data, null, 4);
            fs.writeFileSync(filepath, strOptions);
        }
        catch(e) {
            jsAddLogMessage("Failed to write options file: " + e, 1);
        }
    });
}

function LaunchPA() {
    var child_process = require('child_process');
    var path = require('path');
    
    var binpath = pa.streams[pamm.getStream()].bin;
    var wd = path.dirname(binpath);
    var child = child_process.spawn(binpath, null, { cwd: wd, detached: true });
    child.unref();
    ClosePAMM();
}

function OpenModsFolder() {
    //var item = strModsDirectoryPath + '/mods.json';
    //shell.showItemInFolder(item.replace(/\//g,"\\"));
}

function UpdatePAMM(info) {
    var updateurl = sprintf(PAMM_UPDATE_URL, params.info);
    var zipfile = path.join(pa.cachepath, params.info.name + ".zip");
    
    jsDownload(updateurl, {
        tofile: zipfile
        ,success: function() {
            try {
                var temppath = path.dirname(__dirname) + '/app_tmp';
                var bkppath = path.dirname(__dirname) + '/app_backup';
                
                var zipdata = fs.readFileSync(zipfile);
                var zip = new JSZip(zipdata.toArrayBuffer());
                
                for(var i in zip.files) {
                    var file = zip.files[i];
                    
                    if(file.name.indexOf(info.name + '-stable/app/') !== 0)
                        continue;
                    
                    var path2 = temppath + '/' + file.name.substring(21);

                    if(path2.indexOf('/', path2.length - 1) !== -1) {
                        if (fs.existsSync(path2))
                            continue;
                        fs.mkdirSync(path2);
                    }
                    else {
                        fs.writeFileSync(path2, new Buffer(file.asUint8Array()));
                    }
                }
                
                if(fs.existsSync(bkppath)) {
                    rmdirRecurseSync(bkppath);
                }
                fs.renameSync(__dirname, bkppath);
                fs.renameSync(temppath, __dirname);
                
                alert('PAMM has been updated to ' + info.version + '\nIt should now restart automatically.');
                RestartPAMM();
            }
            catch(e) {
                jsAddLogMessage(e, 1);
                alert('PAMM failed to update itself to ' + info.version + ' (' + e + ')');
            }
        }
        ,error: function(e) {
            alert('PAMM failed to update itself to ' + info.version + ' (' + e + ')');
        }
    });
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

function checkLegacyPAMM() {
    if(process.platform !== 'win32')
        return;
    
    if(!UNINSTALL_LEGACY_PAMM || settings.nolegacypamm())
        return;
    
    var _uninstallLegacyPAMM = function(uninstallpath) {
        try {
            jsAddLogMessage("Uninstalling Legacy PAMM: " + uninstallpath, 2);
        
            alert("An older version of PAMM is still installed on your computer.\n\nWe are going to proceeds to its uninstallation !");
            
            var child_process = require('child_process');
            var child = child_process.spawn('cmd.exe', ['/C', uninstallpath], null, { detached: true });
            child.unref();
        }
        catch(error) {
            jsAddLogMessage("Unexpected error while uninstalling Legacy PAMM: " + error, 1);
        }
    }
    
    try {
        var Winreg = require('winreg');
        var regkey = new Winreg({
            hive: Winreg.HKLM,
            key: '\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PA Mod Manager'
        });
        
        regkey.get('UninstallString', function (err, item) {
            if (err) {
                regkey = new Winreg({
                    hive: Winreg.HKLM,
                    key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PA Mod Manager'
                });
                
                regkey.get('UninstallString', function (err, item) {
                    if (err) {
                        // Legacy PAMM not found
                        settings.nolegacypamm(true); 
                    }
                    else {
                        _uninstallLegacyPAMM(item.value);
                    }
                });
            }
            else {
                _uninstallLegacyPAMM(item.value);
            }
        });
    }
    catch(error) {
        jsAddLogMessage("Unexpected error while checking for Legacy PAMM: " + error, 1);
    }
};

$(function() {
    jsAddLogMessage("PAMM version: " + params.info.version, 2);
    checkPAMMversion();
    
    $('.ui_tabs').on('click', 'a', function() {
        var panel = $(this).data('target');
        jsDisplayPanel(panel);
    });
    
    $('#installed_client').on('click', 'div.mod_entry', function() {
        var modid = $(this).data('mod');
        jsModEnabledToggle(modid);
    });
    $('#installed_server').on('click', 'div.mod_entry', function() {
        var modid = $(this).data('mod');
        jsModEnabledToggle(modid);
    });
    
    if(pa.last) {
        $('#current_pa_build').text(pa.last.build);
        document.getElementById("btnLaunch").disabled = false;
    }
    else {
        document.getElementById("btnLaunch").disabled = true;
    }
    
    $("input[name='stream']").each(function(i, input) {
        var $input = $(input);
        var value = $input.val();
        if(!pa.streams[value]) {
            $input.prop('disabled', true);
        }
        else if ( pa.last.stream === value ) {
            $input.prop('checked', true);
        }
    });
    
    $("input[name='stream']").click(function() {
        pamm.setStream(this.value);
        jsRefresh(true, true);
    });
    
    initSettings();
    
    //document.getElementById("setting_installLocation").value = pa.last ? pa.last.bin : "";
    //document.getElementById("setting_modLocation").value = pa.modspath.client;
    
    var model = {
        settings: settings
        ,pa: pa
    };
    
    ko.applyBindings(model);
    
    checkLegacyPAMM();
    
    jsApplyLocaleText();
    jsDisplayPanel(settings.tab());
    
    $('#current_pamm_version').text(strPAMMversion);
    jsRefresh(true, true);
    
    checkVersionPA();
    
    if(params.install) {
        var intervalId = setInterval(function() {
            //check objOnlineMods exists and is populated
            if (objOnlineMods && objOnlineMods.length > 0) {
                //find mod url from mod id
                var modid = params.install;
                var mod = jsGetOnlineMod(modid);
                if (mod) {
                    jsPreInstallMod(mod.url, modid, {});
                    alert("Installing '" + mod.display_name + "'");
                } else {
                    jsAddLogMessage("Failed to install from commandline with mod id = " + mod_id_str, 1);
                }
                
                clearInterval(intervalId);
            }
        }, 1000);
    }
});

//})();