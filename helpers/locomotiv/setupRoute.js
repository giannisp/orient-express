/*jshint latedef: nofunc */

var fs = require("fs");
var path = require('path');
var colors = require('colors');

var _ = require('lodash');
var stripJSONComments = require('strip-json-comments');


module.exports = function(app, options) {

    var configFilePath = path.join(options.baseRoutesPath, options.routeName + '.json');
    var baseControllerPath = options.baseControllerPath;
    var baseMiddlewarePath = options.baseMiddlewarePath;
    var controllerName = options.routeName.charAt(0).toUpperCase() + options.routeName.slice(1) + 'Controller';
    var globalMiddleware = [];
    var uriPrefix = "";

    // holds the parsed configuration options for the routes
    var config = loadRouteConfigFile();

    // load global options
    setFileGlobalOptions();

    for (uri in config) {
        parseRoute(uri);
    }

    function parseRoute(uri) {

        for (var verb in config[uri]) {

            var routeConfig = config[uri],
                httpVerb = verb.toLowerCase(),
                verbConfig = routeConfig[verb],
                routePattern = uriPrefix + uri,
                middleware = null,
                handlerParts,
                handlerMethod,
                controllerMethods,
                controllerPath;

            if(_.isUndefined(verbConfig.handler)) {
                verbConfig.handler = controllerName + ':' + options.defaultHandler;
            }

            handlerParts = deriveControllerAndAction(verbConfig.handler);

            middleware = getMiddleware(verbConfig.middleware);

            controllerPath = path.join(baseControllerPath, handlerParts.controller + '.js');
            controllerMethods = loadControllerFile(controllerPath);

            handlerMethod = controllerMethods[handlerParts.action];

            registerRoute(httpVerb, routePattern, middleware, handlerMethod, handlerParts.action);
        }

    }
    /**
     * Loads the .json file with the routes declarations, strips the comments and parses
     * it into native objects
     *
    **/
    function loadRouteConfigFile() {

        try {
            return JSON.parse(stripJSONComments(fs.readFileSync(configFilePath, 'utf8')));
        } catch(e) {
            console.log('error'.red + '[Locomotiv] Cannot parse "' + configFilePath + '". Wrong syntax?');
        }

    }

    /**
     * Overrides default route configuration options with the explicit options set
     * in the routes configuration file under the global property '*'
    **/
    function setFileGlobalOptions() {

        if (_.isUndefined(config['*'])) {

            return true;

        } else {

            var g = config['*'];

            if (g.hasOwnProperty('controllersPath')) {
                baseControllerPath = path.join(options.processDir, g.controllersPath);
            }

            if (g.hasOwnProperty('controllerName')) {
                controllerName = g.controllerName;
            }

            if (g.hasOwnProperty('middlewaresPath')) {
                baseMiddlewaresPath = path.join(options.processDir, g.middlewaresPath);
            }

            if (g.hasOwnProperty('middleware')) {

                if (_.isString(g.middleware)) {
                    globalMiddleware.push(g.middleware);
                } else {
                    globalMiddleware = g.middleware;
                }
            }

            if (g.hasOwnProperty('URIPrefix')) {
                uriPrefix = g.URIPrefix;
            }

            // sanitize json route removing global setting
            delete config['*'];

            return true;
        }

    }

    function deriveControllerAndAction(hndlr) {

        var handler = {};

        if(_.isUndefined(hndlr)){
            handler.controller = controllerName;
            handler.action = options.defaultHandler;

            return handler;
        }

        var handlerParams = hndlr.split(':');

        // handler contains only action
        if (handlerParams.length === 1) {

            handler.controller = controllerName;
            handler.action = handlerParams[0];

            return handler;

        } else {

            handler.controller = handlerParams[0];
            handler.action = handlerParams[1];

            return handler;
        }
    }

    function getMiddleware(mdlwr) {

        var middleware = consolidateLocalGlobalMiddleware(mdlwr);
        var middlewareItems = [];

        if (_.isString(middleware)) {

            middlewareItems.push(parseMiddleware(middleware));

            return middlewareItems;

        } else if (_.isArray(middleware)) {

            middlewareItems.forEach(function(mdlwrItem){
                middlewareItems.push(parseMiddleware(mdlwrItem));
            });

            return middlewareItems;
        }

        return null;
    }

    function consolidateLocalGlobalMiddleware(routeMiddleware) {

        if (globalMiddleware.length > 0) {

            if(_.isString(routeMiddleware)) {
                routeMiddleware = [routeMiddleware];
            }

            return _.union(globalMiddleware, routeMiddleware);

        } else {

            return routeMiddleware;

        }
    }

    function parseMiddleware(mdlwr) {

        var mdlwrParts = mdlwr.split('.');

        if (mdlwrParts.length !== 2) {
            console.log('[!] Locomotive ERROR: Malformed middleware declaration "'+ mdlwr +'"');
            return;
        }

        var middlewareFile = getMiddlewarePath(mdlwrParts[0]);
        var middleware = require(middlewareFile);

        // return the method reference
        return middleware[mdlwrParts[1]];

    }

    function getMiddlewarePath(middleware) {

        if (middleware.substring(0,1) === '.') {

            // return dir from root project
            return path.join(options.processDir, middleware + '.js');

        } else {

            return path.join(baseMiddlewarePath, middleware + '.js');

        }

    }

    function registerRoute(verb, routePattern, middleware, routeHandler, action) {

        if (middleware) {

            app[verb](routePattern, middleware, routeHandler);

        } else {

            app[verb](routePattern, routeHandler);
        }

        if (options.verbose) {
            console.log('  Mapped route (' + verb.toUpperCase() + ' '+ routePattern +') from file "'+options.routeName.underline+'.json"'.underline+' to controller "'+ controllerName.underline+'.js:'.underline+action.underline+'"');
        }
    }





}