PlaceLeo
========
Open-source Node.JS web service for serving up placeholder images in either color or grayscale

Dependencies
------------
- Node.JS
- [Express](http://expressjs.com/)
- [Moment.js](http://momentjs.com/)
- [Imagemagick](https://github.com/rsms/node-imagemagick) (Requires native imagemagick CLI tools)
- [Consolidate.js](https://npmjs.org/package/consolidate)
- [EJS](https://github.com/visionmedia/ejs)
- [Mongolian DeadBeef](https://github.com/marcello3d/node-mongolian)
- [New Relic](https://newrelic.com/nodejs) *(Optional)*

Install with `npm install express moment imagemagick consolidate ejs mongolian`

Getting Started
---------------
1. Make sure the directories `cache/` and `img/` exist, and are empty.
2. Fill up `img/` with the images you'd like to use. They can be any size, but the bigger they are the better they'll look. 600-800px seem to work best.
3. in `app.js`, go to the `app.listen` line and change it according to your needs. In most cases, `app.listen(80)` will work fine.
4. In the project's directory root, run `node app.js`
5. Open up a web browser, and visit `http://[your IP]/update` to scan the `img/` directory and load the images' metadata into the database. Revisit this URL any time you add new images to the directory that you'd like to use.
6. You should be done! Configure DNS and HTTP routing as you normally would for a Node.JS app, and start embedding images on your sites.

Important Notes
---------------
- There's currently no cache management, request throttling, or any other security measures to prevent abuse. Someone could easily write a small script to fill up your cache directory with thousands of different resolution images and hog your CPU.
- Due to the bandwidth-intensive nature of this application, it is **highly** recommended that you use a CDN. [CloudFlare](https://www.cloudflare.com/) is free, and works quite well.
- `/update` currently doesn't check for removed images. If you'd like to remove an image, you'll currently need to run `use leo` and then `db.images.remove()` from the MongoDB shell to wipe the database clean, and then request `/update` again.
- If you'd like more insight into what's going on, sign up for a [free New Relic account](https://newrelic.com/nodejs) and follow the instructions to install their Node.JS library. If the application sees New Relic's configuration file in its directory when it starts, it'll load the library and send data automatically.
