var strLocales = [
	"en", 
	"fr",
	"nl",
	"de"];
	
var strlocaleText = {
	"MOD_MANAGER": {
		"en": "MOD MANAGER",
		"fr": "GESTIONNAIRE DE MODS",
		"nl": "MOD BEHEERDER",
		"de": "MOD MANAGER"
	},
	"NEWS": {
		"en": "NEWS",
		"fr": "NOUVELLES",
		"nl": "NIEUWS",
		"de": "NACHRICHTEN"
	},
	"INSTALLED_MODS": {
		"en": "INSTALLED MODS",
		"fr": "MODS INSTALLÉS",
		"nl": "GEÏNSTALLEERDE MODS",
		"de": "INSTALLIERTE MODS"
	},
	"AVAILABLE_MODS": {
		"en": "AVAILABLE MODS",
		"fr": "MODS DISPONIBLE",
		"nl": "BESCHIKBARE MODS",
		"de": "VERFÜGBARE MODS"
	},
	"Launch_PA": {
		"en": "Launch PA",
		"fr": "Lancez PA",
		"nl": "Start PA",
		"de": "PA starten"
	},
	"Launch_PA_NOMODS": {
		"en": "Safe Mode",
		"fr": "Safe Mode",
		"nl": "Safe Mode",
		"de": "Safe Mode"
	},
	"Refresh": {
		"en": "Refresh",
		"fr": "Actualiser",
		"nl": "Vernieuwen",
		"de": "Aktualisieren"
	},
	"Exit": {
		"en": "Exit",
		"fr": "Quitter",
		"nl": "Afsluiten",
		"de": "Beenden"
	},
	"Version": {
		"en": "Version",
		"fr": "Version",
		"nl": "Versie",
		"de": "Version"
	},
	"by": {
		"en": "by",
		"fr": "par",
		"nl": "door",
		"de": "von"
	},
	"build": {
		"en": "build",
		"fr": "build",
		"nl": "build",
		"de": "Build"
	},
	"forum": {
		"en": "forum",
		"fr": "forum",
		"nl": "forum",
		"de": "Forum"
	},
	"uninstall": {
		"en": "uninstall",
		"fr": "déinstaller",
		"nl": "deïnstalleren",
		"de": "deinstallieren"
	},
	"REQUIRES": {
		"en": "REQUIRES",
		"fr": "A BESOIN DE",
		"nl": "HEEFT NODIG",
		"de": "BENÖTIGT"
	},
	"UPDATE_AVAILABLE": {
		"en": "UPDATE AVAILABLE",
		"fr": "MISE À JOUR DISPONIBLE",
		"nl": "UPDATE BESCHIKBAAR",
		"de": "UPDATE VERFÜGBAR"
	},
	"install": {
		"en": "install",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"update": {
		"en": "update",
		"fr": "mis à jour",
		"nl": "update",
		"de": "Update"
	},
	"reinstall": {
		"en": "reinstall",
		"fr": "réinstaller",
		"nl": "herinstalleren",
		"de": "erneut installieren"
	},
	"NEW": {
		"en": "NEW",
		"fr": "NOUVEAU",
		"nl": "NIEUW",
		"de": "NEU"
	},
	"SHOW": {
		"en": "SHOW",
		"fr": "MONTRER",
		"nl": "TONEN",
		"de": "ZEIGEN"
	},
	"SORT": {
		"en": "SORT",
		"fr": "ARRANGER",
		"nl": "SORTEREN",
		"de": "SORTIEREN"
	},
	"ALL": {
		"en": "ALL",
		"fr": "TOUS",
		"nl": "ALLE",
		"de": "ALLE"
	},
	"INSTALLED": {
		"en": "INSTALLED",
		"fr": "INSTALLÉ",
		"nl": "GEÏNSTALLEERD",
		"de": "INSTALLIERT"
	},
	"NEEDS_UPDATE": {
		"en": "NEEDS UPDATE",
		"fr": "A BESOIN DE MISE À JOUR",
		"nl": "HEEFT UPDATE NODIG",
		"de": "BRAUCHT UPDATE"
	},
	"NEWLY_UPDATED": {
		"en": "NEWLY UPDATED",
		"fr": "RÉCEMMENT MIS À JOUR",
		"nl": "NET GEÜPDATE",
		"de": "GERADE UPGEDATET"
	},
	"NOT_INSTALLED": {
		"en": "NOT INSTALLED",
		"fr": "PAS INSTALLÉ",
		"nl": "NIET GEÏNSTALLEERD",
		"de": "NICHT INSTALLIERT"
	},
	"LAST_UPDATED": {
		"en": "LAST UPDATED",
		"fr": "DERNIÈRE MISE À JOUR",
		"nl": "LAATSTE KEER GEÜPDATE",
		"de": "LETZTE MAL UPGEDATET"
	},
	"TITLE": {
		"en": "TITLE",
		"fr": "TITRE",
		"nl": "TITEL",
		"de": "TITEL"
	},
	"AUTHOR": {
		"en": "AUTHOR",
		"fr": "AUTEUR",
		"nl": "AUTEUR",
		"de": "AUTOR"
	},
	"BUILD": {
		"en": "BUILD",
		"fr": "BUILD",
		"nl": "BUILD",
		"de": "BUILD"
	},
	"DOWNLOADS": {
		"en": "DOWNLOADS",
		"fr": "TÉLÉCHARGEMENTS",
		"nl": "DOWNLOADS",
		"de": "DOWNLOADS"
	},
	"POPULARITY": {
		"en": "POPULARITY",
		"fr": "Popularité",
		"nl": "POPULARITY",
		"de": "POPULARITY"
	},
	"LIKES": {
		"en": "LIKES",
		"fr": "AIMÉ BIEN",
		"nl": "LEUK GEVONDEN",
		"de": "TOLL GEFUNDEN"
	},
	"RANDOM": {
		"en": "RANDOM",
		"fr": "ARBITRAIRE",
		"nl": "WILLEKEURIG",
		"de": "ZUFALL"
	},
	"LOG": {
		"en": "LOG",
		"fr": "JOURNAL DE BORD",
		"nl": "LOGBOEK",
		"de": "LOGBUCH"
	},
	"SETTINGS": {
		"en": "SETTINGS",
		"fr": "CONFIGURATION",
		"nl": "INSTELLINGEN",
		"de": "EINSTELLUNGEN"
	},
	"Default_Tab": {
		"en": "Default Tab",
		"fr": "Onglet par défaut",
		"nl": "Standaardtab",
		"de": "Standardtab"
	},
	"Verbose_Log": {
		"en": "Verbose Log",
		"fr": "Journal verbeux de bord",
		"nl": "Uitgebreid logboek",
		"de": "Umfassendes Logbuch"
	},
	"Debug_Mode": {
		"en": "Debug Mode",
		"fr": "Mode de déboguer",
		"nl": "Debugmodus",
		"de": "Fehlersuchmodus"
	},
	"PA_Install_Location": {
		"en": "PA Install Location",
		"fr": "Répertoire d'installation de PA",
		"nl": "PA installatiemap",
		"de": "PA Installationspfad"
	},
	"Language": {
		"en": "Language",
		"fr": "Langue",
		"nl": "Taal",
		"de": "Sprache"
	},
	"Loading": {
		"en": "Loading...",
		"fr": "Chargement...",
		"nl": "",
		"de": ""
	},
	"Name_Filter": {
		"en": "Filter",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Context_Filter": {
		"en": "Context",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Sort_By": {
		"en": "Sort By",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Show_Only": {
		"en": "Show Only",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Category": {
		"en": "Show Only",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Hide_Additional_Options": {
		"en": "Hide Additional Options",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Show_Additional_Options": {
		"en": "Show Additional Options",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Options": {
		"en": "Options",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Enable_All": {
		"en": "Enable All",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Disable_All": {
		"en": "Disable All",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"mod_s__require_updates": {
		"en": "mod(s) require updates",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"update_all": {
		"en": "update all",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"One_or_more_filters_are_currently_applied": {
		"en": "One or more filters are currently applied",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Show_Icon": {
		"en": "Show Icon",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Installed_Mods_List_View": {
		"en": "Installed Mods List View",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Available_Mods_List_View": {
		"en": "Available Mods List View",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"SUMMARY_VIEW": {
		"en": "SUMMARY VIEW",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"DETAILED_VIEW": {
		"en": "DETAILED VIEW",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"clear": {
		"en": "clear",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Mod_Manager_is_offline": {
		"en": "Mod Manager is offline",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Last_known_build": {
		"en": "Last known build",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Planetary_Annihilation_Mod_Manager": {
		"en": "Planetary Annihilation Mod Manager",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Current_PA_Build": {
		"en": "Current PA Build",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Statistics": {
		"en": "Statistics",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Total_Available_Mods": {
		"en": "Total Available Mods",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Total_Mod_Downloads": {
		"en": "Total Mod Downloads",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Current_Mods_Installed": {
		"en": "Current Mods Installed",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Credits": {
		"en": "Credits",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Created_by": {
		"en": "Created by",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Mac_Linux_port_created_by": {
		"en": "Mac/Linux port created by",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Mod_list_generator_created_by": {
		"en": "Mod list generator created by",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Thanks_also": {
		"en": "Thanks also to those on the Uber Entertainment forums who tested and provided feedback on this program, especially",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"and": {
		"en": "and",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"Requires_Refresh": {
		"en": "Requires Refresh",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"CLIENT_MOD": {
		"en": "UI MODS",
		"fr": "",
		"nl": "",
		"de": ""
	},
	"SERVER_MOD": {
		"en": "SERVER MODS",
		"fr": "",
		"nl": "",
		"de": ""
	}
};

var strLocaleTextItems = [
	"MOD_MANAGER", 
	"NEWS",
	"INSTALLED_MODS",
	"AVAILABLE_MODS",
	"Launch_PA",
    "Launch_PA_NOMODS",
	"Refresh",
	"Exit",
	"Version",
	"by",
	"build",
	"forum",
	"uninstall",
	"REQUIRES",
	"UPDATE_AVAILABLE",
	"install",
	"update",
	"reinstall",
	"NEW",
	"SHOW",
	"SORT",
	"ALL",
	"INSTALLED",
	"NEEDS_UPDATE",
	"NEWLY_UPDATED",
	"NOT_INSTALLED",
	"LAST_UPDATED",
	"TITLE",
	"AUTHOR",
	"BUILD",
	"DOWNLOADS",
    "POPULARITY",
	"LIKES",
	"RANDOM",
	"LOG",
	"SETTINGS",
	"Default_Tab",
	"Verbose_Log",
	"Debug_Mode",
	"PA_Install_Location",
	"Language",
	"Loading",
	"Name_Filter",
	"Sort_By",
	"Show_Only",
	"Category",
	"Hide_Additional_Options",
	"Show_Additional_Options",
	"Options",
	"Enable_All",
	"Disable_All",
	"update_all",
	"mod_s__require_updates",
	"One_or_more_filters_are_currently_applied",
	"Show_Icon",
	"Installed_Mods_List_View",
	"Available_Mods_List_View",
	"SUMMARY_VIEW",
	"DETAILED_VIEW",
	"clear",
	"Mod_Manager_is_offline",
	"Last_known_build",
	"Planetary_Annihilation_Mod_Manager",
	"Current_PA_Build",
	"Statistics",
	"Total_Available_Mods",
	"Total_Mod_Downloads",
	"Current_Mods_Installed",
	"Credits",
	"Created_by",
	"Mac_Linux_port_created_by",
	"Mod_list_generator_created_by",
	"Thanks_also",
	"and",
	"Requires_Refresh"];