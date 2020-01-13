#!/usr/bin/env bash

# Can enter "./install_mediawiki 2" to start with step 2
STEP=${1:-0}
# User and group running this and other shell functions as,
# On Nuc it was scribe / staff; on RPI typically pi / pi
USER=pi
GROUP=pi
APACHEUSER="www-data"
RUNNINGON=localhost
PASSWORD='Gr33nP@ges!'
# On Nuc had it at...
#MEDIAWIKI=/usr/share/mediawiki
# On RPI ...
MEDIAWIKI=/var/lib/mediawiki
# On Nuc was at /etc/mediawiki/LocalSettings.php
LOCALSETTINGS=${MEDIAWIKI}/LocalSettings.php
ZIPFILE=palmleaf-dir.tar.gz
#WAYBACK_HITCOUNTER=https://archive.org/web/20191230063858/https://extdist.wmflabs.org/dist/extensions/HitCounters-REL1_34-48dd6cb.tar.gz
WAYBACK_HITCOUNTER=https://web.archive.org/web/20191230063858if_/https://extdist.wmflabs.org/dist/extensions/HitCounters-REL1_34-48dd6cb.tar.gz
# Where are the mediawiki install files already installed
DWEBMIRRORMEDIAWIKI=${HOME}/node_modules/@internetarchive/dweb-mirror/mediawiki
if [ ! -d ${DWEBMIRRORMEDIAWIKI} ]
then
  echo "dweb-mirror must be installed before this, cant find it at ${DWEBMIRRORMEDIAWIKI}"
  exit
fi

function appendOrReplaceBegin {
  LOCALSETTINGSBAK=${MEDIAWIKI}/LocalSettings.`date -Iminutes`.php
  if [ -f "${LOCALSETTINGS}" ]
  then
    echo "Saving old copy of ${LOCALSETTINGS}"
    sudo cp ${LOCALSETTINGS} ${LOCALSETTINGSBAK}
  fi
}
function appendOrReplaceEnd {
  diff ${LOCALSETTINGSBAK} ${LOCALSETTINGS} || echo "===changes made above ==="
}
function appendOrReplace {
  if grep $1 ${LOCALSETTINGS}
  then
    echo "Swapping in place to: $2"
    sudo sed -i -e "s!^.*$1.*\$!$2!" ${LOCALSETTINGS}
  else
    echo "Appending: $2"
    echo $2 | sudo tee -a ${LOCALSETTINGS}
  fi
}

# Now find OS type, note Mac also has a $OSTYPE
case `uname -s` in
"Darwin") OPERATINGSYSTEM="darwin";;   # e.g. a Mac OSX
"Linux") OPERATINGSYSTEM="linux";;     # also seen in caps
*) echo "Unknown Operating system type `uname -s` - needs configuring"; OPERATINGSYSTEM="unknown"; exit;;
esac
# Hard to tell Armbian from Raspbian or a bigger Linux so some heuristics here
[ ! -e /usr/sbin/armbian-config ] || OPERATINGSYSTEM="armbian"
[ ! -e /etc/dpkg/origins/raspbian ] || OPERATINGSYSTEM="raspbian"

cat <<EOT
==== THIS IS A PARTIAL INSTALLER FOR MEDIAWIKI FOR PLAMLEAF =======
This installation will terminate if there is any error

If things fail, there may be useful debugging logs in:
/var/log/apache2/{access, error}.log
/var/log/mysql/error.log

Make sure to uncomment/insert these lines in ${LOCALSETTINGS} if things are failing:
\$wgShowExceptionDetails = true;
\$wgShowDBErrorBacktrace = true;
\$wgShowSQLErrors = true;
EOT
set -e
set -x # Just for debugging

