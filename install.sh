#!/usr/bin/env bash
cat <<EOT
  This script is intended to automate installation of the offline Internet Archive "dweb-mirror"

  Previous versions have been tested on an Armbian on a Orange Pi Zero and Rachel on RPI3

  This script can be run multiple times without problems.

  The easiest way to run is

  curl -o- -L https://unpkg.com/@internetarchive/dweb-mirror/install.sh | bash

EOT
set -e # Break on error
#set -x # Lets see whats happening

function step {
  STEPALL=$*
  STEPNUMBER=$1
  shift
  STEPNAME="$*"
  #Uncomment next line if you want to find where it failed
  #echo "Offline Internet Archive Installer: ${STEPNUMBER}" > /tmp/step
  echo "Offline Internet Archive Installer: ${STEPNAME}"
}

step 00 Determining what kind of box this is

# Convert the portable uname results into go specific environment note Mac has $HOSTTYPE=x86_64 but not sure that is on other platforms
case `uname -m` in
"armv7l") ARCHITECTURE="arm";;    # e.g. Raspberry 3. Note armv8 and above would use what IPFS has as arm64, armv7 and down want "arm"
"x86_64") ARCHITECTURE="amd64";;  # e.g. a Mac OSX
"i?86") ARCHITECTURE="386";;      # e.g. a Rachel3+
"TODO") ARCHITECTURE="xxx";;      # TODO Armbian / OrangePI
#TODO Need check on Arbmbian / OrangePi
*) echo "Unknown processor type `uname -m`, needs configuring"; ARCHITECTURE="unknown";;
esac

# Now find OS type, note Mac also has a $OSTYPE
case `uname -s` in
"Darwin") OPERATINGSYSTEM="darwin";;   # e.g. a Mac OSX
"Linux") OPERATINGSYSTEM="linux";;     # e.g. Raspberry 3 or Rachel3+
"TODO") OPERATINGSYSTEM="armbian";;    #TODO Need check on Arbmbian / OrangePi
*) echo "Unknown Operating system type `uname -s` - needs configuring"; OPERATINGSYSTEM="unknown";;
esac

#TODO detect Rachel, IIAB etc and set $PLATFORM
PLATFORM="unknown"
[ ! -e /etc/rachelinstaller-version ] || PLATFORM="rachel"

# And setup some defaults
INSTALLDIR=`pwd`  # Default to where we are running this from
YARNCONCURRENCY=1 # Good for a 386 or arm, below that use 1, for OSX go up
CACHEDIR="${HOME}/archiveorg"

# Override defaults based on above
case "${PLATFORM}" in
"rachel") CACHEDIR="/.data/archiveorg";;
esac
case "${ARCHITECTURE}" in
"386") YARNCONCURRENCY=2;;
"amd64") YARNCONCURRENCY=4;;
esac

echo "Architecture: ${ARCHITECTURE} OS: ${OPERATINGSYSTEM} PLATFORM: ${PLATFORM} CACHEDIR: ${CACHEDIR} INSTALLDIR: ${INSTALLDIR}"

if [ "${OPERATINGSYSTEM}" != "darwin" ]
then
  if ! yarn --version
  then
  step XXX "Adding Yarn sources"
    curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
  fi
  set +e # update and upgrade often have non-zero return codes even though safe to continue
  step XXX "Apt update"
  sudo apt-get update

  step XXX "Upgrade all Apt packages"
  sudo dpkg --configure -a # Clear out any previous locks/interrupted opts - especially kolibri install
  sudo apt-get upgrade    # Make sure running latest version
  sudo apt -y autoremove
  set -e # Exit on errors
else # Its OSX
  #set +e  # Uncomment if these unneccessarily have failure exit codes
  step XXX "Checking git and brew are installed"
  git --version || xcode-select --install  # Get Git and other key command line tools (need this before "brew"
  brew --version || /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  set -e
fi

if [ $OPERATINGSYSTEM = "armbian" ]
then
  step XXX "Armbian only - setting timezone"
  sudo dpkg-reconfigure tzdata
fi

if [ "${OPERATINGSYSTEM}" != "darwin" ]
then
  step XXX "Installing nodejs yarn git libsecret"
  sudo apt-get install -y nodejs yarn git libsecret-1-dev
  # Note previously installing "npm" but no longer using
  # Note yarn alternative can skip the apt-key & sources steps above and ...
  # curl -o- -L https://yarnpkg.com/install.sh | bash
  # source ~/.bashrc # Fix path
else
  step XXX "Installing wget nodejs yarn"
  wget --version >>/dev/null || brew install wget
  # The brew installer for node is broken (fails to run the npx line in bookreader/package.json), use the line below as found on https://nodejs.org/en/download/package-manager/#macos
  #node --version >>/dev/null || brew install nodejs
  node --version >>/dev/null || ( curl "https://nodejs.org/dist/latest/node-${VERSION:-$(wget -qO- https://nodejs.org/dist/latest/ | sed -nE 's|.*>node-(.*)\.pkg</a>.*|\1|p')}.pkg" > "$HOME/Downloads/node-latest.pkg" && sudo installer -store -pkg "$HOME/Downloads/node-latest.pkg" -target "/" )
  yarn --version >>/dev/null || curl -o- -L https://yarnpkg.com/install.sh | bash
  source ~/.bashrc # Fix up path
