if (require.main === module ) {
  // run standalone
  var cache=require('./cache.js')();
} else {
  // run as a module
  module.exports=function(config){
    return require('./cache.js')(config);
  }
}