if [ ${STEP} -le 1 ]; then
  echo step 1 Fetching operating system packages
  if [ "${OPERATINGSYSTEM}" == "armbian" -o  "${OPERATINGSYSTEM}" == "darwin" ]; then
    echo "Haven't tried this on ${OPERATINGSYSTEM} - walk this road carefully, and document it ! "
    exit
  fi
  if [ "${OPERATINGSYSTEM}" == "linux" ]; then
    #From https://www.mediawiki.org/wiki/User:Legoktm/Packages
    sudo apt-get install software-properties-common # Get add-apt-repository
    sudo add-apt-repository ppa:legoktm/mediawiki-lts # Ubuntu only
    sudo apt-get update  #
    # sudo apt-get upgrade # Make sure OS up to date
    sudo apt-get -y mediawiki
    sudo apt-get -y libapache2-mod-php # Ubuntu only
  fi
  if [ "${OPERATINGSYSTEM}" == "raspbian" ]; then
    # https://www.mediawiki.org/wiki/Manual:Running_MediaWiki_on_Debian_or_Ubuntu
    sudo apt-get update
    sudo apt-get upgrade # Make sure OS up to date
    # Alternative suggested for some OS looks like 2nd for Raspbian
    # sudo apt-get install apache2 mysql-server php php-mysql libapache2-mod-php php-xml php-mbstring
    # sudo apt-get install apache2 mysql-server php5 php5-mysql libapache2-mod-php5 # Recommended but fails
    sudo apt-get install -y apache2 mariadb-server-10.0 php php-mysql libapache2-mod-php php-xml php-mbstring
    # Optional extras - mediawiki configuration checks for them, and composer/nategood/httpful needs php-curl
    sudo apt-get install -y imagemagick php-apcu php-intl php-curl
    sudo service apache2 reload # Notice php-apcu
    pushd /tmp/;
      wget https://releases.wikimedia.org/mediawiki/1.34/mediawiki-1.34.0.tar.gz
      tar -xvzf /tmp/mediawiki-*.tar.gz
      sudo mkdir ${MEDIAWIKI}
      sudo chown ${USER}.${GROUP} ${MEDIAWIKI}
      mv mediawiki-*/* ${MEDIAWIKI}
    popd
  fi

  # Probably need on all OS - except maybe not Darwin/OSX or Debian
  sudo apt-get install -y composer # Needed for ArchiveOrgAuth extension

  cat <<EOT
  If this worked, enter './install_mediawiki.sh 3'
EOT
  exit
fi
if [ ${STEP} -le 3 ]; then
  echo step 3 configure mysql
  sudo mysqld_safe --skip-grant-tables --skip-networking &
  # Expect the first two mysql's to fail if repeated
  set +e
  sudo mysql -u root <<EOT
CREATE USER 'palmleafdb'@'localhost' IDENTIFIED BY 'Gr33nP@ges!';
EOT
  sudo mysql -u root  <<EOT
CREATE DATABASE palmleafdb;
EOT
set -e
  sudo mysql -u root <<EOT
use palmleafdb;
GRANT ALL ON palmleafdb.* TO 'palmleafdb'@'localhost';
EOT
cat <<EOT
This part has been failing for me, have not got a consistent way to make it work yet.
Try it manually and use 'SELECT * FROM mysql.user' to check it worked,
palmleafdb should show a hash in the password field

Then make sure you can log in as mysql -u palmleafdb -p
With password Gr33nP@ges!
DO NOT SKIP THIS CHECK, ITS FAILED MOST TIMES SO FAR AND WITHOUT IT THE NEXT STEPS WILL TO !
If this worked, enter './install_mediawiki.sh 4'
EOT
exit
fi

if [ ${STEP} -le 5 ]; then
  echo step 5 configure php

pushd /etc/php/7.*/apache2 # Hopefully only one of them
sudo sed -i.bak -e 's/upload_max_filesize.*$/upload_max_filesize = 20M/' \
  -e 's/memory_limit .*/memory_limit = 128M/' \
  -e 's/.*extension=intl/extension=intl/' ./php.ini
diff php.ini.bak php.ini || echo "Great it shows we made the change"
popd
sudo ln -s ${MEDIAWIKI} /var/www/html/mediawiki
ls -al /var/www/html/mediawiki
echo If this worked, enter './install_mediawiki.sh 6'
exit
fi

