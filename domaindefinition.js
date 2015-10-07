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

/*jslint node: true */

"use strict";

var WebHandler = require("./lib/webhandler"),
    domainName = require("./package").name;

/**
 * Initialize this plugin's domain
 */
var init = function (domainManager, generator, logger) {
    var webHandler = new WebHandler(generator, {}, logger);

    if (!domainManager.hasDomain(domainName)) {
        domainManager.registerDomain(domainName, { major: 0, minor: 1 });
    }

    domainManager.registerCommand(
        domainName,
        "export",
        function (payload, callback) {
            webHandler.exportHandler(payload).nodeify(callback);
        },
        true,
        "Export the given layer with some options!",
        [
            {
                name: "payload",
                type: "object",
                description: "FIXME"
            }
        ]
    );

    domainManager.registerCommand(
        domainName,
        "promptForFolder",
        function (payload, callback) {
            webHandler.promptForFolder(payload).nodeify(callback);
        },
        true,
        "Prompt the user to choose a folder",
        [
            {
                name: "payload",
                type: "object",
                description: "should contain one prop: folderPath"
            }
        ]
    );
};

exports.init = init;
