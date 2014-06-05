$ErrorActionPreference = "Stop"
&{
    $WorkingDir = (Split-Path ((Get-Variable MyInvocation -Scope 1).Value).MyCommand.Path)

    $PammDir = $ENV:LOCALAPPDATA + "\Uber Entertainment\Planetary Annihilation\pamm"
    $AtomDir = "$PammDir"
    $AppDir = "$PammDir\resources\app"

    $ReleasesURL = "https://github.com/atom/atom-shell/releases/latest"

    try {
        Write-Host "Find latest Atom Shell release..."
        $Html = (New-Object System.Net.WebClient).DownloadString($ReleasesURL)

        if($Html -match "href=`"(/atom/atom-shell/releases/download/[^`"]+-win32-ia32.zip)") {

            # Prepare PAMM installation folder

            if((Test-Path $PammDir)) {
                Remove-Item -Recurse -Force $PammDir
                Start-Sleep -s 2
            }
            [void](New-Item -ItemType directory -Path $PammDir)

            # Download latest Atom Shell release

            Write-Host "Downloading Atom Shell..."

            $ArchiveURL = "https://github.com" + $Matches[1]
            Write-Host "  from:" $ArchiveURL

            $Archive = $WorkingDir + "\" + $ArchiveURL.Substring($ArchiveURL.LastIndexOf("/")+1)
            Write-Host "  to:" $Archive

            (New-Object System.Net.WebClient).DownloadFile($ArchiveURL, $Archive)

            # Extract Atom Shell

            Write-Host "Extracting Atom Shell..."
            $Shell = New-Object -com shell.application

            if(!(Test-Path $AtomDir)) {
                [void](New-Item -ItemType directory -Path $AtomDir)
            }

            $sa = $Shell.NameSpace($Archive)
            foreach($ArchiveItem in $sa.items())
            {
                $Shell.Namespace($AtomDir).copyhere($ArchiveItem)
            }

            # Rename Atom Shell binary

            Move-Item "$AtomDir\atom.exe" "$AtomDir\pamm.exe"

            # Copy PAMM module

            Write-Host "Copying PAMM module..."
            Copy-Item "$WorkingDir\app" $AppDir -Recurse
    
            # Create shortcuts

            Write-Host "Create PAMM shortcut..."
            $WshShell = New-Object -ComObject WScript.Shell
            try {
                $Shortcut = $WshShell.CreateShortcut("$PammDir\PAMM.lnk")
                $Shortcut.TargetPath = "`"$AtomDir\pamm.exe`""
                $Shortcut.Arguments = ""
                $Shortcut.IconLocation = "$AppDir\assets\img\favicon.ico"
                $Shortcut.Save()

                $Shortcut = $WshShell.CreateShortcut("$Home\Desktop\PAMM.lnk")
                $Shortcut.TargetPath = "`"$AtomDir\pamm.exe`""
                $Shortcut.Arguments = ""
                $Shortcut.IconLocation = "$AppDir\assets\img\favicon.ico"
                $Shortcut.Save()
            }
            catch {
                Write-Host "An error occurred during the shortcut creation." -ForegroundColor Red
            }

            # Register protocol
            # http://msdn.microsoft.com/en-us/library/ie/aa767914%28v=vs.85%29.aspx
        
            Write-Host "Register pamm:// protocol.."

            if((Test-Path HKCU:\Software\Classes\pamm)) {
                Remove-Item -Path HKCU:\Software\Classes\pamm -Recurse
            }

            [void](New-Item -Path HKCU:\Software\Classes\pamm -Value "URL:pamm Protocol")
            [void](New-ItemProperty -Path HKCU:\Software\Classes\pamm -Name "URL Protocol" -PropertyType String -Value "")
            [void](New-Item -Path HKCU:\Software\Classes\pamm\DefaultIcon -Value "$AppDir\assets\img\favicon.ico")
            [void](New-Item -Path HKCU:\Software\Classes\pamm\shell)
            [void](New-Item -Path HKCU:\Software\Classes\pamm\shell\open)
            [void](New-Item -Path HKCU:\Software\Classes\pamm\shell\open\command -Value "`"$AtomDir\pamm.exe`" `"%1`"")

            Write-Host "PAMM has been successfully installed." -ForegroundColor Green
            Write-Host "  => $PammDir" -ForegroundColor Green
            
            # Start PAMM
            
            Start-Process "cmd.exe" "/C start pamm.exe" -WorkingDirectory $AtomDir
        }
        else {
            Write-Host "Latest Atom Shell release not found." -ForegroundColor Red
            Exit 1
        }
    }
    catch {
        Write-Host "An unexpected error occurred:" $_.Exception.Message -ForegroundColor Red
        Exit 2
    }
}