#!/bin/bash

WORKINGDIR=`dirname "$0"`

case $OSTYPE in
linux*)
    PLATFORM="linux"
    PAMMDIR="$HOME/.local/Uber Entertainment/Planetary Annihilation/pamm"
    APPDIR="$PAMMDIR/resources/app"
    ;;
darwin*)
    PLATFORM="darwin"
    #PAMMDIR="$HOME/Library/Application Support/Uber Entertainment/Planetary Annihilation/pamm"
    PAMMDIR="$WORKINGDIR/tmp/pamm"
    APPDIR="$PAMMDIR/Atom.app/Contents/Resources/app"
    ;;
*)
    echo Unsupported platform: $OSTYPE
    exit 1
    ;;
esac

echo "Find last Atom Shell release..."

HTML=`wget -qO- https://github.com/atom/atom-shell/releases/latest`
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

ARCHIVEURL=`echo $HTML | egrep -o "/atom/atom-shell/releases/download/[^\"]+-$PLATFORM-x64.zip" | head -1`
ARCHIVEURL="https://github.com$ARCHIVEURL"

ARCHIVE=`echo $ARCHIVEURL | sed -E 's/.+\/(.+)/\1/'`
ARCHIVE="$WORKINGDIR/$ARCHIVE"

rm -rf "$PAMMDIR"
mkdir -p "$PAMMDIR"

echo "Downloading Atom Shell..."
echo "  from: $ARCHIVEURL"
echo "  to: $ARCHIVE"

wget $ARCHIVEURL
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Extracting Atom Shell..."
unzip -u "$ARCHIVE" -d "$PAMMDIR"
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

echo "Copying PAMM module..."
cp -R "$WORKINGDIR/app" "$APPDIR"
if [ $? -gt 0 ]; then
    echo "ERROR!"
    exit 1
fi

case $OSTYPE in
linux*)
    mv "$PAMMDIR/atom" "$PAMMDIR/pamm"
	echo "PAMM has been successfully installed."
	echo "  => $PAMMDIR/pamm"
    ;;
darwin*)
    mv "$PAMMDIR/Atom.app/Contents/MacOS/Atom" "$PAMMDIR/Atom.app/Contents/MacOS/PAMM"
    mv "$PAMMDIR/Atom.app" "$PAMMDIR/PAMM.app"
    open "$PAMMDIR/PAMM.app"
    echo "PAMM has been successfully installed."
    ;;
esac