fi

if [ $PLATFORM = "rachel" ]
then
  step XXX "Rachel only - requirements for usbmount: debhelper and exfat-fuse"
  sudo apt-get install -y debhelper exfat-fuse
fi

# Previously used, but dont believe need now that not installing as many dependencies.
# yarn global add node-pre-gyp
# [ -d node_modules/cmake ] || [ -d /usr/local/share/.config/yarn/global/node_modules/cmake/ ] || sudo yarn global add cmake

step XXX "Creating cache directory for content"
mkdir -p ${CACHEDIR} && chown ${USER} ${CACHEDIR}

step XXX "Yarn install or update dweb-mirror"
cd ${INSTALLDIR} # By default ${HOME}
yarn config set child-concurrency ${YARNCONCURRENCY}
if [ -d node_modules/@internetarchive/dweb-mirror ]
then
  # Previously installed, just check the install and upgrade
  yarn install
  yarn upgrade
else
  # Not previously installed, install, but dont upgrade (wastes time)
  yarn add @internetarchive/dweb-mirror
  yarn install
fi

step XXX "Installer: Switching directories into dweb-mirror"
cd ${INSTALLDIR}/node_modules/@internetarchive/dweb-mirror

step XXX "Setup service to autostart at boot and start server"
# Note its clear we need to edit the service but then its unclear that the armbian and rachel strategies are different, cross-try them.
cat internetarchive.service \
| sed -e "s:{{ internetarchive_dir }}:${INSTALLDIR}:" | sed -e "s:User=root:User=${USER}:" >/tmp/internetarchive.service
if [ "${OPERATINGSYSTEM}" = "armbian" || "${OPERATINGSYSTEM}" = "rachel" ]
then
  diff /tmp/internetarchive.service /lib/systemd/system || sudo cp /tmp/internetarchive.service /lib/systemd/system
  sudo systemctl enable internetarchive.service # Links /etc/systemd/system/multi-user.targets.wants/internetarchive.service to /lib/systemd/system/internetarchiveservice
  sudo systemctl daemon-reload   # Starts internetarchive
  #sudo service internetarchive start # Alternative starter
  #sudo systemctl start internetarchive.service # Alternative starter
  sudo service internetarchive start
else
  echo "Installer needs a strategy to setup auto-start on this platform"
fi

if [ "${PLATFORM}" = "rachel" ]
then
  step XXX "Rachel only: Copy module"
  sudo rm -rf /var/www/modules/en-internet_archive
  sudo mv rachel/en-internet_archive /var/www/modules/
  sudo chown -R www-data:www-data /var/www/modules/en-internet_archive
fi

# TODO this usb strategy might work on other platforms esp OrangePi
if [ "${PLATFORM}" = "rachel" ]
then
  step XXX "Rachel only: setting up USB mount"
  cd /var/tmp
  if [ -d usbmount ]
  then
	  cd usbmount
	  git pull
  else
	  git clone https://github.com/rbrito/usbmount.git
	  cd usbmount
  fi
  dpkg-buildpackage -us -uc -b
  cd ..
  sudo apt install -y ./usbmount_0.0.24_all.deb
  echo "Installer: Editing /etc/usbmount/usbmount.conf in place"
  sudo sed 's/FILESYSTEMS=.*/FILESYSTEMS="vfat ext2 ext3 ext4 ntfs-3g ntfs exfat hfsplus fuseblk"/' -i- /etc/usbmount/usbmount.conf
fi

if [ "${OPERATINGSYSTEM}" = "armbian" ]
then
  step XXX "Armbian closing notes"
  cat <<EOT
  Typically you'll either want to connect to your WiFi access point and be a server on it,
  OR have the Armbian act as a WiFi hot spot itself.

  a) To setup for your device's wifi to access your Wifi access point.
   sudo nano /etc/network/interfaces

  And add these lines to the end, using your SSID (aka wifi name) and password

   auto wlan0
   iface wlan0 inet dhcp
   wpa-ssid <Your Access Point Name aka SSID>
   wpa-psk <Your WPA Password>

  Then start it with

   sudo ifup wlan0

  or b) to use your device as a WiFi hot spot

  * sudo armbian-config > network > hotspot >
  * At some point it asks to "select interface" I think this is the point to pick wlan0 though its unclear whether
    this is the WiFi interface to use, or for backhaul?
  * Note that once setup, it can take a minute or two for the WiFi access point to be visible.
  * Also note that it seems to pick unusual IP addresses, 172.24.1.1 was the gateway when I connected to it.

  * If anyone knows how to set this up from the command line a PR would be appreciated.
  * This doc might be helpful
    https://docs.armbian.com/User-Guide_Advanced-Features/#how-to-set-wireless-access-point

EOT
fi

echo "Installation of offline Internet Archive (dweb-mirror) complete"

