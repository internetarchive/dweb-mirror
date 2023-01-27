# Installation and Development FAQ

Please always feel free to ask questions on the 
[dweb-mirror repo](https://github.com/internetarchive/dweb-mirror). 

#### Index
1. How to connect to a RPI when do not have ethernet


#### 1. How to connect to a RPI when do not have ethernet

A common scenario, you've got your RPI, and your laptop, 
and a cellphone with data (or a WiFi at your accomodation),
but you do not have a screen, keyboard, mouse, 
and in particular no local ethernet, at least until you get onsite. 
BUT ... hopefully your laptop has an Ethernet port, or you brought a USB/Ether adapter.
and an ethernet cable.  (I travel with both of these for just this kind of scenario)

And even if you could configure it, your RPI cannot talk upstream via WiFi
and offer a local access point. 

The following instructions assume a Mac, a PR with edits for a Windows or Linux box
would be appreciated. 

* Setup your Phone to Tether or find the WiFi SSID & password
* Connect your laptop to the WiFi
* On a Mac: Preferences -> Sharing -> Internet -> from WiFi to USB 10/100 LAN
* Plug your ethernet cable between laptop and RPI
* Power up the RPI
* You should see the RPI's WiFi access point turn up, 
  BUT do not connect as that will lose your upstream connection.
* Now we need the RPI's address, this is non trivial, 
  and there are a number of ways to try and find it. 
  1. Look for the dhcp-leases on your laptop.
    * On Mac OSX, look in /private/var/db/dhcpd_leases
    * On most Linux it will be /var/lib/dhcpd/dhcpd.leases
  2. OR try pinging it 
    * With OLIP ping olip.local should work (or whatever the box is called)
    * With IIAB ping box or box.local or box.lan might work.   
  3. OR try sshing into it
    * The RPI's WiFi hotspot should have shown up on the laptop
    * Find the IP address of the WiFi hotspot router in the RPI
        * On a Mac: Open Network Preferences; WiFi; Advanced; TCP/IP; Router;
    * Lets assume this is: 192.168.123.1
    * ssh pi@192.168.123.1
        * ifconfig, look for eth0 (or maybe en0), and the inet address         
    * reconnect laptop to hotel/cellphone wifi
* Once you have the address, you can ssh into it
* ping www.google.com or some other known machine to check DNS etc are working