if [ ${STEP} -le 6 ]; then
  echo step 6 configure mediawiki.
  echo '===== THIS WAS FIRST TIME WE ARE ATTEMPTING THIS, IF FAILS ENTER "./install_mediawiki.sh 7" FOR ALTERNATIVE'
  pushd ${MEDIAWIKI}
  php 'maintenance/install.php' \
    --dbname=palmleafdb \
    --dbserver="localhost" \
    --installdbuser=palmleafdb \
    --installdbpass="${PASSWORD}" \
    --dbuser=palmleafdb \
    --dbpass="${PASSWORD}" \
    --scriptpath=/mediawiki
    --lang=en \
    --pass="${PASSWORD}" \
    "Palm Leaf Wiki" \
    "palmleafdb"
  ls -al ${LOCALSETTINGS}
  popd
echo 'If this worked and the file exists, enter "./install_mediawiki.sh 8", if it failed enter "./install_mediawiki.sh 7" for more instructions'
exit
fi

if [ ${STEP} -le 7 ]; then
  echo step 7 configure mediawiki.
  echo "We'll try and do it automatically, but if it works ty fails see the following instructions"

  MYSQLUSERPASS=`sudo egrep 'user|password' /etc/mysql/debian.cnf`
  cat <<EOT
You should now open a browser window to 'http://YOURBOXHERE/mediawiki',

You will need the following info:

Mysql user and password (you probably dont need this)
$MYSQLUSERPASS

Database host: localhost
Database: palmleafdb
Database prefix:        # To match that ion the export
user:     palmleafdb
password: Gr33nP@ges!

Then on next screen
Use same account for installation: tick

Then on next screen
Name: Palm Leaf Wiki
Namespace: PalmLeaf
Username: palmleafdb
Password: Gr33nP@ges!
Email: mitra@archive.org
Ask me more questions: tick

Then on next screen "ask me more questions"
User rights: open
Licence: Creative Commons Attribution-ShareAlike
Enable: all the Email settings
ParserHooks: ParserFunctions

If there is a place to enter script path, it should be "/w"

If the final page fails - fix the problem, then reload it - it shouldnt ask you to start again.

DO NOT CLICK "enter your wiki" yet

It will offer you to download LocalSettings.php - save it somewhere,
then you need to upload it to ${MEDIAWIKI}/LocalSettings.php

When you are finished, come back here and enter './install_mediawiki.sh 9'

EOT
#  open "http://localhost/mediawiki"
exit
fi

if [ ${STEP} -le 9 ]; then
  echo step 9 Fix up LocalSettings
  if grep 'automatically generated by the MediaWiki' ${LOCALSETTINGS}
  then
    echo "Great found ${LOCALSETTINGS} that you updated"
  else
    echo "Did not find a valid ${LOCALSETTINGS}, you need to upload after the installation in the previous step'
    echo "Upload it, come back and enter './install_mediawiki.sh 9' again
    exit
  fi
  appendOrReplaceBegin
  # Check next line, might be an opportunity during install
  appendOrReplace 'wgScriptPath =' '$wgScriptPath = "/w";' # match is to avoid matching wgResourcePath = $wgScriptPath
  appendOrReplace wgArticlePath '$wgArticlePath = "/wiki/\$1"; # Article URLs look like this'
  appendOrReplace wgEmergencyContact '$wgEmergencyContact = "mitra@archive.org";'
  appendOrReplace wgPasswordSender '$wgPasswordSender = "mitra@archive.org"; # This may be wrong'
  appendOrReplace wgEnableUploads '$wgEnableUploads = false;'
  appendOrReplace "wgGroupPermissions.*read" '#$wgGroupPermissions["*"]["read"] = false;'
  appendOrReplace "wgGroupPermissions.*edit" '$wgGroupPermissions["*"]["edit"] = false;'
  appendOrReplace wgExternalLinkTarget '$wgExternalLinkTarget = "_blank";'
  appendOrReplace wgCapitalLinks '$wgCapitalLinks = false;'
  appendOrReplace wgShowExceptionDetails '#$wgShowExceptionDetails = true;'
  appendOrReplace wgShowDBErrorBacktrace '#$wgShowDBErrorBacktrace = true;'
  appendOrReplace wgDebugLogFile '#$wgDebugLogFile = "/var/log/mediawiki.log";'
  appendOrReplace max_execution_time 'ini_set("max_execution_time", 0);'
  appendOrReplace wgAllowCopyUploads '$wgAllowCopyUploads = true;'
  appendOrReplaceEnd
