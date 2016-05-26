var semver = require('semver');
var sprintf = require('sprintf').sprintf;
var JSZip = require('jszip');
var shell = require('shell');
var _ = require('lodash');

//(function() {

var url = require('url');
var fs = require('fs');
var path = require('path');

var jsDownload = require('./assets/js/download.js').download;
var pa = require('./assets/js/pa.js');
var uberent = require('./assets/js/uberent.js');
var pamm = require('./assets/js/pamm-api.js');

var params = require('remote').getGlobal('params');
var devmode = params.devmode;
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
var filters = {}

var UNINSTALL_LEGACY_PAMM = 1;
var MOD_IS_NEW_PERIOD_DAYS = 7;
var NEWS_URL = "http://pamods.github.io/news.html";
var PAMM_VERSION_DATA_URL = "https://raw.githubusercontent.com/%(author)s/%(name)s/stable/app/package.json";
var PAMM_UPDATE_URL = "https://github.com/%(author)s/%(name)s/archive/stable.zip";
var PAMM_OPTIONS_FILENAME = "pamm.json";
var PA_VERSION_URL = "https://uberent.com/launcher/clientversion?titleid=4";
var MOD_GENERIC_ICON_URL = "assets/img/generic.png";

var communityModsHTML = '<div style="color: #0d0;margin: 10px 5px; font-size: 1.2em">Please uninstall all file system mods and use Community Mods in PA to reinstall your mods.<div>';
        
var strPAMMversion = params.info.version;

$.ajaxSetup({ cache: false });

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
function sortModBy(field, reverse, primer) {
    var key = primer ? function(x) {return primer(x[field])} : function(x) {return x[field]};
    reverse = [-1, 1][+!!reverse];

    return function (a, b) {
        var av = key(a), bv = key(b);
        var compare = reverse * ((av > bv) - (bv > av));
        if(compare !== 0)
            return compare;
        
        return a = a.display_name, b = b.display_name, ((a > b) - (b > a))
    } 
}

function jsSortOnlineMods() {
    switch (settings.sort()) {
        case "LAST_UPDATED":
            objOnlineMods.sort(sortModBy('date', false, function(x) { return new Date(x ? x : 0); } ));
            $("#filter_area_sort_last_updated").addClass('filter_area_filter_item_selected');
            break;
        case "TITLE":
            objOnlineMods.sort(sortModBy('display_name', true));
            $("#filter_area_sort_last_title").addClass('filter_area_filter_item_selected');
            break;
        case "AUTHOR":
            objOnlineMods.sort(sortModBy('author', true));
            $("#filter_area_sort_last_author").addClass('filter_area_filter_item_selected');
            break;
        case "BUILD":
            objOnlineMods.sort(sortModBy('build', false));
            $("#filter_area_sort_last_build").addClass('filter_area_filter_item_selected');
            break;
        case "LIKES":
            objOnlineMods.sort(sortModBy('likes', false));
            $("#filter_area_sort_last_likes").addClass('filter_area_filter_item_selected');
            break;
        case "DOWNLOADS":
            objOnlineMods.sort(sortModBy('downloads', false));
            $("#filter_area_sort_last_downloads").addClass('filter_area_filter_item_selected');
            break;
        case "POPULARITY":
            objOnlineMods.sort(sortModBy('popularity', false));
            $("#filter_area_sort_last_popularity").addClass('filter_area_filter_item_selected');
            break;
        case "RANDOM":
            objOnlineMods.sort(function () { return (Math.round(Math.random())-0.5); });
            $("#filter_area_sort_last_random").addClass('filter_area_filter_item_selected');
            break;
    }
}

