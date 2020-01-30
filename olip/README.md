
# OLIP installation

This directory includes files need to install dweb-mirror on top of OLIP
Just a Work-In-Progress currently 

#### Files

* descriptor.json - json file used to specifiy the dweb-mirror package. 
  copied from 

#### Places
* https://gitlab.com/bibliosansfrontieres/olip/dweb-mirror - repo on OLIP - just dockerfile

* https://gitlab.com/bibliosansfrontieres/olip/olip-deploy/blob/master/app-developer.rst contains descriptor (bottom)

* http://bibliosansfrontieres.gitlab.io/olip/olip-documentation/olip/installation/ Installation instructions

#### Work in progress instructions 

* Put Raspbian on card - see other instructions
* ssh into it
* http://bibliosansfrontieres.gitlab.io/olip/olip-documentation/olip/installation/ 
  * curl -sfL https://gitlab.com/bibliosansfrontieres/olip/olip-deploy/raw/master/go.sh | sudo bash -s -- --name olip --url olip.local --descriptor http://drop.bsf-intranet.org/olip/conf-arm32v7
  * Check the last line - if some of the tasks failed you may want to rerun it (I found it failed on net access occasionally)
  * wifi access point doesnt come up
  * reboot
  * wifi hotspot OLIP appeared 
  * olip.local wasn't reachable, but my laptop is on wifi, while RPI is on ethernet, maybe would have worked if it was connected to WiFi as well
  * Connected to the OLIP Wifi and go to http://olip.local
  * login as admin/admin 
  * Catalog -> dweb-mirror (name should change to Internet Archive) -> Download
  * Catalog -> Install
  
  

