#!/usr/bin/env bash

# Can enter "./install_mediawiki 2" to start with step 2
STEP=${1:-0}


###### PLATFORM AUTODETECTION CODE, DUPLICATED IN in dweb-mirror/install.sh and dweb-mirror/mediawiki/mediawiki.conf

# Convert the portable uname results into go specific environment note Mac has $HOSTTYPE=x86_64 but not sure that is on other platforms
case `uname -m` in
"armv7l") ARCHITECTURE="arm";;    # e.g. Raspberry 3 or OrangePiZero. Note armv8 and above would use what IPFS has as arm64, armv7 and down want "arm"
"x86_64") ARCHITECTURE="amd64";;  # e.g. a Mac OSX
"i?86") ARCHITECTURE="386";;      # e.g. a Rachel3+
*) echo "Unknown processor type `uname -m`, needs configuring"; ARCHITECTURE="unknown";;
esac
# See also /sys/firmware/devicetree/base/model

# Now find OS type, note Mac also has a $OSTYPE
case `uname -s` in
"Darwin") OPERATINGSYSTEM="darwin";;   # e.g. a Mac OSX
"Linux") OPERATINGSYSTEM="linux";;     # e.g. Raspberry 3 or Rachel3+ or OrangePiZero/Armbian
*) echo "Unknown Operating system type `uname -s` - needs configuring"; OPERATINGSYSTEM="unknown";;
esac
# Hard to tell Armbian from Raspbian or a bigger Linux so some heuristics here
[ ! -e /usr/sbin/armbian-config ] || OPERATINGSYSTEM="armbian"
[ ! -e /etc/dpkg/origins/raspbian ] || OPERATINGSYSTEM="raspbian"

#Auto-Detect Rachel, IIAB etc and set $PLATFORM
PLATFORM="unknown"
[ ! -e /etc/rachelinstaller-version ] || PLATFORM="rachel"
[ ! -d /opt/iiab ] || PLATFORM="iiab"

#TODO Auto detect "Nuc"
echo "ARCHITECTURE=${ARCHITECTURE} OPERATINGSYSTEM=${OPERATINGSYSTEM} PLATFORM=${PLATFORM}"
## END OF AUTODETECTION CODE, DUPLICATED IN in dweb-mirror/install.sh and dweb-mirror/mediawiki/mediawiki.conf

# User and group running this and other shell functions as,
# On Nuc it was scribe / staff; on RPI typically pi / pi
USER=pi
GROUP=pi
APACHEUSER="www-data"
RUNNINGON=localhost
PASSWORD='Gr33nP@ges!'

## Autodetect where mediawiki is already, or should be installed
# Note mediawiki* intentionally not quoted so will expand
MEDIAWIKIINSTALLED=
if [ ${PLATFORM} == "iiab" ]
then
  if [ -d /library/mediawiki* ]
  then
    MEDIAWIKI=`echo /library/mediawiki*`
    # Note there is also a link to it at /library/www/html/mwlink
    MEDIAWIKIINSTALLED=1
  else
    echo "Need to install mediawiki through editing IIAB install files and installing through its ansible - TO BE DOCUMENTED"
    exit
  fi
else # !PLATFORM==iiab
  MEDIAWIKI=/var/lib/mediawiki
  # On Nuc had it at... but dont have test for Nuc yet
  #MEDIAWIKI=/usr/share/mediawiki
fi

# On Nuc was at /etc/mediawiki/LocalSettings.php
LOCALSETTINGS=${MEDIAWIKI}/LocalSettings.php
ZIPFILE=palmleaf-dir.tar.gz
#WAYBACK_HITCOUNTER=https://archive.org/web/20191230063858/https://extdist.wmflabs.org/dist/extensions/HitCounters-REL1_34-48dd6cb.tar.gz
WAYBACK_HITCOUNTER=https://web.archive.org/web/20191230063858if_/https://extdist.wmflabs.org/dist/extensions/HitCounters-REL1_34-48dd6cb.tar.gz

## Look for dweb-mirror Where are the mediawiki install files already installed
DMMAYBE="/opt/iiab/internetarchive ${HOME}"
for NODEMODULESPARENT in ${DMMAYBE}; do
  DWEBMIRROR=${NODEMODULESPARENT}/node_modules/@internetarchive/dweb-mirror
  [ -d ${DWEBMIRROR} ] && break
