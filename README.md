# map-tiles-proxy
Nodejs map tiles caching proxy, to use as middleware or standalone, locally or on a remote server.

You can pass the configuration either when you require the module:
```var cache=require('map-tiles-proxy')(config);```
or put in in file cache.config.json.

If both exists, definitions from the file will override defaults passed at require time.

Configuration example:
```
   {                                                                                                 
    middleware: false,
    cacheDir: 'cache',
    urlFromQueryString: true,
    routes: {
      osm: {
        dir: 'osm', // when this is ommited the route name is used as cache subdirectory name
        url: [
          'a.tile.openstreetmap.org/',
          'b.tile.openstreetmap.org/',
          'c.tile.openstreetmap.org/'
        ]
      }
    }
  }  
```

You can run it as a middleware (eg: for nodejs http or expressjs)

Or you can run it standalone with ```npm start``` for development.

In production you may want to run it with IBM's StrongLoop Process Manager (http://strong-pm.io/getting-started/) or another nodejs cluster manager, since probably you want to load or to serve a lot of tiles simultaneously

The example configuration above allow the following url formats:

A: ```http://localhost:port/?url=http://a.tile.openstreetmap.org/0/0/0.png&dir=osm```
 
  Will pipe the tile to the client and save it to (or read it from) cache/osm/0/0/0.png. If dir=osm is ommitted, the destination path will be cache/a.tile.openstreetmap.org/0/0/0.png.
  
  This can be disabled with config.urlFromQueryString=false;

B: ```http://localhost:port/osm/0/0/0.png```

  Will pipe the http://a.tile.openstreetmap.org/0/0/0.png tile to the client and save it to (or read it from) cache/osm/0/0/0.png

C: ```http://a.tile.openstreetmap.org/0/0/0.png```

  Will pipe the http://a.tile.openstreetmap.org/0/0/0.png tile to the client and save it to (or read it from) cache/osm/0/0/0.png
