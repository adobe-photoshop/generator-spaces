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

/*
 * RIPPED INITIALLY FROM CREMA, pared down a bit
 */


/*jslint vars: true, node: true, plusplus: true, devel: true, nomen: true, indent: 4*/

(function () {
    "use strict";
    
    var Promise = require("bluebird"),
        path = require("path"),
        _ = require("lodash"),
        Renderer = require("generator-assets/lib/renderer"),
        DocumentManager = require("generator-assets/lib/documentmanager"),
        FileManager = require("generator-assets/lib/filemanager"),
        FileUtils = require("./fileutils");

    /**
     * AssetExtractor provides an API for extracting components on demand
     *
     * Note that this deals with the Q promises from generator-assets,
     * but otherwise uses internally, and returns, bluebird promises
     *
     * @param {Generator} generator
     * @param {object} config
     * @param {object} logger
     */
    var AssetExtractor = function (generator, config, logger) {
        this._generator = generator;
        this._config = config;
        this._logger = logger;
        this._documentManager = new DocumentManager(generator, config, logger);
        this._fileManagers = {};
    };

    /**
     * Generator
     * @type {Generator}
     */
    AssetExtractor.prototype._generator = null;

    /**
     * Plugin config
     * @type {object}
     */
    AssetExtractor.prototype._config = null;

    /**
     * Plugin Logger
     * @type {Logger}
     */
    AssetExtractor.prototype._logger = null;

    /**
     * Instance of a DocumentManager from generator-assets
     * @type {DocumentManager}
     */
    AssetExtractor.prototype._documentManager = null;

    /**
     * Map of file managers, one per document, keyed by document ID
     * @type {{number: FileManager}}
     */
    AssetExtractor.prototype._fileManagers = null;

    /**
     * Get this document's fileManager from local store, or build it
     *
     * @param {Document} document
     * @return {FileManager} instance of FileManager
     */
    AssetExtractor.prototype.getFileManager = function (document) {
        if (_.has(this._fileManagers, document.id)) {
            return _.get(this._fileManagers, document.id);
        } else {
            var fileManager = new FileManager(this._generator, this._config, this._logger);

            fileManager.updateBasePath(document);
            fileManager._queue.unpause();

            var _changeHandler = function (change) {
                if (change.file) {
                    fileManager.updateBasePath(document);
                }
            };

            // TODO clean these up eventually?
            // Or maybe the underlying document gets cleaned up by DocumentManager?
            document.on("change", _changeHandler);

            _.set(this._fileManagers, document.id, fileManager);
            return fileManager;
        }
    };

    /**
     * Renders a component object, representing an asset, to a temporary location
     *
     * @param {Document} document
     * @param {!Component} component
     * @param {number} component.documentId Document to export, or if layerId is defined, the document that the layerId
     *      belongs to.
     * @param {number=} component.layerId Layer to export.
     * @param {!string} component.extension The type of asset to export (e.g. "jpg").
     * @param {number=} component.quality Quality settings for the exported asset.
     *      For extension "png", set quality to 8 to produce a PNG-8 image.
     *      For extension "jpg", set quality from 0-100.
     * @param {number=} component.scale The scale of the exported asset.
     * @param {number=} component.width The width of the exported asset.
     * @param {number=} component.height The height of the exported asset.
     * return {Promise} This promise is resolved when the layer is finished rendering with the temp file location
     */
    AssetExtractor.prototype.generateComponent = function (document, component) {
        // Resolve documentId and layerId to DOM objects.
        component.document = document;

        if (component.layerId) {
            var result = document.layers.findLayer(component.layerId);
            if (!result) {
                throw new Error("Layer with id %d not found.", component.layerId);
            }
            component.layer = result.layer;
        }

        var rendererFactory = (component.extension === "svg") ?
                Renderer.createSVGRenderer : Renderer.createPixmapRenderer,
            renderer = rendererFactory(this._generator, this._config, this._logger, document);

        // wrap in bluebird Promise
        return Promise.resolve(renderer.render(component));
    };

    /**
     * Exports a component object, representing an asset, to its specified location.
     *
     * @param {!Component} component
     * @param {number} component.documentId Document to export, or if layerId is defined, the document that the layerId
     *      belongs to.
     * @param {number=} component.layerId Layer to export.
     * @param {!string} component.extension The type of asset to export (e.g. "jpg").
     * @param {!string} component.path The full destination path for the exported asset.
     * @param {number=} component.quality Quality settings for the exported asset.
     *      For extension "png", set quality to 8 to produce a PNG-8 image.
     *      For extension "jpg", set quality from 0-100.
     * @param {number=} component.scale The scale of the exported asset.
     * @param {number=} component.width The width of the exported asset.
     * @param {number=} component.height The height of the exported asset.
     * return {Promise} This promise is resolved when the layer is finished exporting.
     */
    AssetExtractor.prototype.exportComponent = function (component) {
        var documentPromise;
        // Resolve documentId and layerId to DOM objects.
        if (component.documentId) {
            documentPromise = this.getDocument(component.documentId);
        } else {
            // This is for backwards compatibility - perhaps can be removed at some point...
            documentPromise = this.getActiveDocument().then(function (document) {
                component.documentId = document.id;
                return document;
            });
        }

        return documentPromise
            .bind(this)
            .then(function (document) {
                var generatePromise = this.generateComponent(document, component)
                    .catch(function (e) {
                        throw new Error("Error generating component: " + e.message);
                    });

                return [
                    generatePromise.get("path"),
                    this.getFileManager(document)
                ];
            })
            .spread(function (temporaryFilePath, fileManager) {
                var movePromise;
                if (component.baseDir) {
                    // explicitly move to an absolute path
                    var desiredFilePath = path.join(component.baseDir, component.fileName);
                    movePromise = fileManager.moveFileAbsolute(temporaryFilePath, desiredFilePath);
                } else {
                    // Use the fileManager's built in notion of a base directory
                    movePromise = fileManager.moveFileInto(temporaryFilePath, component.fileName);
                }
                return Promise.resolve(movePromise);
            });
    };
    
    /**
     * Exports components objects, representing assets, to their specified locations.
     *
     * @param {Array} components See exportComponent for details about Component objects.
     *
     * return {Promise} Resolved when all components have either been exported or failed to export.
     */
    AssetExtractor.prototype.exportComponents = function (components) {
        var _components = Array.isArray(components) ? components : [components],
            componentPromises = _components.map(this.exportComponent, this);

        return Promise.any(componentPromises)
            .bind(this)
            .then(function (componentResult) {
                FileUtils.openFolderOnceInOS(path.dirname(componentResult));
                return Promise.all(componentPromises);
            })
            .catch(Promise.AggregateError, function (e) {
                var errors = e.map(function (error) {
                        return error.message;
                    }),
                    message = "Failed to export components: " + errors;

                this._logger.info(message);
                throw new Error(message);
            });
    };

    /**
     * Gets a document by id.
     *
     * return {Promise} Resolved with the specified document or rejected if it is not available.
     */
    AssetExtractor.prototype.getDocument = function (id) {
        // wrap w/ bluebird...
        var p = this._documentManager.getDocument(id);
        return Promise.resolve(p);
    };

    /**
     * Gets the currently open document in Photoshop.
     *
     * return {Promise} Resolved with the active document or rejected if none is open.
     */
    AssetExtractor.prototype.getActiveDocument = function () {
        // wrap w/ bluebird...
        var p = this._documentManager.getActiveDocument();
        return Promise.resolve(p);
    };

    module.exports = AssetExtractor;
}());