done
DWEBMIRRORMEDIAWIKI=${DWEBMIRROR}/mediawiki
if [ ! -d ${DWEBMIRRORMEDIAWIKI} ]
then
  echo "dweb-mirror must be installed before this, cant find it at any of ${DM_MAYBE}"
  exit
fi
if [ ${PLATFORM} == "iiab" ] ; then
  DATABASENAME=iiab_mediawiki
else
  DATABASENAME=palmleafdb
fi

echo "MEDIAWIKI=${MEDIAWIKI} MEDIAWIKIINSTALLED=${MEDIAWIKIINSTALLED} DWEBMIRROR=${DWEBMIRROR}"

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
  if grep "$1" ${LOCALSETTINGS}
  then
    echo "Swapping in place to: $2"
    sudo sed -i -e "s!^.*$1.*\$!$2!" ${LOCALSETTINGS}
  else
    echo "Appending: $2"
    echo $2 | sudo tee -a ${LOCALSETTINGS}
  fi
}

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
\$wgDebugLogFile = "/var/log/mediawiki.log";
EOT
set -e
set -x # Just for debugging

if [ ${STEP} -le 1 ]; then
  echo step 1 Fetching operating system packages
  if [ -n "${MEDIAWIKIINSTALLED:-}" ]; then
    echo "Mediawiki already installed at $MEDIAWIKI"
  else
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
      # Optional extras - mediawiki configuration checks for them, and nategood/httpful needs php-curl
      sudo apt-get install -y imagemagick php-apcu php-intl php-curl
      sudo service apache2 reload # Notice php-apcu
      pushd /tmp/;
        wget https://releases.wikimedia.org/mediawiki/1.34/mediawiki-1.34.0.tar.gz
        tar -xzf /tmp/mediawiki-*.tar.gz
        sudo mkdir ${MEDIAWIKI}
        sudo chown ${USER}.${GROUP} ${MEDIAWIKI}
        mv mediawiki-*/* ${MEDIAWIKI}
      popd
    fi
  fi

  # Probably need on all OS - except maybe not Darwin/OSX or Debian
  sudo apt-get install -y composer # Needed for ArchiveOrgAuth extension to install nategood/httpful

  cat <<EOT
  If this worked, enter './install_mediawiki.sh 2'
EOT
  exit
fi
if [ ${STEP} -le 3 ]; then
  echo step 3 configure mysql
  if [ -n "${MEDIAWIKIINSTALLED:-}" ]; then
    echo "Mediawiki already installed at $MEDIAWIKI so database should exist"
  else

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
  fi
  exit
fi

if [ ${STEP} -le 5 ]; then
  echo step 5 configure php

  echo Making sure handling big enough limits, make sure changes in the upwards direction.
  pushd /etc/php/7.*/apache2 # Hopefully only one of them
  sudo sed -i.bak -e 's/upload_max_filesize.*$/upload_max_filesize = 20M/' \
    -e 's/memory_limit .*/memory_limit = 128M/' \
    -e 's/.*extension=intl/extension=intl/' ./php.ini
  diff php.ini.bak php.ini || echo "Great it shows we made the change"
  popd

  if [ -n "${MEDIAWIKIINSTALLED:-}" ]; then
    echo "Mediawiki already installed at $MEDIAWIKI so assuming linked into apache alias, or symlink or nginx  config"
    curl -L http://localhost/wiki/Main_Page | grep 404 && echo "BUT there's a 404 at http://localhost/wiki/Main_Page so something is wrong"
  else

    sudo ln -sf ${MEDIAWIKI} /var/www/html/mediawiki
    ls -al /var/www/html/mediawiki
  fi
  echo If this worked, enter './install_mediawiki.sh 6'
  exit
fi