/* Installed Mod Functions */
function jsUpdateAll(context) {
    var mods = objInstalledMods[context];
    for (var i = 0; i < mods.length; i++) {
        var identifier = mods[i].identifier;
        if (pamm.hasUpdate(identifier)) {
            jsPreInstallMod(identifier);
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
    var modOnline = _.find(objOnlineMods, function(mod) { return mod.identifier === id });
    var modInstalled = _.find(objInstalledMods.union, function(mod) { return mod.identifier === id });
    
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
    var strHTML_author = "<div class='mod_entry_link mod_entry_author'>" + jsGetLocaleText('by') + " ";
    var authors = objMod.author.replace(" and ",",").split(",");
    for(var i = 0; i < authors.length; ++i) {
        var author = authors[i].trim();
        if(i!==0)
            strHTML_author += ", ";
        strHTML_author += sprintf("<a href='https://forums.uberent.com/members/?username=%1$s'>%1$s</a>", author);
    }
    strHTML_author += "</div>";
    
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
            var dependency = jsGetInstalledMod(dependencyId);
            var installedDependency = dependency ? true : false;
            
            if (!installedDependency) {
                dependency = jsGetOnlineMod(dependencyId);
                strHTML_requires += "<span class='mod_requirement_missing'>" + (dependency ? dependency.display_name : dependencyId) + "</span>";
            } else {
                strHTML_requires += "<span class='mod_requirement'>" + dependency.display_name + "</span>";
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
        strHTML_forum_link = "<div class='mod_entry_link'>[ <a href='" + objMod.forum + "'>" + jsGetLocaleText('forum') + "</a> ]</div>";
    }
    
    /* Installed Mods List Only */
    var strHTML_checkbox = "";
    var strHTML_checkbox_image = "";
    var strHTML_uninstall_link = "";
    var strHTML_update_available = "";
    var strHTML_update_link = "";
    if (boolIsInstalled == true) {
        /* Update Classes */
        if (settings['installed_' + objMod.context + '_view']() == 'detailed') {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_detailed');
        } else {
            strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_summary');
        }
        
        if (settings['installed_' + objMod.context + '_icon']() == false) {
            strHTML_icon = strHTML_icon.replace('mod_entry_icon', 'mod_entry_icon mod_entry_icon_disabled');
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
    }
    
    /* enable/disable radio button */
    if(modInstalled) {
        
        if (!pamm.isCommunityMods()) {
            /* Enabled Checkbox, Image */
            if (modInstalled.enabled == true) {
                strHTML_checkbox = "<input type='checkbox' class='mod_entry_enabled' id='mod" + id + "' checked='checked'>";
                strHTML_checkbox_image = "<div class='mod_entry_enabled_image'><img id='modimg" + id + "' src='assets/img/checkbox_checked.png' /></div>";
            } else {
                strHTML_checkbox = "<input type='checkbox' class='mod_entry_enabled' id='mod" + id + "'>";
                strHTML_checkbox_image = "<div class='mod_entry_enabled_image'><img id='modimg" + id + "' src='assets/img/checkbox_unchecked.png' /></div>";
            }
        }
    }
    
    /* metrics */
    if(modOnline) {
        /* Install Count */
        if(modOnline.downloads) {
            strHTML_downloads = "<img src='assets/img/download.png' style='position: absolute; margin-top:4px'> <div class='mod_entry_count'>" + modOnline.downloads + "</div>"; //TODO: Fix Up
        }
        
        /* Like Count */            
        if (settings.modlikes() == true) {
            if (modOnline.likes != null) {
                if (modOnline.likes == -2) {
                    strHTML_likes = "<span id='" + id + "_like_count' class='mod_entry_likes'>" + jsGetLocaleText('Loading') + "</span>" //TODO: Fix Up
                }
                if (modOnline.likes >= 0) {
                    strHTML_likes = "<img src='assets/img/like.png' height='15' width='15' style='position: absolute; margin-top:4px; margin-left: 8px;'> <div class='mod_entry_likes'>" + modOnline.likes + "</div>"; //TODO: Fix Up
                }
            }
        }
    }
    
    /* install/update/uninstall links */
    if(!modInstalled) {
        strHTML_install_link = "<div class='mod_entry_link mod_entry_install_link'>[ <a href='#' data-action='install'>" + jsGetLocaleText('install') + "</a> ]</div>";
        
        // filter classe
        strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_not_installed');
    }
    else {
        if(!modInstalled.stockmod) {
            if (pamm.hasUpdate(id)) {
                strHTML_update_link = "<div class='mod_entry_link mod_entry_update_link'>[ <a href='#' data-action='install'>" + jsGetLocaleText('update') + "</a> ]</div>";
                
                // filter classe
                strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_update_available');
            }
            
            /* Uninstall Link */
            strHTML_uninstall_link = "<div class='mod_entry_link mod_entry_uninstall_link'>[ <a href='#' data-action='uninstall'>" + jsGetLocaleText('uninstall') + "</a> ]</div>";
        }
        
        // filter classe
        strHTML_classes = strHTML_classes.replace('mod_entry', 'mod_entry mod_entry_filter_installed');
    }
    
    var strHTML = "<div class='" + strHTML_classes + "' data-mod='" + id + "'>" + strHTML_icon + "<div class='mod_entry_container'>" + strHTML_checkbox + strHTML_checkbox_image + "<div>" + strHTML_display_name + strHTML_author + "</div>" + "<div class='mod_entry_details'>" + strHTML_version + strHTML_build + strHTML_date + strHTML_update_available + strHTML_new + "</div>" + strHTML_requires + strHTML_description + strHTML_category + strHTML_forum_link + strHTML_update_link + strHTML_install_link + strHTML_uninstall_link + strHTML_downloads + strHTML_likes + "</div>";
    
    if (!boolIsInstalled) {
        strHTML += "<div id='" + id + "_dlprogress' class='dlprogress'></div>";
    }
    
    strHTML += "</div>";
    
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

    $("#available div.filter_area").html("" +
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
                    "<a href='#' id='filter_area_sort_last_popularity' onClick='jsSetAvailableModsSort(\"POPULARITY\")'>" + jsGetLocaleText('POPULARITY') + "</a> - " + 
                    (settings.modlikes() ? "<a href='#' id='filter_area_sort_last_likes' onClick='jsSetAvailableModsSort(\"LIKES\")'>" + jsGetLocaleText('LIKES') + "</a> - " : "") + 
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
                "<span class='filter_area_link'>[ <a href='#'>" + jsGetLocaleText('clear') + "</a> ]</span>" +
            "</div>" +
        "</div>" + ( pamm.isCommunityMods() ? communityModsHTML : '' ) +
    "");
    
    $('#filter_area_available_text_filter').val(filters['available']);
    $('#filter_area_available_text_filter').on("keyup", jsApplyOnlineModFilter);
    
    $('#filters_on_available a').on('click', function(event) {
        filters['available'] = '';
        $('#filter_area_available_text_filter').val(filters['available']);
        jsSetAvailableModsFilter("ALL");
        jsSetAvailableModsFilterCategory("ALL");
    });
    
    jsSortOnlineMods();
    
    var strHTML = "";
    
    for(var i = 0; i < objOnlineMods.length; i++) {
        strHTML += jsGenerateModEntryHTML(objOnlineMods[i], false);
    }
    
    $("#mod_list_available").html(strHTML);
    
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
    
    $("#" + installedcontext + " div.filter_area").html("" +
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
            "<tr>" + ( !pamm.isCommunityMods() ?

                "<td class='filter_area_filter_heading'>" + jsGetLocaleText('Options') + ":</td>" +
                "<td>" + 
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_checked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(true, \"" + context + "\")'>" + jsGetLocaleText('Enable_All') + "</a></div>" +
                    "<div class='filter_area_option_img'><img src='assets/img/checkbox_unchecked.png' /></div>" +
                    "<div class='filter_area_option_text'>&nbsp;<a href='#' onClick='jsSetAllModStatus(false, \"" + context + "\")'>" + jsGetLocaleText('Disable_All') + "</a></div>" +
                "</td>" +
            "</tr>" : '' ) +
        "</table>" +
        "<div id='filters_on_" + installedcontext + "'>" +
            "<img class='filter_area_img' src='assets/img/filter.png'>" +
            "<div class='filter_area_message'> " + jsGetLocaleText('One_or_more_filters_are_currently_applied') + " " +
                "<span class='filter_area_link'>[ <a href='#'>" + jsGetLocaleText('clear') + "</a> ]</span>" +
            "</div>" +
        "</div>" + ( pamm.isCommunityMods() ? communityModsHTML : '' ) +
    "");
    
    $("#filter_area_" + installedcontext + "_text_filter").val(filters[installedcontext]);
    $("#filter_area_" + installedcontext + "_text_filter").on("keyup", function() { jsApplyInstalledModFilter(context) });
    
    $("#filters_on_" + installedcontext + " a").on('click', function(event) {
        filters[installedcontext] = '';
        $("#filter_area_" + installedcontext + "_text_filter").val(filters[installedcontext]);
        jsSetInstalledModsFilterCategory(context, "ALL");
    });
    
    var strHTML = "";
    
    for(var i = 0; i < objInstalledMods[context].length; i++) {
        strHTML += jsGenerateModEntryHTML(objInstalledMods[context][i], true);
    }
    
    var nbupdates = jsGetModsRequiringUpdates(context);
    if (nbupdates > 0) {
        strHTML = "<div class='alert_area'>" + 
            "<img class='alert_img' src='assets/img/alert.png'>" + 
            "<div class='alert_message'>" + nbupdates + " " + jsGetLocaleText('mod_s__require_updates') + " " + 
                "<span class='alert_link'>[ <a href='#' onClick='jsUpdateAll(\"" + context + "\")'><span class='LOC_update_all'>" + jsGetLocaleText('update_all') + "</span></a> ]</span>" + 
            "</div>" + 
        "</div>" + strHTML;
        
        $("#ui_tab_" + installedcontext + "_needing_update").html("&nbsp;(<span class='ui_tab_" + installedcontext + "_needing_update_count'>" + nbupdates + "</span>)");
    } else {
        $("#ui_tab_" + installedcontext + "_needing_update").html("");
    }
    
    $("#mod_list_" + installedcontext).html(strHTML);
    
    jsUpdateOptionsToggle(installedcontext);
    jsApplyInstalledModFilter(context);
}

function jsUpdateModListPadding(listname) {
    var $modlist = $('#'+listname);
    
    var $filterarea = $modlist.children('div.filter_area');
    if($filterarea.length == 0)
        return;
    var height = $filterarea.outerHeight() + 'px';
    
    var $content = $modlist.children('div.tab_content');
    $content.css("padding-top", height);
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
        $("#" + listname).find(".filter_area_container").show();
    } else {
        $("#filter_area_" + listname + "_toggle").text(jsGetLocaleText('Show_Additional_Options'));
        $("#" + listname).find(".filter_area_container").hide();
    }
    jsUpdateModListPadding(listname);
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
    
    var $modlist = $('#mod_list_available');
    var $filterarea = $('#available > div.filter_area');
    
    $modlist.find('.mod_entry').removeClass('mod_entry_filtered');
    $filterarea.find('.filter_area_filter_list_show a').removeClass('filter_area_filter_item_selected');
    
    $modlist.find('.mod_entry').not('.mod_entry_context_' + settings.available_context()).addClass('mod_entry_filtered');
    $('#filter_area_show_'+settings.available_context()).addClass('filter_area_filter_item_selected');
    
    switch (settings.available_filter()) {
        case "ALL":
            $('#filter_area_show_all').addClass('filter_area_filter_item_selected');
            boolFiltersEnabled = false;
            break;
        case "INSTALLED":
            $modlist.find('.mod_entry').not('.mod_entry_filter_installed').addClass('mod_entry_filtered');
            $('#filter_area_show_installed').addClass('filter_area_filter_item_selected');
            break;
        case "REQUIRES_UPDATE":
            $modlist.find('.mod_entry').not('.mod_entry_filter_update_available').addClass('mod_entry_filtered');
            $('#filter_area_show_requires_update').addClass('filter_area_filter_item_selected');
            break;
        case "NEWLY_UPDATED":
            $modlist.find('.mod_entry').not('.mod_entry_filter_new').addClass('mod_entry_filtered');
            $('#filter_area_show_newly_updated').addClass('filter_area_filter_item_selected');
            break;
        case "NOT_INSTALLED":
            $modlist.find('.mod_entry').not('.mod_entry_filter_not_installed').addClass('mod_entry_filtered');
            $('#filter_area_show_not_installed').addClass('filter_area_filter_item_selected');
            break;
    }
    
    if (settings.available_category() != "ALL") {
       $modlist.find('.mod_entry').not('.mod_entry_category_' + settings.available_category()).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $filterarea.find('.filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_available_category_' + settings.available_category()).addClass('filter_area_filter_item_selected');
    
    filters['available'] = $('#filter_area_available_text_filter').val();
    if (filters['available']) {
        var strSearch = filters['available'].toLowerCase();
        $('#mod_list_available').find('.mod_entry').each(function() {
            var $modentry = $(this);
            if(!searchTermInMod($modentry, strSearch)) {
                $modentry.addClass('mod_entry_filtered');
            }
        });
        boolFiltersEnabled = true;
    }
    
    if (boolFiltersEnabled == true) {
        $('#filters_on_available').show();
    } else {
        $('#filters_on_available').hide();
    }
    
    jsUpdateModListPadding('available');
}

function jsApplyInstalledModFilter(context) {
    var boolFiltersEnabled = false;
    var installedcontext = 'installed_' + context;
    
    var $modlist = $('#mod_list_' + installedcontext);
    var $filterarea = $('#' + installedcontext + ' > div.filter_area');
    
    $modlist.find('.mod_entry').removeClass('mod_entry_filtered');
            
    if (settings[installedcontext + '_category']() != "ALL") {
        $modlist.find('.mod_entry').not('.mod_entry_category_' + settings[installedcontext + '_category']()).addClass('mod_entry_filtered');
        boolFiltersEnabled = true;
    }
    $filterarea.find('.filter_area_filter_list_category a').removeClass('filter_area_filter_item_selected');
    $('#filter_area_' + installedcontext + '_category_' + settings[installedcontext + '_category']()).addClass('filter_area_filter_item_selected');
    
    filters[installedcontext] = $('#filter_area_' + installedcontext + '_text_filter').val();
    if (filters[installedcontext]) {
        var strSearch = filters[installedcontext].toLowerCase();
        $modlist.find('.mod_entry').each(function() {
            var $modentry = $(this);
            if(!searchTermInMod($modentry, strSearch)) {
                $modentry.addClass('mod_entry_filtered');
            }
        });
        boolFiltersEnabled = true;
    }
    
    if (boolFiltersEnabled == true) {
        $('#filters_on_' + installedcontext).show();
    } else {
        $('#filters_on_' + installedcontext).hide();
    }
    
    jsUpdateModListPadding(installedcontext);
}

function searchTermInMod($modentry, search) {
    if ($modentry.find('.mod_entry_name').text().toLowerCase().indexOf(search) !== -1)
        return true;
    if ($modentry.find('.mod_entry_description').text().toLowerCase().indexOf(search) !== -1)
        return true;
    if ($modentry.find('.mod_entry_author').text().toLowerCase().indexOf(search) !== -1)
        return true;
    return false;
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
    
    jsUpdateModListPadding(strPanelName);
}

function jsPreInstallMod(strModID) {
    try {
        var requires = pamm.getRequiredToInstall(strModID);
        if(requires.length) {
            var displaynames = [];
            for(var i = 0; i < requires.length; ++i) {
                var dependencyId = requires[i];
                
                if(jsGetInstalledMod(dependencyId))
                    continue;
                
                var dependency = jsGetOnlineMod(dependencyId);
                displaynames.push(dependency ? dependency.display_name : dependencyId);
            }
            
            if(displaynames.length > 0 && !confirm("Install required dependency '" + displaynames.join("', '") + "'?")) {
                return;
            }
        }
    }
    catch(error) {
        jsAddLogMessage("An error occurred while gathering mod requirements: " + error, 1);
        alert(error);
        return;
    }
    
    pamm.install(strModID, function(error) {
        if(error) {
            alert(error);
            return;
        }
        jsRefresh(false, false);
    }
    ,function(identifier, state) {
        if(state.lengthComputable) {
            var divId = identifier.replace(/\./g, '\\.') + "_dlprogress";
            var percent = ( state.loaded * 100 ) / state.total;
            
            var $div = $('#'+divId);
            $div.width(percent+'%');
            $div.show();
        }
    }
    );
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
    jsAddLogMessage("Refreshing Data", 2);
    
    objInstalledModCategories.client["ALL"] = 0;
    objInstalledModCategories.server["ALL"] = 0;
    
    if(boolDownloadData) {
        checkPAMMversion();
        jsDownloadNews();
    }
    
    var prmInstalledMods = getInstalledMods(boolDownloadData);
    var prmAvailableMods = getAvailableMods(boolDownloadData);
    var prmRefreshMods = $.when(prmInstalledMods, prmAvailableMods);
    
    prmRefreshMods.always(function() {
        prmInstalledMods.done(function() {
            jsGenerateInstalledModsListHTML("client");
            jsGenerateInstalledModsListHTML("server");
        });
        
        prmAvailableMods.done(function() {
            jsGenerateOnlineModsListHTML();
        });
    });
}

function jsGetModsRequiringUpdates(context) {
    var intModsRequiringUpdate = 0;
    
    var mods = objInstalledMods[context];
    for(var i = 0; i < mods.length; i++) {
        var identifier = mods[i].identifier;
        if (pamm.hasUpdate(identifier)) {
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

function getInstalledMods(force) {
    var prmClientMods = pamm.getInstalledMods("client", force);
    var prmServerMods = pamm.getInstalledMods("server", force);
    
    var fillModsArray = function(context, mods) {
        mods.sort(sortModBy('display_name', true, null));
        objInstalledMods[context] = mods;
        objInstalledModCategories[context] = pamm.groupByCategories(mods);
    };
    
    prmClientMods.done(function(mods) {
        fillModsArray("client", mods);
        jsAddLogMessage("Found " + mods.length + " installed client mods", 2);
    })
    .fail(function(error) {
        fillModsArray("client", []);
        $("#mod_list_installed_client").html("<div class=\"loading\">" + error + "...</div>");
    });
    
    prmServerMods.done(function(mods) {
        fillModsArray("server", mods);
        jsAddLogMessage("Found " + mods.length + " installed server mods", 2);
    })
    .fail(function(error) {
        fillModsArray("server", []);
        $("#mod_list_installed_server").html("<div class=\"loading\">" + error + "...</div>");
    });
    
    return $.when(prmClientMods, prmServerMods).always(function() {
        objInstalledMods.union = objInstalledMods.client.concat(objInstalledMods.server);
        $('#total_installed_mods').text(objInstalledMods.client.length + objInstalledMods.server.length);
    });
}

function getAvailableMods(force) {
    if (!boolOnline) {
        jsAddLogMessage("Available mods list download disabled - offline mode", 2);
        $('#mod_list_available').html("<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline') + "</div>");
        $('#total_available_mods').html(jsGetLocaleText('Mod_Manager_is_offline'));
        $('#total_available_mod_downloads').html(jsGetLocaleText('Mod_Manager_is_offline'));
        return $.Deferred().resolve().reject();
    }
    
    if(force) jsAddLogMessage("Downloading available mods list", 2);
    
    var intTotalDownloadCount = 0;
    var prmAvailableMods = pamm.getAvailableMods(force);
    
    prmAvailableMods.done(function(mods) {
        objOnlineMods = mods;
        objOnlineModCategories = pamm.groupByCategories(mods);
        
        for(var idx in objOnlineMods) {
            var mod = objOnlineMods[idx];
            intTotalDownloadCount += mod.downloads;
        }
        
        jsGenerateOnlineModsListHTML();
    })
    .fail(function(error) {
        objOnlineMods = [];
        objOnlineModCategories = {};
        jsAddLogMessage(error, 1);
        $("#mod_list_available").html("<div class=\"loading\">" + error + "...</div>");
    })
    .always(function() {
        $('#total_available_mods').text(objOnlineMods.length);
        $('#total_available_mod_downloads').text(intTotalDownloadCount);
    });
    
    return prmAvailableMods;
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

var latestCheck = 0;
function checkPAMMversion() {
    if (boolOnline == true) {
        var now = Date.now();
        if( (now - latestCheck) < 300000 ) // one check per 5mn max
            return;
        latestCheck = now;
        
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
    var $news = $("#news_data");
    
    if(!boolOnline) {
        jsAddLogMessage("News download disabled - offline mode", 2);
        document.getElementById("news_data").innerHTML = "<div class=\"loading\">" + jsGetLocaleText('Mod_Manager_is_offline') + "</div>";    
        return;
    }
    
    jsAddLogMessage("Downloading news...", 2);
    
    jsDownload(NEWS_URL).done(function(data) {
        // cleanup hardcode js events
        var regex = new RegExp("on[\\w]+=", "g");
        data = data.replace(regex, " cleansed=");
        
        // convert to html without script execution
        var newshtml = $.parseHTML(data);
        
        // display should be safe now
        $news.html(newshtml);
    })
    .fail(function(jqXHR, textStatus, errorThrown ) {
        var msg = "Failed to load news data: ";
        if(!errorThrown) {
            errorThrown = "network issue";
        }
        $news.html("<div class=\"loading\">" + msg + errorThrown + "</div>");
    });
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
    if(strURL.indexOf("http://") == 0 || strURL.indexOf("https://") == 0) {
        shell.openExternal(strURL);
    }
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
        show_installed_server_filters: false
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
    
    settings.resize = ko.observable((localStorage.pamm_resize === "disabled" ? false : true));
    
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
    settings.resize.subscribe(function(newValue) {
        localStorage.pamm_resize = (newValue ? "enabled" : "disabled");
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

function LaunchPA(nomods) {
    var stream = pa.streams[pamm.getStream()];
    if(stream.stream === 'steam') {
        shell.openExternal('steam://rungameid/' + stream.steamId);
    }
    else {
        var child_process = require('child_process');
        var path = require('path');
        
        var binpath = stream.bin;
        var wd = path.dirname(binpath);
        
        var args = [];
        if(uberent.getSessionTicket()) {
            args = ['--ticket', uberent.getSessionTicket()];
        }
        
        if(nomods)
            args.push('--nomods');
        
        var child = child_process.spawn(binpath, args, { cwd: wd, detached: true });
        child.unref();
    }
    ClosePAMM();
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
                var zip = new JSZip(zipdata);
                
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

function rmdirRecurseSync(path) {
    if (!fs.existsSync(path)) {
        return;
    }
    var stat = fs.lstatSync(path);

    if(stat.isDirectory()) {
        // recurse
        var list = fs.readdirSync(path);
        for(var i = 0; i < list.length; ++i) {
            var newpath = path + "/" + list[i];
            rmdirRecurseSync(newpath);
        }
        // rm dir
        fs.rmdirSync(path);
    } else {
        // rm file / symlink
        fs.unlinkSync(path);
    }
};

$(function() {
    jsAddLogMessage("PAMM version: " + params.info.version, 2);
    checkPAMMversion();
});

$.when(pamm.ready, $.ready).done(function() {
    $('.ui_tabs').on('click', 'a', function() {
        var panel = $(this).data('target');
        jsDisplayPanel(panel);
    });
    
    var evtToggleModEnabled = function(event) {
        if (event.target.nodeName === 'A') return;
        var modid = $(this).data('mod');
        jsModEnabledToggle(modid);
    };
    $('#installed_client').on('click', 'div.mod_entry.mod_entry_filter_installed', evtToggleModEnabled);
    $('#installed_server').on('click', 'div.mod_entry.mod_entry_filter_installed', evtToggleModEnabled);
    $('#available').on('click', 'div.mod_entry.mod_entry_filter_installed', evtToggleModEnabled);
    
    $('body').on('click', 'div.mod_entry_link a', function(event) {
        event.preventDefault();
        var $this = $(this);
        var $modentry = $this.parents('div.mod_entry');
        var action = $this.data('action');
        var modid = $modentry.data('mod');
        
        if(action === 'install') {
            jsPreInstallMod(modid);
        }
        else if(action === 'uninstall') {
            jsPreUninstallMod(modid);
        }
        else {
            var href = $this.attr('href');
            LaunchURL(href);
        }
    });
    
    $('#news_data').on('click', 'a', function(event) {
        event.preventDefault();
        var $this = $(this);
        var identifier = $this.data('identifier');
        
        if(identifier) {
            jsPreInstallMod(identifier);
        }
        else {
            var href = $this.attr('href');
            LaunchURL(href);
        }
    });
    
    if(pa.last) {
        $('#current_pa_build').text(pa.last.build);
    }
    
    var nbstreams = _.size(pa.streams);
    if (nbstreams === 0) {
        $('#context > span').html('none');
    }
    else if (nbstreams === 1) {
        $('#context > span').html(pa.last.streamLabel + ' (' + pa.last.build + ')');
    }
    else {
        var _generateStreamInput = function(stream) {
            var stream = pa.streams[stream];
            return '<input type="radio" name="stream"'
                + (pa.last.stream === stream.stream ? ' checked="checked"' : '')
                + ' value="' + stream.stream + '">'
                + '<span>' + stream.streamLabel + ' (' + stream.build + ')</span>'
        }
        
        var streamsHtml = '';

        _.forEach(pa.streams, function(streamInfo, stream) {
            streamsHtml = streamsHtml + _generateStreamInput(stream);
        });

        $('#context > span').html(streamsHtml);
        
        $('#context').on('click', 'input[name="stream"]', function() {
            pamm.setStream(this.value);
            jsRefresh(true, true);
        });
    }
    
    // manage buttons
    $('footer > .buttons').on('click', 'button', function() {
        var action = $(this).data('action');
        if(action === 'launchpa') {
            LaunchPA();
        }
        else if(action === 'launchpa_nomods') {
            LaunchPA(true);
        }
        else if(action === 'refresh') {
            jsRefresh(true, true);
        }
        else if(action === 'exit') {
            ClosePAMM();
        }
    });
    
    if(!pa.last) {
        $("#bt_launchpa").hide();
        $("#bt_launchpa_nomods").hide();
    }
    else if(pa.last.stream === "steam") {
        $("#bt_launchpa_nomods").hide();
    }
    
    $('button.openfolder').on('click', function() {
        var context = $(this).data('context');
        var modspath = pa.modspath[context];
        shell.openItem(modspath);
    });
    
    initSettings();
    
    var model = {
        settings: settings
        ,pa: pa
    };
    
    ko.applyBindings(model);
    
    jsApplyLocaleText();
    jsDisplayPanel(settings.tab());
    
    $('#current_pamm_version').text(strPAMMversion);
    jsRefresh(true, true);
    
    checkVersionPA();
    
    // manage UberNet login if PA found and not Steam distrib
    if(pa.last && pa.last.stream !== 'steam') {
        var _afterLogin = function(userinfo) {
            $('#ubername').text( userinfo.DisplayName );
            $('#login').hide();
            $('#logged').show();
        }
        
        // login using previous session ticket
        uberent.login().done(_afterLogin);
        
        var btLogin = function() {
            uberent.login($('#name').val(), $('#password').val())
            .done(_afterLogin)
            .done(function() {
                dlgLogin.dialog( "close" );
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                var $info = $('#dialog-login p.ui-state-highlight');
                $info.text('Login or password incorrect.');
                $info.addClass('ui-state-error');
                console.log(errorThrown);
            });
            $('#password').val('');
            localStorage.lastUberName = $('#name').val();
        };
        
        if(localStorage.lastUberName) {
            $('#name').val(localStorage.lastUberName);
        }
        
        var dlgLogin = $( "#dialog-login" ).dialog({
            autoOpen: false,
            height: 300,
            width: 350,
            modal: true,
            buttons: {
                "Login": btLogin,
                "Cancel": function() {
                    dlgLogin.dialog( "close" );
                }
            },
            close: function() {
            }
        });
        
        $("#dialog-login").on("keyup", "input", function(e) {
            if (e.which == 13) {
                btLogin();
            }
        });
        
        $("#userinfo").on("click", "a", function() {
            var action = $(this).data('action');
            if(action === 'login') {
                var $info = $('#dialog-login p.ui-state-highlight');
                $info.text('Enter your UberNet credentials.');
                $info.removeClass('ui-state-error');
                dlgLogin.dialog( "open" );
            }
            else {
                uberent.logout();
                $('#logged').hide();
                $('#login').show();
            }
        });
        
        $("#userinfo").show();
    }
    
    if(params.install) {
        var intervalId = setInterval(function() {
            //check objOnlineMods exists and is populated
            if (objOnlineMods && objOnlineMods.length > 0) {
                //find mod url from mod id
                var modid = params.install;
                var mod = jsGetOnlineMod(modid);
                if (mod) {
                    jsPreInstallMod(modid);
                    alert("Installing '" + mod.display_name + "'");
                } else {
                    jsAddLogMessage("Failed to install from commandline with mod id = " + modid, 1);
                }
                
                clearInterval(intervalId);
            }
        }, 1000);
    }
});

pamm.ready.fail(function(err) {
    $('body *').hide();
    var message = err.message ? err.message : err;
    alert(message);
});

//})();
