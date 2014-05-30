# PA Mod Manager (atom-shell edition)

Original Windows version : https://forums.uberent.com/threads/rel-pa-mod-manager-v4-0-3.50726/

Original Linux and Mac OS X version : https://forums.uberent.com/threads/rel-raevns-pa-mod-manager-for-linux-and-mac-os-x-version-4-0-2.50958/

By using atom-shell, this version should be able to run on every platform supported by Planetary Annihilation at once.
This is a port of the Windows version which already use a html engine.

## Installation

Download (or clone) this project and uncompress it : 
https://github.com/mereth/pamm-atom/archive/stable.zip

Download the atom-shell release for your platform and uncompress it : 
https://github.com/atom/atom-shell/releases

Run atom with the path to the `app` folder as parameter

Or put the `app` folder under atom-shell's resources directory (on OS X it is
`Atom.app/Contents/Resources/`, and on Linux and Windows it is `resources/`),
like this:

On Mac OS X:

```text
atom-shell/Atom.app/Contents/Resources/app/
├── package.json
├── main.js
└── index.html
```

On Windows and Linux:

```text
atom-shell/resources/app
├── package.json
├── main.js
└── index.html
```

Then execute `Atom.app` (or `atom` on Linux, and `atom.exe` on Windows), and
atom-shell will start PAMM.