if [ ${STEP} -le 6 ]; then
  echo step 6 configure mediawiki.

  if [ -n "${MEDIAWIKIINSTALLED:-}" ]; then
    echo "Mediawiki already installed at $MEDIAWIKI so assuming maintenance install has been done"
    echo "Note that database and dbuser probably have a different name"
    curl -L http://localhost/wiki/Main_Page | grep 404 && echo "BUT there's a 404 at http://localhost/wiki/Main_Page so something is wrong"
    grep 'wgDB' ${LOCALSETTINGS}
  else

    pushd ${MEDIAWIKI}
    php 'maintenance/install.php' \
      --dbname=palmleafdb \
      --dbserver="localhost" \
      --installdbuser=palmleafdb \
      --installdbpass="${PASSWORD}" \
      --dbuser=palmleafdb \
      --dbpass="${PASSWORD}" \
      --scriptpath=/mediawiki \
      --lang=en \
      --pass="${PASSWORD}" \
      "Palm Leaf Wiki" \
      "palmleafdb"
    popd
    ls -al ${LOCALSETTINGS}
  fi
  echo 'If this worked and the file exists, enter "./install_mediawiki.sh 8", if it failed enter "./install_mediawiki.sh 7" for more instructions'
  exit
fi

if [ ${STEP} -le 7 ]; then
  echo step 7 configure mediawiki.
  echo "OK - so autoconfiguration failed, try the following instructions"

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
  if grep 'automatically generated by the MediaWiki' ${LOCALSETTINGS} # This is also true on IIAB
  then
    echo "Great found ${LOCALSETTINGS} that you updated"
  else
    echo "Did not find a valid ${LOCALSETTINGS}, you need to upload after the installation in the previous step'
    echo "Upload it, come back and enter './install_mediawiki.sh 9' again
    exit
  fi
  appendOrReplaceBegin
  if [ -n "${MEDIAWIKIINSTALLED:-}" ]; then
    # Note wgScriptPath on IIAB was /mwlink
    echo "Mediawiki installed - scriptpath set, so not overriding to /w"
    grep 'wgScriptPath =' ${LOCALSETTINGS}
  else
    appendOrReplace 'wgScriptPath =' '$wgScriptPath = "/w";' # match is to avoid matching wgResourcePath = $wgScriptPath
  fi
  appendOrReplace wgSitename '$wgSitename = "Palm Leaf Wiki";' # Change it as will be "Community Wiki" on IIAB
  appendOrReplace wgMetaNamespace  '$wgMetaNamespace = "PalmLeaf";' # Change it as will be "Community_Wiki" on IIAB
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

  # Make the log writable
  sudo touch /var/log/mediawiki.log
  sudo chown www-data.pi /var/log/mediawiki.log
  sudo chmod g+w  /var/log/mediawiki.log
  echo "If this worked enter './install_mediawiki.sh 10'"
  exit
fi
if [ ${STEP} -le 10 ]; then
  echo step 10 Apache2 or Nginx config
  if [ ${PLATFORM} == "iiab" -a -d "/etc/nginx" ]; then
    pushd /etc/nginx
      sudo tee -a ./conf.d/mediawiki-nginx.conf <<EOT >>/dev/null
location /mwlink/config { # Protect this from PHP
}
location /mwlink/upload { # Protect this from PHP
}
EOT
    popd
  else
    pushd /etc/apache2
      if [ -f conf-available/mediawiki.conf ]; then
        echo "Looks like conf-available/mediawiki.conf already installed, comparing ... if differences aren't a problem enter './install_mediawiki.sh 11'"
        diff conf-available/mediawiki.conf ${DWEBMIRRORMEDIAWIKI}/mediawiki.conf
        cd conf-enabled
        sudo ln -sf ../conf-available/mediawiki.conf .
      else if [ ${PLATFORM} == "iiab" ]; then
          sudo mv sites-available/mediawiki.conf sites-available/mediawiki.conf.BAK
          cat ${DWEBMIRRORMEDIAWIKI}/mediawiki.conf | sed -e "s#/var/www/html/#${MEDIAWIKI}/#"  | sudo tee sites-available/mediawiki.conf >/dev/null
          cd sites-enabled
          sudo ln -sf ../sites-available/mediawiki.conf .
          echo "If this worked enter './install_mediawiki.sh 11'"
        else
          sudo cp ${DWEBMIRRORMEDIAWIKI}/mediawiki.conf conf-available/mediawiki.conf
          echo "If this works enter './install_mediawiki.sh 11'"
          cd conf-enabled
          sudo ln -sf ../conf-available/mediawiki.conf .
        fi
      fi
    popd
  fi
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
      echo "Must have ${HOME}/palmleaf-pages.xml or ${HOME}/palmleaf-pages.xml.gz, upload it and then ./install_mediawiki.sh 11"
      exit
    fi
  fi
  # Exporting and importing https://www.mediawiki.org/wiki/Help:Export
  # Importing that xml dump https://www.mediawiki.org/wiki/Manual:Importing_XML_dumps
  pushd ${MEDIAWIKI}
    [ ${PLATFORM} != "iiab" ] || echo 'Seen problems with wgServerHost = $_SERVER["HTTP_HOST"] on iiab - unsure why or if significant'
    php maintenance/importDump.php --conf ${LOCALSETTINGS} --username-prefix="" --no-updates ${IMPORTFROM}
  popd
  echo If this worked enter './install_mediawiki.sh 12' to rebuildrecentchanges and initSiteStats
  exit
