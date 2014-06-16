# Windows Installer for PAMM

You need WiX Toolset to build the installer : http://wixtoolset.org/

Prepare a folder with Atom Shell with the PAMM modules bundled and rename the atom.exe to pamm.exe.

Update the Version attribute in Product.wxs

Run: C:\Windows\Microsoft.NET\Framework\v4.0.30319\msbuild /p:Configuration=Release /p:PammDir=YOURPATHTOPAMM

This should generate a msi installer (~30MiB) in the release folder without any errors.

If the ProductComponents.wxs has changed, update Product.wxs / WixShellExecTarget with the proper pamm.exe file Id and rebuild the installer.
