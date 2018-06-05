# dweb-transport

Welcome to the Internet Archive's Decentralized Wed (Dweb) libraries. 

This is the old Repository, it has some legacy material, examples and partially started projects.

Only the examples are documented below so-far <TODO-DOCS>

## Running the examples
The examples can run either from the [dweb.me/examples](https://dweb.me/examples) server, 
or once the source is checked out, locally from your file system.

By default each of these examples runs multiple transports, and is smart if it cannot connect to one or the other.

- Simple text creation and retrieval: [example_block.html](https://dweb.me/examples/example_block.html)
- Simple dict creation and retrieval: [example_smartdict.html](https://dweb.me/examples/example_smartdict.html)
- List creation and retrieval: [example_list.html](https://dweb.me/examples/example_list.html)
- UI for Academic docs - centralised search; decentralized retrieval: []example_academic.html](https://dweb.me/examples/example_academic.html)
- Authentication: Managing locks and keys [example_keys.html](https://dweb.me/examples/example_keys.html)
- Versions of a single document: [example_versions.html](https://dweb.me/examples/example_versions.html)
- [objbrowser.html](https://dweb.me/examples/objbrowser.html)

**Browser Support**: This should work on Chrome and Firefox (Safari doesn't support many newer features but appears to work), 

**Transport choice**: You can deselect transports by clicking the Green indicator on an example. 
To prevent it connecting in the firstplace, you can supply paused=HTTP or paused=IPFS or paused=WEBTORRENT or paused=YJS to the url.

**Verbosity**: You can get debugging output by appending verbose=true to the URLs, 
this shows up in your console and also (for HTTP) in our server logs.

### BLOCK example
- In your browser, open [examples/example_block.html](https://dweb.me/examples/example_block.html):
- Type some text into the editor and hit Save  
- A hash should appear below.  
- If it doesn't then run with the [verbose argument](https://dweb.me/examples/example_block.html?verbose=true)
and open the browser console (e.g. Firefox/tools/Web Developer/Web Console)  
- Click "FetchIt" and the data should be returned.

### SMART DICT example
- In your browser, open [example_smartdict.html](https://dweb.me/examples/example_smartdict.html)
- Type some text into the name, and a HTML color nmae into the color (e.g. "red") and hit Save  
- A hash should appear below.  
- Click "FetchIt" and the data should be returned and displayed.  
- Hover over "Object Browser" to see the structure of the object.

### COMMON LIST example
- In your browser, open the file:  [example_list.html](https://dweb.me/examples/example_list.html):
- Click New and enter a name for your list  
- A blank list should appear along with the name and hashes (retrieved from Dweb)  
- Enter something in the text field and hit Send  
- The item should be announced to the list and appear in the text field above.
- The link icons next to the private hash can be opened on another machine and gives 
the user ability to also write to the list.
- The link icon next to the public hash will only give them the ability to display the list.
- Hover over "Object Browser" to see the structure of the object.

### ACADEMIC DOCS example

This is a work in progress, dependent on the incompleteness of both the Academic Document virtual collection at Archive.org and 
the bugs/issues in IPFS.

- In your browser, open the file:  [example_academic.html](https://dweb.me/examples/example_academic.html)
- Enter a search term 
- A list of papers should be returned, along with their DOI.
- Choose one that hs a check-mark next to it, we don't have the others at the Archive.
- Clicking on the DOI will find metadata on it. 
- As you search for these DOI's the paper is pushed into our contenthash server, and IPFS.
- You should see metadata on that paper, and a list of ways to receive it.
- The first three fetch from: the Archive's contenthash server; and from two IPFS http gateways.
- The last link fetches directly in the browser without coming to the Archive or any other single point of failure.

### AUTHENTICATION example
- In your browser, open the file:  [examples/example_keys.html](https://dweb.me/examples/example_keys.html)
- follow the instructions on the page.

### VERSIONS exampe
- In your browser, open the file [examples/example_versions.html](https://dweb.me/examples/example_versions.html)
- follow the instructions on the page.

## Installing a compilable version
- Checkout the repository
- If you haven't already, then install [npm](https://nodejs.org/en/download) and upgrade node to Node 7 or later (for support of async/wait).
- And on a Mac you'll probably need Xcode from the App store. 
- No idea what you need on Windows (Please update this if you know)
- Then install the dependencies: ```> npm install --dev```
- Note that this gets a forked version of libsodium-wrappers from [Mitra's repository][https://github.com/mitra42/libsodium.js], 
as the current libsodium-wrappers release doesn't have urlsafebase54.
- Often the first run of ```> npm install --dev``` generates a lot of warnings and a second, 
virtually clean run gives more confidence that the install worked.
- Now compile the javascript library for the browser: ```> npm run bundle_transport_ipfs```
- If this worked without errors, try the node specific test. ```> npm run test```
- This should start a IPFS instance, and generate some messages ending in "delaying 10 secs" and "Completed test".
- It will leave the IPFS instance running and usually will need a Ctrl-C to exit.

SORRY - AT THE MOMENT THE INSTRUCTIONS ABOVE WONT WORK, LETS TALK IF YOU WANT TO DO THIS

## See also:
< TODO >

## API
###htmlutils.js
###loginutils.js

