#!/bin/bash

WORKINGDIR=/tmp/pamm_$RANDOM

case $OSTYPE in
linux*)
    PLATFORM="linux"
    PAMMDIR="$HOME/.local/pamm"
    APPDIR="$PAMMDIR/resources/app"
    ;;
darwin*)
    PLATFORM="darwin"
    PAMMDIR="$HOME/Library/Application Support/Uber Entertainment/Planetary Annihilation/pamm"
    #PAMMDIR="$WORKINGDIR/tmp/pamm"
    APPDIR="$PAMMDIR/Atom.app/Contents/Resources/app"
    ;;
*)
    echo Unsupported platform: $OSTYPE
    exit 1
    ;;
esac

wget --version >/dev/null 2>&1 && HTTPCLIENT="wget"
curl --version >/dev/null 2>&1 && HTTPCLIENT="curl"
if [ ! -v HTTPCLIENT ]; then
    echo "wget or curl not found!"
    exit 1
fi

mkdir $WORKINGDIR

echo "Downloading latest PAMM release..."

LATEST_PAMM_URL=https://github.com/pamods/pamm-atom/archive/stable.zip
PAMM_ARCHIVE=$WORKINGDIR/stable.zip

if [ $HTTPCLIENT == "wget" ]; then
    wget "$LATEST_PAMM_URL" -O "$PAMM_ARCHIVE"
else
    curl -L "$LATEST_PAMM_URL" -o "$PAMM_ARCHIVE"
fi

if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Find latest Atom Shell release..."

LATEST_ATOM_URL=https://github.com/atom/atom-shell/releases/latest

if [ $HTTPCLIENT == "wget" ]; then
    HTML=`wget -qO- $LATEST_ATOM_URL`
else
    HTML=`curl -L $LATEST_ATOM_URL`
fi

if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

ATOM_ARCHIVE_URL=`echo $HTML | egrep -o "/atom/atom-shell/releases/download/[^\"]+-$PLATFORM-x64.zip" | head -1`
ATOM_ARCHIVE_URL="https://github.com$ATOM_ARCHIVE_URL"

ATOM_ARCHIVE=`echo $ATOM_ARCHIVE_URL | sed -E 's/.+\/(.+)/\1/'`
ATOM_ARCHIVE="$WORKINGDIR/$ATOM_ARCHIVE"

rm -rf "$PAMMDIR"
mkdir -p "$PAMMDIR"

echo "Downloading Atom Shell..."
echo "  from: $ATOM_ARCHIVE_URL"
echo "  to: $ATOM_ARCHIVE"

if [ $HTTPCLIENT == "wget" ]; then
    wget "$ATOM_ARCHIVE_URL" -O "$ATOM_ARCHIVE"
else
    curl -L "$ATOM_ARCHIVE_URL" -o "$ATOM_ARCHIVE"
fi

if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Extracting Atom Shell..."
unzip -q -u "$ATOM_ARCHIVE" -d "$PAMMDIR"
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Extracting PAMM module..."
unzip -q -u "$PAMM_ARCHIVE" -d "$WORKINGDIR"
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Copying PAMM module..."
cp -R "$WORKINGDIR/pamm-atom-stable/app" "$APPDIR"
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Cleaning up tmp files..."
rm -rf "$WORKINGDIR"

case $OSTYPE in
linux*)
    mv "$PAMMDIR/atom" "$PAMMDIR/pamm"

    # try to create desktop shortcut & protocol handler
    cat >$HOME/.local/share/applications/pamm.desktop <<EOL
[Desktop Entry]
Version=1.0
Type=Application
Name=PAMM
Comment=PA Mod Manager
Exec=$PAMMDIR/pamm "%u"
Icon=$PAMMDIR/resources/app/assets/img/pamm.png
MimeType=x-scheme-handler/pamm;
EOL
    update-desktop-database ~/.local/share/applications

    echo "PAMM has been successfully installed."
    echo "  => $PAMMDIR"
    $PAMMDIR/pamm
    ;;
darwin*)
    #mv "$PAMMDIR/Atom.app/Contents/MacOS/Atom" "$PAMMDIR/Atom.app/Contents/MacOS/PAMM"
    mv "$PAMMDIR/Atom.app" "$PAMMDIR/PAMM.app"
    open "$PAMMDIR/PAMM.app"
    echo "PAMM has been successfully installed."
    ;;
esac