cat <<EOT
If this worked enter './install_mediawiki.sh 10'
EOT
exit
fi
if [ ${STEP} -le 10 ]; then
  echo step 10 Apache2 config
  pushd /etc/apache2
  if [ -f conf-available/mediawiki.conf ]
  then echo "Looks like conf-available/mediawiki.conf already installed, comparing ... if differences aren't a problem enter './install_mediawiki.sh 11'"
    diff conf-available/mediawiki.conf ${DWEBMIRRORMEDIAWIKI}/mediawiki.conf
  else
    sudo cp ${DWEBMIRRORMEDIAWIKI}/mediawiki.conf conf-available/mediawiki.conf
    echo "If this works enter './install_mediawiki.sh 11'"
  fi
  cd conf-enabled
  sudo ln -s ../conf-available/mediawiki.conf .
  popd
  exit
fi
if [ ${STEP} -le 11 ]; then
  echo step 11 import export

if [ -f ${HOME}/palmleaf-pages.xml.gz ]
then IMPORTFROM="${HOME}/palmleaf-pages.xml.gz"
else
  if [ -f ${HOME}/palmleaf-pages.xml ]
  then IMPORTFROM="${HOME}/palmleaf-pages.xml"
  else
    echo "Must have ${HOME}/palmleaf-pages.xml or ${HOME}/palmleaf-pages.xml.gz, upload it and then ./install_mediawiki.sh 9"
    exit
  fi
fi
# Exporting and importing https://www.mediawiki.org/wiki/Help:Export
# Importing that xml dump https://www.mediawiki.org/wiki/Manual:Importing_XML_dumps
pushd ${MEDIAWIKI}
php maintenance/importDump.php --conf ${LOCALSETTINGS} --username-prefix="" --no-updates ${IMPORTFROM}
popd

cat <<EOT
If this worked enter './install_mediawiki.sh 12' to rebuildrecentchanges and initSiteStats
EOT
exit
fi
if [ ${STEP} -le 13 ]; then
  echo step 13 - rebuild stuff
pushd ${MEDIAWIKI}
php maintenance/rebuildrecentchanges.php
php maintenance/initSiteStats.php --update
sudo mysql -u root <<EOT
USE palmleafdb;
UPDATE actor SET actor_name="Old Maintenance script" WHERE actor_name="Old Maintenance script";
EOT
popd
cat <<EOT
If this worked enter './install_mediawiki.sh 14' to import images
note that the next step will take several hours so make sure you can leave it running
EOT
exit
fi
if [ ${STEP} -le 15 ]; then
  echo step 15 - importing images

if [ -f palmleaf-dir.tar.gz -a ! -d opt ]
then
  echo "Untarring palmleaf-dir.tar.gz - this first step can take quite a few minutes"
  tar -xzf < palmleaf-dir.tar.gz
fi
if [ -d opt ]
then
  echo "Looks like we already have the images unzipped"
  if [ -d opt/mediawiki/w/images ]
  then
    IMAGEBASEDIR="${HOME}/opt/mediawiki/w/images"
    rm -rf "${HOME}/opt/mediawiki/w/images/thumb" # Dont import thumbnails
    rm -rf "${HOME}/opt/mediawiki/w/images/archive" # Dont import archived images
    rm -rf "${HOME}/opt/mediawiki/w/images/temp" # Dont import temp files left over from some other process
  else
    echo "But cannot find the "images" directory at ${HOME}/opt/mediawiki/w/images - unsure how to recover"
    exit
  fi
else
  echo "Cant find opt directory so not sure where to find images directory - unsure how to recover but this code could be made more generic"
  exit
fi

