// Atom Shell modules
var app = require('app');
var BrowserWindow = require('browser-window');
var dialog = require('dialog');

// Node.js modules
var fs = require('fs'); 
var path = require('path'); 
var semver = require('semver');

var params = {
    info: {}
    ,context: 'client'
    ,devmode: false
    ,install: ""
};
global['params'] = params;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  console.log('Reading package.json');
  fs.readFile(__dirname + path.sep + 'package.json', { encoding: 'utf8' }, function(err, data) {
    if (err) throw err;
    params.info = JSON.parse(data);
    
    checkEngine();
    
    console.log('Parsing arguments');
    var argv = process.argv;
    for(var i = 0; i < argv.length; ++i) {
      var arg = argv[i];
      if(arg.indexOf('pamm://') === 0) {
        if(arg.slice(-1) === '/') {
            arg = arg.substring(0, arg.length-1)
        }
        var values = arg.substring(7).split('/');
        
        if (values.length === 1) {
            params.install = values[0];
        }
        else if (values[0] === "install") {
            params.install = values[1];
        }
        else {
            console.log("Unsupported verb '" + values[0] + "' in '" + arg + "'");
        }
      }
      else if (arg === 'devmode') {
        params.devmode = true;
      }
      else if (arg === 'offline') {
        params.offline = true;
      }
      else if (arg === 'server') {
        params.context = 'server';
      }
    }
    
    console.log('Mod to install: ' + (params.install ? params.install : 'none'));
    console.log('DevMode: ' + params.devmode );
    
    // Create the browser window.
    console.log('Instanciate BrowserWindow');
    mainWindow = new BrowserWindow({width: 1280, height: 720});
    
    // and load the index.html of the app.
    console.log('Load main page');
    mainWindow.loadUrl('file://' + __dirname + '/index.html');
    
    // Open chromium devtool debugger
    if(params.devmode) {
      mainWindow.openDevTools();
    }
    
    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null;
    });
  });
});

var checkEngine = function() {
    var current = process.versions['atom-shell'];
    var expected = params.info.engines['atom-shell'];

    if(!semver.satisfies(current, expected)) {
        dialog.showMessageBox({
            type: "warning"
            ,buttons: ["Quit"]
            ,title: "Incompatible version"
            ,message: "The Atom Shell version currently used to run PAMM is outdated and will be unable to run as expected.\n\nPlease reinstall PAMM or upgrade Atom Shell manually."
        });
        app.quit();
    }
}