fi

if [ ${STEP} -le 13 ]; then
  echo step 13 - rebuild stuff
  pushd ${MEDIAWIKI}
    php maintenance/rebuildrecentchanges.php
    php maintenance/initSiteStats.php --update
    echo "USE ${DATABASENAME}; UPDATE actor SET actor_name='Old Maintenance script' WHERE actor_name='Maintenance script';" | sudo mysql -u root
  popd
  echo If this worked enter './install_mediawiki.sh 14' to import images
  echo note that the next step will take several hours so make sure you can leave it running
  exit
fi

if [ ${STEP} -le 15 ]; then
  echo step 15 - importing images

  if [ -f palmleaf-dir.tar.gz -a ! -d opt ]
  then
    echo "Untarring palmleaf-dir.tar.gz - this first step can take quite a few minutes"
    tar -xzf palmleaf-dir.tar.gz
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
If that worked, and the line looks good, come back here and enter './install_mediawiki.sh 18' to install HitCounters and run maintenance/update
EOT
exit
fi
if [ ${STEP} -le 19 ]; then
  echo step 19 - installing HitCounter extensions and running the maintenance/update process
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
if it worked, enter './install_mediawiki.sh 20 to install Mirador extension'
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
If that worked, enter './install_mediawiki.sh 22' to install ArchiveOrgAuth extension
EOT
    exit
  fi
fi
if [ ${STEP} -le 23 ]; then
  echo step 23
    pushd /etc/php/7.*/cli # Hopefully only one of them
    # Enable php ext-curl for command line
    sudo sed -i.bak -e 's/.*extension=curl/extension=curl/' ./php.ini
    diff php.ini.bak php.ini || echo "Great it shows we made the change"
    popd
    pushd ${MEDIAWIKI}
    sudo mkdir -p /var/www/.composer
    echo "Note next line can take a while (2mins or so) before responds with anything"
    # Carefull if change this, "nategood/httpful" will set to "^0.3.0" which then hits a bug where that format isn't recognized
    composer require "nategood/httpful=0.3.0"
    popd
    echo If that worked, enter './install_mediawiki.sh 24' to install ArchiveOrgAuth extension
    exit
fi
if [ ${STEP} -le 24 ]; then
  echo step 24
  pushd ${MEDIAWIKI}/extensions
    git clone https://git.archive.org/www/archiveorgauth.git ArchiveOrgAuth
    popd
    appendOrReplaceBegin
    appendOrReplace "wfLoadExtension.*ArchiveOrgAuth" 'wfLoadExtension( "ArchiveOrgAuth" );'
    appendOrReplace wgArchiveOrgAuthEndpoint '$wgArchiveOrgAuthEndpoint = "https://archive.org/services/xauthn/"; # Url for API endpoint, eg.: http://example.com/xnauth/ ( with trailing slash )'
    appendOrReplace wgArchiveOrgAuthAccess '$wgArchiveOrgAuthAccess = "<ACCESS_KEY>"; # S3 access key'
    appendOrReplace wgArchiveOrgAuthSecret '$wgArchiveOrgAuthSecret = "<SECRET_KEY>"; # S3 secret key'
    appendOrReplace wgArchiveOrgAuthExternalSignupLink '$wgArchiveOrgAuthExternalSignupLink = "https://archive.org/account/login.createaccount.php"; # Fully qualified url for "Create account" link'
    appendOrReplace wgArchiveOrgAuthExternalPasswordResetLink '$wgArchiveOrgAuthExternalPasswordResetLink = "https://archive.org/account/login.forgotpw.php"; # Fully qualified url for "Forgot password" link'
    appendOrReplace wgUserrightsInterwikiDelimiter '$wgUserrightsInterwikiDelimiter = "%";'
    appendOrReplace wgInvalidUsernameCharacters '$wgInvalidUsernameCharacters = "%:";'
    appendOrReplace wgUseCombinedLoginLink '$wgUseCombinedLoginLink = true;'
    appendOrReplace "wgGroupPermissions.*createaccount" '$wgGroupPermissions["*"]["createaccount"] = false;'
    appendOrReplace "wgGroupPermissions.*autocreateaccount" '$wgGroupPermissions["*"]["autocreateaccount"] = true;'
    appendOrReplace "wgMainCacheType" '$wgMainCacheType = CACHE_ANYTHING;'
    appendOrReplaceEnd
    cat <<EOT
