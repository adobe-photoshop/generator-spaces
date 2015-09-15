/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint node: true*/

(function () {
    "use strict";

    var pkg = require("./package"),
        domainDefinition = require("./domaindefinition");

    var PORT = 59596;

    exports.init = function (generator, config, logger) {
        process.nextTick(function () {
            logger.info("Starting websocket server...");
            generator.startWebsocketServer(pkg.name, PORT, domainDefinition, "file://")
                .then(function (port) {
                    logger.info("Started websocket server on port", port);
                    return generator.getCustomOptions(pkg.name);
                })
                .get("websocketServerPort")
                .then(function (port) {
                    logger.info("For kicks, fetched stored port from generator: ", port);
                })
                .catch(function (err) {
                    logger.error(err, err.stack);
                });
        });
    };
}());