# Import images , note different from what says in wiki above
echo "==== NOTE THIS CAN TAKE SEVERAL HOURS !  ===== "
echo "If it fails, or you lose the ssh etc then you can rerun it, and it will skip over the parts already done"
pushd ${MEDIAWIKI}
php maintenance/importImages.php --search-recursively ${IMAGEBASEDIR}
php maintenance/checkImages.php | grep missing | sed -E 's/^(.+):.+/File:\1/' | php maintenance/deleteBatch.php
php maintenance/deleteArchivedRevisions.php --delete || echo
php maintenance/deleteArchivedFiles.php --delete  # May generate error messages you can ignore
popd
cat <<EOT
If that worked enter './install_mediawiki.sh 16' to find the logo
EOT
exit
fi
if [ ${STEP} -le 17 ]; then
  echo step 17 - Looking for and installing palm-leaf-wiki-logo as logo
  pushd ${MEDIAWIKI}
  LOGO2=`find images -name palm-leaf-wiki-logo.png -print`
  LOGOLN="\$wgLogo = \"\$wgScriptPath/${LOGO2}\";"
  appendOrReplaceBegin
  appendOrReplace wgLogo "${LOGOLN}"
  appendOrReplaceEnd
  grep wgLogo ${LOCALSETTINGS}
  popd
cat <<EOT
If that worked, and the line looks good, come back here and enter './install_mediawiki.sh 18' to install HitCounters
EOT
exit
fi
if [ ${STEP} -le 19 ]; then
  echo step 19 - installing extensions
cat <<EOT
<rant>Mediawiki has an unusable extension system, involving downloading from a link that changes every time,
untarring etc, so I have had to store a working version of the extension on the Wayback machine.</rant>
EOT
  appendOrReplaceBegin
  appendOrReplace "wfLoadExtension.*HitCounters" 'wfLoadExtension( "HitCounters" );'
  appendOrReplaceEnd
  pushd ${MEDIAWIKI}/extensions
  curl ${WAYBACK_HITCOUNTER} | tar -xz
  cd ${MEDIAWIKI}
  php maintenance/update.php  # Runs extensions/HitCounters/update.php
  popd
  cat <<EOT
if that worked you'll see lines in the update.php step about either creating, hit_counter table, or that it already exists.
if it worked, enter './install_mediawiki.sh 20 to install extensions'
EOT
exit
fi
if [ ${STEP} -le 21 ]; then
  echo step 21
  ARCHIVEMIRADOR=${HOME}/opt/mediawiki/w/extensions/ArchiveMirador
  if [ ! -d "${ARCHIVEMIRADOR}" ]
  then
    echo "Can't find ArchiveMirador at ${ARCHIVEMIRADOR}"
    exit
  else
    cp -r ${ARCHIVEMIRADOR} ${MEDIAWIKI}/extensions/ArchiveMirador
    # TODO would be better to get from repo - but dont know where it is (asked David 27Dec)
    appendOrReplaceBegin
    appendOrReplace "wfLoadExtension.*ArchiveMirador" 'wfLoadExtension( "ArchiveMirador" );'
    appendOrReplaceEnd
    # No action required in README
    pushd ${MEDIAWIKI}
    #Not needed: php maintenance/update.php
    popd
    cat <<EOT
If that worked, enter './install_mediawiki.sh 22' to install ArchiveOrgAuth
EOT
    exit
  fi
