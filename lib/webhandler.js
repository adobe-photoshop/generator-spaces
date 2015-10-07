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

    var Promise = require("bluebird"),
        filenameSanitizer = require("sanitize-filename"),
        jsEscape = require("js-string-escape");

    var AssetExtractor = require("./assetextractor");

    /**
     * A WebHandler provides methods that handle the commands defined in a domaindescriptor.
     * Generally these methods should parse the websocket message payload,
     * and then coordinate its fulfillment with the underlying service (eg AssetExtractor)
     *
     * @param {Generator} generator
     * @param {object} config
     * @param {object} logger
     */
    var WebHandler = function (generator, config, logger) {
        this.generator = generator;
        this.config = config; // useless?
        this.logger = logger;
        this.assetExtractor = new AssetExtractor(generator, config, logger);
    };

    /**
     * Execute a generator request to open an OS dialog
     * allowing the user to choose a file system folder.
     * If a folderPath is provided in the payload, the dialog will open in that location.
     * If the user "cancels" the dialog, this promise will reject
     *
     * @param {object} payload
     * @param {string=} payload.folderPath optional path at which to open the file dialog
     *
     * @return {Promise.<string>} resolves with the chosen file path, or rejects if the user cancels FIXME right?
     */
    WebHandler.prototype.promptForFolder = function (payload) {
        var escapedInitialFolder = jsEscape(payload.folderPath || "/"),
            jsxString = String("var folderObj = Folder(\"")
                .concat(escapedInitialFolder, "\").selectDlg(); folderObj ? folderObj.fsName : \"\"");

        return Promise.resolve(this.generator.evaluateJSXString(jsxString))
            .then(function (selectedFolder) {
                if (!selectedFolder) {
                    throw new Error("cancel");
                }
                return selectedFolder;
            });
    };

    /**
     * Given the websocket payload, apply some defaults and sanitation,
     * to build up a component, and coordinate its extraction
     * TODO maybe this could do almost nothing Spaces specific
     *
     * @param {object} payload
     * @param {number} payload.documentID
     * @param {number=} payload.layerID
     * @param {number=} payload.scale defaults to 1
     * @param {string} payload.format file export format (~= extension)
     * @param {string} payload.fileName this is the "desired" fileName, without file type extension
     * @param {string=} payload.baseDir if supplied, will save extracts here, otherwise use generator-assets logic
     * @param {number=} payload.quality
     *
     * @return {Promise.<string>} path at which the file was exported
     */
    WebHandler.prototype.exportHandler = function (payload) {
        var fileName = filenameSanitizer(payload.fileName + "." + payload.format),
            component = {
                documentId: payload.documentID,
                layerId: payload.layerID,
                scale: payload.scale || 1,
                extension: payload.format || "png",
                fileName: fileName,
                baseDir: payload.baseDir
            };

        if (payload.quality) {
            component.quality = payload.quality;
        }

        this.logger.log("Extracting component:  " + JSON.stringify(component));
        
        return this.assetExtractor.exportComponents([component])
            .bind(this)
            .tap(function (results) {
                this.logger.log("Component extracted: %s", JSON.stringify(results));
            });
    };

    module.exports = WebHandler;
}());

