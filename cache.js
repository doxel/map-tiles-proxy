/*
 * cache.js
 *
 * Copyright (c) 2016 ALSENET SA
 *
 * Author(s):
 *
 *      Rurik Bugdanov <rurik.bugdanov@alsenet.com>
 * *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Additional Terms:
 *
 *      You are required to preserve legal notices and author attributions in
 *      that material or in the Appropriate Legal Notices displayed by works
 *      containing it.
 *
 *      You are required to attribute the work as explained in the "Usage and
 *      Attribution" section of <http://doxel.org/license>.
 */
"use strict";

module.exports=function(config){

  var http = require('http');
  var url = require('url');
  var path=require('path');
  var fs=require('fs');
  var dl=require('download-q');
  var extend=require('extend');

  config=config||{};

  /*
  config={
    urlFromQueryString: true,
    routes: {
      osm: {
        url: [
          'a.tile.openstreetmap.org/',
          'b.tile.openstreetmap.org/',
          'c.tile.openstreetmap.org/'
        ]
      }
    }
  }
  */

  if (fs.existsSync('./cache.config.json')) {
    config=extend(config,require('./cache.config.json'));
  }

  for (var routeName in config.routes) {
    var route=config.routes[routeName];
    if (route.url) {
      if (typeof(route.url)=="string"){
        route.url=[route.url];
      }
    }
  }

  var cacheDir=config.cacheDir||path.join(__dirname,'cache');

  fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir);

  if (config.middleware) {
    console.log('cache.js: running as middleware');
    return {
      middleware: {
        get: onRequest
      }
    };

  } else {
    var port=config.port||3129;
    http.createServer(onRequest).listen(port);
    console.log('Server listening on port '+port);
    return;
  }

  function mkdir(dirname,callback){
    var dir='';
    var i=0;

    var _path=dirname.split('/');
    if (dirname.charAt(0)=='/') {
      _path[0]='/';
    }

    function next() {
      ++i;
      iter();
    }

    function iter(){
      if (i<_path.length) {
        dir=path.join(dir,_path[i]);
        fs.exists(dir,function(doexists){
          if (doexists) {
            next();
          } else {
            fs.mkdir(dir,next);
          }
        });
      } else {
        callback();
      }
    }

    if (fs.exists(dirname,function(doexists){
      return (doexists)?callback():iter();
    }));

  } // mkdir

  function onRequest(req, res, next) {

    var queryData;
    var origin;
    var filepath;
    var cacheSubdir;

    function abort(e) {
      console.log('abort');
      console.log(e.stack);
      res.statusCode=500;
      res.statusMessage=e.message;
      res.end(e.message);
    }


    // allow urls like http://localhost:port/?url=http://a.tile.openstreetmap.org&dir=osm
    if (config.urlFromQueryString && req.url.indexOf('?')>=0) {
      queryData = url.parse(req.url, true).query;
      if (queryData.url) {
        try {
          var _url=queryData.url.match(/([^:]+:\/+([^\/]+))\/(.*)/);
          if (_url) {
//            console.log(_url);
            origin=_url[1];
            cacheSubdir=queryData.dir||_url[2];
            filepath=_url[3];
          }
        } catch(e){
          abort(e);
          return;
        }
      }
    }

    // else try to match the requested document path with config routes
    if (!queryData || !queryData.url) {
//      console.log(req.url);
      var _url=req.url.match(/\/([^\/]+)\/(.*)/);
      if (_url) {
        var protocol=req.connection.encrypted?'https://':'http://';

        // allow url=http://localhost:port/osm/0/0/0.png
        var route=config.routes[_url[1]];
        if (route) {
          var routeName=_url[1];
          origin=protocol+route.url[0];
          cacheSubdir=route.dir||routeName;
          filepath=_url[2];
        } else {

          // allow url=http://a.tile.openstreetmap.org/0/0/0.png
          var remoteOrigin=_url[1];
          for (var routeName in config.routes) {
            if (!config.routes.hasOwnProperty(routeName)) continue;

            var route=config.routes[routeName];
            for (var i in route.url) {
              if (!route.url.hasOwnProperty(i)) continue;
              var route_url=route.url[i];

              var len=route_url.length;
//              console.log(req.url.substr(1,len),route_url,len);
              if (req.url.substr(1,len)==route_url) {
//                console.log(req.url);
                origin=protocol+remoteOrigin;
                cacheSubdir=route.dir||routeName;
                filepath=_url[2];
                break;
              }
            }

            if (filepath) {
              break;
            }
          }
        }
      }
    }

    if (!filepath || !filepath.length) {
      if (next) {
        next(req,res);
      } else {
        abort(new Error("ERROR: cannot redirect : "+req.url));
      }
      return;
    }

    try {
      var filecache=path.join(cacheDir,cacheSubdir,filepath);

      // destination path must not point below cacheDir
      if (filecache.substr(0,cacheDir.length)!=cacheDir) {
        throw(new Error('ERROR: Path not authorized: '+filecache));
      }

      fs.exists(filecache,function(doexists){
        if (doexists) {
          // send cached file
          console.log('cached: ',filecache);
          fs.createReadStream(filecache).pipe(res);

        } else {
          // download file, pipe to client and save to cache
          mkdir(path.dirname(filecache),function(){
            console.log('caching:',filecache);
            dl.download({
              download: {
                url: origin+'/'+filepath,
                dest: filecache,
                pipe: res
              }
            })
            .then(function(options){
              var response=options.download.response;
              if (response.statusCode<200 || response.statusCode>=300) {
                try {
                  // nothing to delete normally
                  fs.unlink(filecache,function(err){
                    console.log(err);
                  });
                } catch(e) {
                  console.log(e);
                }
                abort(new Error('ERROR: '+response.statusCode + ' ' + response.statusMessage));
              }
            })
            .fail(abort)
            .done();
          });
        }
      });

    } catch(e) {
      abort(e);
    }

  }

}