fi
if [ ${STEP} -le 23 ]; then
  echo step 23
  ARCHIVEORGAUTH=${HOME}/opt/mediawiki/w/extensions/ArchiveOrgAuth
  if [ ! -d "${ARCHIVEORGAUTH}" ]
  then
    echo "Can't find ArchiveOrgAuth at ${ARCHIVEORGAUTH}"
    exit
  else
    cp -r ${ARCHIVEORGAUTH} ${MEDIAWIKI}/extensions/ArchiveOrgAuth
    # TODO would be better to get from repo - but dont know where it is (asked David 27Dec)
    pushd /etc/php/7.*/cli # Hopefully only one of them
    # Enable php ext-curl for command line
    sudo sed -i.bak -e 's/.*extension=curl/extension=curl/' ./php.ini
    diff php.ini.bak php.ini || echo "Great it shows we made the change"
    popd
    pushd ${MEDIAWIKI}
    echo "Note next line can take a while (2mins or so) before responds with anything"
    composer require "nategood/httpful"
    popd
    appendOrReplaceBegin
    appendOrReplace "wfLoadExtension.*ArchiveOrgAuth" 'wfLoadExtension( "ArchiveOrgAuth" );'
    appendOrReplace wgArchiveOrgAuthEndpoint '$wgArchiveOrgAuthEndpoint = "https://archive.org/services/xauthn/"; # Url for API endpoint, eg.: http://example.com/xnauth/ ( with trailing slash )'
    appendOrReplace wgArchiveOrgAuthAccess '$wgArchiveOrgAuthAccess = "<ACCESS_KEY>"; # S3 access key'
    appendOrReplace wgArchiveOrgAuthSecret '$wgArchiveOrgAuthSecret = "<SECRET_KEY>"; # S3 secret key'
    appendOrReplace wgArchiveOrgAuthExternalSignupLink '$wgArchiveOrgAuthExternalSignupLink = "https://archive.org/account/login.createaccount.php"; # Fully qualified url for "Create account" link'
    appendOrReplace wgArchiveOrgAuthExternalPasswordResetLink '$wgArchiveOrgAuthExternalPasswordResetLink = "https://example.com/reset_password"; # Fully qualified url for "Forgot password" link'
    appendOrReplace wgUserrightsInterwikiDelimiter '$wgUserrightsInterwikiDelimiter = "%";'
    appendOrReplace wgInvalidUsernameCharacters '$wgInvalidUsernameCharacters = "%:";'
    appendOrReplace wgUseCombinedLoginLink '$wgUseCombinedLoginLink = true;'
    appendOrReplace "wgGroupPermissions.*createaccount" '$wgGroupPermissions["*"]["createaccount"] = false;'
    appendOrReplace "wgGroupPermissions.*autocreateaccount" '$wgGroupPermissions["*"]["autocreateaccount"] = true;'
    appendOrReplaceEnd
    cat <<EOT
If that worked, enter './install_mediawiki.sh 24' to install ArchiveLeaf extension'
EOT
    exit
  fi
fi

if [ ${STEP} -le 25 ]; then
  echo step 25 Installing ArchiveLeaf extension
  cd $MEDIAWIKI/extensions
  # TODO merge into internetarchive branch
  #sudo git clone https://github.com/internetarchive/mediawiki-extension-archive-leaf.git ArchiveLeaf
  if [ -d "ArchiveLeaf" ]
  then
    cd ArchiveLeaf
    git pull
  else
    git clone https://github.com/mitra42/mediawiki-extension-archive-leaf.git ArchiveLeaf
    cd ArchiveLeaf
  fi
  maintenance/offline
  echo "If that worked, enter './install_mediawiki.sh 26' to fixup permissions"
  exit
fi
if [ ${STEP} -le 27 ]; then
  echo step 27 switching permissions to www-data, but whatever group this user is running as.
  sudo chown -R ${APACHEUSER}.${GROUP} ${MEDIAWIKI}
  echo "If that worked, enter './install_mediawiki.sh 28' to configure short urls"
  exit
fi
if [ ${STEP} -le 29 ]; then
  echo step 29 Configure the /wiki short URLs
  # https://www.mediawiki.org/wiki/Manual:Short_URL/Apache
  sudo a2enmod rewrite
  sudo sed -i -e 's!</VirtualHost>!    RewriteEngine on\n    RewriteRule ^/?wiki(/.*)?$ /mediawiki/index.php [L]\n</VirtualHost>!' /etc/apache2/sites-available/000-default.conf
  sudo systemctl restart apache2
  echo "If that worked, enter './install_mediawiki.sh 30' to xxx"
  exit
fi
if [ ${STEP} -le 31 ]; then
  echo step 31 Installing ArchiveLeaf CSS
cat <<EOT
The CSS may need to be manually edited, buy the previous install had this happen automatically, not sure where.

Open
To improve page rendering, add the following CSS to the `MediaWiki:Common.css` page on the wiki:
Open /wiki/MediaWiki:Common.css in your browser, and check it includes the following.
```css
.mw-jump {
  display: none;
}

.thumbinner {
  max-width: 100%;
}

img.thumbimage {
  width: 100%;
  height: auto;
}
```
When you are finished, come back here and enter './install_mediawiki.sh 20'
EOT
exit
fi
if [ ${STEP} -le 99 ]; then
  echo step 99
cat <<EOT
It should now be fully working
There are outstanding issues at: https://github.com/internetarchive/dweb-mirror/issues/286
EOT
exit
fi