If that worked, (and in particlar check the composer install worked)
Edit $MEDIAWIKI/LocalSettings.php to put the S3 keys in
Then enter './install_mediawiki.sh 24' to install ArchiveLeaf extension'
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
  sudo chmod -R g+w ${MEDIAWIKI}
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
To improve page rendering, add the following CSS to the 'MediaWiki:Common.css' page on the wiki:
Note this is the first time we have opened the wiki so its also a test that its basically working.
Open /wiki/MediaWiki:Common.css in your browser, and check it includes the following.

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

When you are finished, come back here and enter './install_mediawiki.sh 32' to link the Offline Archive to the Palmleaf Wiki
EOT
exit
fi
if [ ${STEP} -le 33 ]; then
  echo step 33
  pushd ${HOME}
  if [ -f "dweb-mirror.config.yaml" ]; then
    if grep palmleafwiki dweb-mirror.config.yaml; then
        sed -i.BAK -e 's#pagelink.*$#pagelink: "http://MIRRORHOST/wiki"#' dweb-mirror.config.yaml
    else
      if grep '\.\.\.' dweb-mirror.config.yaml; then
        sed -i.BAK -e 's#\.\.\.#    palmleafwiki\n        pagelink: "http://MIRRORHOST/wiki"\n...#' dweb-mirror.config.yaml
      else
        cp  diff dweb-mirror.config.yaml dweb-mirror.config.yaml.BAK
        cat <<EOT >>dweb-mirror.config.yaml
    palmleafwiki
        pagelink: "http://MIRRORHOST/wiki"
EOT
      fi
    fi
    diff dweb-mirror.config.yaml.BAK dweb-mirror.config.yaml
  else
    echo Once you have installed dweb-mirror you will need to add a variable  apps.palmleafwiki.pagelink: "http://MIRRORHOST/wiki"
  fi
  popd
cat <<EOT
If that appeared to work, come back here and enter './install_mediawiki.sh 34 to finish'
EOT
exit
fi
if [ ${STEP} -le 99 ]; then
  echo step 99
  pushd $MEDIAWIKI
    echo 'Run update one last chance - this is where we caught the bug in composer.json before'
    echo 'If reports problems at nategood/httpfil ^0.3.0 then the fix with composer in ArchiveLeaf didn't work
    maintenance/update.php
  popd
  echo "A quick bit of testing ..."
  service transliterator status
  echo "Next line should respond "wayan" otherwise transliterator probably not working
  curl http://localhost:3000/Balinese-ban_001 -d ᬯᬬᬦ᭄᭞
cat <<EOT
It should now be fully working Except ... bugs
$wgServer needs to be "http://192.168.0.14" not http://localhost - edit it in LocalSettings to be ip name or address of your box
http://192.168.0.14/transcriber/static/media/zwnj.0da8f3f5.svg isn't working
There may be other outstanding issues at: https://github.com/internetarchive/dweb-mirror/issues/286


To test ...
In browser go to  http://<IP_OF_BOX>/wiki
Should open main page

Click Random page
Should open a page, typically with a series of images
If shows url of localhost and fails to load, its usually that LocalSettings.php/$wgServer is set to localhost
If doesn't show "edit" above each image then its usually the nategood/httpful ^0.3.0 error in composer.json

Click edit on one of the leafs with writing (not the top one)
Should see image and balinese script text,
Click the 3 vertical dots in top right and "Show Transliteration"
Should show the balinese text transcribed to latin
If not then the transcriber service isn't running - we had bugs there but should be fixed (its setup in ArchiveLeaf/maintenance/offline)

EOT
exit
fi


