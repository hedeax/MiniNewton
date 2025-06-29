/*
 * Utility Functions Module for MiniNewton
 * Common helper functions for logging, error handling, and After Effects operations
 */

var Utils = (function() {
    
    var self = {};
    
    /**
     * Log message to console or ExtendScript Toolkit
     */
    self.log = function(message) {
        if (typeof $.writeln !== "undefined") {
            $.writeln("[MiniNewton] " + message);
        }
    };
    
    /**
     * Show error dialog
     */
    self.showError = function(message) {
        alert("MiniNewton Error:\n" + message);
        self.log("ERROR: " + message);
    };
    
    /**
     * Show info dialog
     */
    self.showInfo = function(message) {
        alert("MiniNewton:\n" + message);
        self.log("INFO: " + message);
    };
    
    /**
     * Get active composition
     */
    self.getActiveComp = function() {
        if (!app.project) {
            return null;
        }
        
        return app.project.activeItem;
    };
    
    /**
     * Validate composition for physics simulation
     */
    self.validateComp = function(comp) {
        if (!comp) {
            return "No active composition";
        }
        
        if (!(comp instanceof CompItem)) {
            return "Active item is not a composition";
        }
        
        if (comp.selectedLayers.length === 0) {
            return "No layers selected in composition";
        }
        
        return null; // No errors
    };
    
    /**
     * Check if layer is suitable for physics simulation
     */
    self.isValidPhysicsLayer = function(layer) {
        try {
            // Check if layer has transform properties
            var transform = layer.property("Transform");
            if (!transform) return false;
            
            // Check for position property
            var position = transform.property("Position");
            if (!position) return false;
            
            // Check layer dimensions
            if (layer.width <= 0 || layer.height <= 0) return false;
            
            // Check if layer is enabled and visible
            if (!layer.enabled) return false;
            
            return true;
            
        } catch (error) {
            self.log("Layer validation error: " + error.message);
            return false;
        }
    };
    
    /**
     * Get layer bounds in composition space
     */
    self.getLayerBounds = function(layer) {
        try {
            var transform = layer.property("Transform");
            var position = transform.property("Position").value;
            var scale = transform.property("Scale").value;
            
            var width = layer.width * scale[0] / 100;
            var height = layer.height * scale[1] / 100;
            
            return {
                left: position[0] - width / 2,
                right: position[0] + width / 2,
                top: position[1] - height / 2,
                bottom: position[1] + height / 2,
                width: width,
                height: height,
                centerX: position[0],
                centerY: position[1]
            };
            
        } catch (error) {
            self.log("Error getting layer bounds: " + error.message);
            return null;
        }
    };
    
    /**
     * Convert seconds to composition time
     */
    self.secondsToTime = function(seconds, frameRate) {
        frameRate = frameRate || 30;
        return seconds;
    };
    
    /**
     * Convert composition time to seconds
     */
    self.timeToSeconds = function(time, frameRate) {
        frameRate = frameRate || 30;
        return time;
    };
    
    /**
     * Clamp value between min and max
     */
    self.clamp = function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    };
    
    /**
     * Linear interpolation
     */
    self.lerp = function(a, b, t) {
        return a + (b - a) * t;
    };
    
    /**
     * Calculate distance between two points
     */
    self.distance = function(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    };
    
    /**
     * Normalize vector
     */
    self.normalize = function(vector) {
        var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
        if (length > 0) {
            return [vector[0] / length, vector[1] / length];
        }
        return [0, 0];
    };
    
    /**
     * Vector dot product
     */
    self.dot = function(a, b) {
        return a[0] * b[0] + a[1] * b[1];
    };
    
    /**
     * Get random value between min and max
     */
    self.random = function(min, max) {
        return min + Math.random() * (max - min);
    };
    
    /**
     * Format number to fixed decimal places
     */
    self.formatNumber = function(num, decimals) {
        decimals = decimals || 2;
        return parseFloat(num.toFixed(decimals));
    };
    
    /**
     * Check if ExtendScript environment is available
     */
    self.isExtendScript = function() {
        return typeof app !== "undefined" && typeof app.project !== "undefined";
    };
    
    /**
     * Get After Effects version info
     */
    self.getAEVersion = function() {
        if (self.isExtendScript()) {
            return {
                version: app.version,
                buildNumber: app.buildNumber,
                name: app.name
            };
        }
        return null;
    };
    
    /**
     * Safe property access with fallback
     */
    self.safePropertyAccess = function(obj, propertyPath, fallback) {
        try {
            var parts = propertyPath.split('.');
            var current = obj;
            
            for (var i = 0; i < parts.length; i++) {
                if (current[parts[i]] === undefined) {
                    return fallback;
                }
                current = current[parts[i]];
            }
            
            return current;
            
        } catch (error) {
            return fallback;
        }
    };
    
    return self;
})();
