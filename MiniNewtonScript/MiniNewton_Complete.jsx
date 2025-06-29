/*
 * MiniNewton - Complete 2D Physics Engine for After Effects
 * Single file version with all modules included
 * Compatible with After Effects 2021+
 */

(function() {
    "use strict";

    /*
     * Utility Functions Module
     */
    var Utils = (function() {
        var self = {};
        
        self.log = function(message) {
            if (typeof $.writeln !== "undefined") {
                $.writeln("[MiniNewton] " + message);
            }
        };
        
        self.showError = function(message) {
            alert("MiniNewton Error:\n" + message);
            self.log("ERROR: " + message);
        };
        
        self.showInfo = function(message) {
            alert("MiniNewton:\n" + message);
            self.log("INFO: " + message);
        };
        
        self.getActiveComp = function() {
            if (!app.project) {
                return null;
            }
            return app.project.activeItem;
        };
        
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
            return null;
        };
        
        self.isValidPhysicsLayer = function(layer) {
            try {
                var transform = layer.property("Transform");
                if (!transform) return false;
                var position = transform.property("Position");
                if (!position) return false;
                if (layer.width <= 0 || layer.height <= 0) return false;
                if (!layer.enabled) return false;
                return true;
            } catch (error) {
                self.log("Layer validation error: " + error.message);
                return false;
            }
        };
        
        self.clamp = function(value, min, max) {
            return Math.max(min, Math.min(max, value));
        };
        
        self.distance = function(x1, y1, x2, y2) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        };
        
        self.normalize = function(vector) {
            var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
            if (length > 0) {
                return [vector[0] / length, vector[1] / length];
            }
            return [0, 0];
        };
        
        self.isExtendScript = function() {
            return typeof app !== "undefined" && typeof app.project !== "undefined";
        };
        
        return self;
    })();

    /*
     * Physics Engine Module
     */
    var Physics = (function() {
        var self = {};
        
        self.materials = {
            'rubber': { restitution: 0.9, friction: 0.7, density: 0.9 },
            'metal': { restitution: 0.3, friction: 0.1, density: 7.8 },
            'wood': { restitution: 0.5, friction: 0.8, density: 0.6 },
            'ice': { restitution: 0.1, friction: 0.02, density: 0.92 },
            'concrete': { restitution: 0.2, friction: 0.9, density: 2.4 },
            'default': { restitution: 0.8, friction: 0.3, density: 1.0 }
        };
        
        self.createBody = function(layer, settings) {
            if (!layer) return null;
            
            try {
                var transform = layer.property("Transform");
                var position = transform.property("Position").value;
                var rotation = transform.property("Rotation").value;
                var scale = transform.property("Scale").value;
                
                var width = layer.width * scale[0] / 100;
                var height = layer.height * scale[1] / 100;
                var area = width * height;
                var mass = Math.max(area / 10000, 0.1);
                
                var materialProps = self.materials[settings.material] || self.materials['default'];
                
                var body = {
                    layer: layer,
                    position: [position[0], position[1]],
                    velocity: [0, 0],
                    acceleration: [0, 0],
                    rotation: rotation,
                    angularVelocity: 0,
                    mass: mass * (materialProps.density || 1.0),
                    width: width,
                    height: height,
                    restitution: settings.bounce !== undefined ? settings.bounce : materialProps.restitution,
                    friction: settings.friction !== undefined ? settings.friction : materialProps.friction,
                    density: materialProps.density,
                    isGrounded: false,
                    isSleeping: false,
                    sleepTimer: 0,
                    material: settings.material || 'default'
                };
                
                return body;
                
            } catch (error) {
                Utils.log("Error creating body for layer " + layer.name + ": " + error.message);
                return null;
            }
        };
        
        self.applyGravity = function(body, gravityVector, deltaTime) {
            if (!body.isGrounded) {
                if (typeof gravityVector === 'number') {
                    body.acceleration[1] += gravityVector * deltaTime;
                } else {
                    body.acceleration[0] += gravityVector[0] * deltaTime;
                    body.acceleration[1] += gravityVector[1] * deltaTime;
                }
            }
        };
        
        self.applyDamping = function(body, damping) {
            body.velocity[0] *= damping;
            body.velocity[1] *= damping;
            body.angularVelocity *= damping;
        };
        
        self.updatePosition = function(body, deltaTime) {
            body.velocity[0] += body.acceleration[0] * deltaTime;
            body.velocity[1] += body.acceleration[1] * deltaTime;
            
            body.position[0] += body.velocity[0] * deltaTime;
            body.position[1] += body.velocity[1] * deltaTime;
            
            body.rotation += body.angularVelocity * deltaTime;
            
            body.acceleration[0] = 0;
            body.acceleration[1] = 0;
        };
        
        self.checkFloorCollision = function(body, floorY, bounce) {
            var bodyBottom = body.position[1] + (body.height / 2);
            
            if (bodyBottom >= floorY) {
                body.position[1] = floorY - (body.height / 2);
                
                if (body.velocity[1] > 0) {
                    body.velocity[1] = -body.velocity[1] * bounce;
                    
                    var impactStrength = Math.abs(body.velocity[1]);
                    body.angularVelocity += (Math.random() - 0.5) * impactStrength * 0.1;
                    
                    if (Math.abs(body.velocity[1]) < 10) {
                        body.velocity[1] = 0;
                        body.isGrounded = true;
                    } else {
                        body.isGrounded = false;
                    }
                }
                
                if (body.isGrounded) {
                    body.velocity[0] *= 0.9;
                    body.angularVelocity *= 0.95;
                }
            } else {
                body.isGrounded = false;
            }
        };
        
        self.updateSleepState = function(body, deltaTime) {
            var velocityThreshold = 5;
            var angularThreshold = 0.1;
            var sleepTimeout = 1.0;
            
            var totalVelocity = Math.sqrt(body.velocity[0] * body.velocity[0] + body.velocity[1] * body.velocity[1]);
            
            if (totalVelocity < velocityThreshold && Math.abs(body.angularVelocity) < angularThreshold) {
                body.sleepTimer += deltaTime;
                if (body.sleepTimer > sleepTimeout) {
                    body.isSleeping = true;
                    body.velocity = [0, 0];
                    body.angularVelocity = 0;
                }
            } else {
                body.sleepTimer = 0;
                body.isSleeping = false;
            }
        };
        
        return self;
    })();

    /*
     * Main MiniNewton Module
     */
    var MiniNewton = (function() {
        var self = {};
        
        self.settings = {
            gravity: 980,
            gravityVector: [0, 980],
            bounce: 0.8,
            floorY: 900,
            duration: 3,
            frameRate: 30,
            damping: 0.98,
            friction: 0.3,
            material: 'default',
            enableInterBodyCollision: false,
            enableSleeping: true
        };
        
        self.bodies = [];
        self.simulationData = [];
        self.isSimulating = false;
        
        self.init = function(customSettings) {
            if (customSettings) {
                for (var key in customSettings) {
                    if (self.settings.hasOwnProperty(key)) {
                        self.settings[key] = customSettings[key];
                    }
                }
            }
            Utils.log("MiniNewton initialized");
            return self;
        };
        
        self.addBodiesFromSelection = function() {
            var comp = Utils.getActiveComp();
            if (!comp) {
                Utils.showError("No active composition found");
                return false;
            }
            
            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                Utils.showError("No layers selected");
                return false;
            }
            
            self.bodies = [];
            
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var body = Physics.createBody(layer, self.settings);
                
                if (body) {
                    self.bodies.push(body);
                    Utils.log("Added body: " + layer.name);
                }
            }
            
            Utils.log("Added " + self.bodies.length + " physics bodies");
            return self.bodies.length > 0;
        };
        
        self.simulate = function() {
            if (self.bodies.length === 0) {
                Utils.showError("No physics bodies to simulate");
                return false;
            }
            
            self.isSimulating = true;
            self.simulationData = [];
            
            var totalFrames = Math.floor(self.settings.duration * self.settings.frameRate);
            var deltaTime = 1.0 / self.settings.frameRate;
            
            Utils.log("Starting simulation: " + totalFrames + " frames");
            
            for (var b = 0; b < self.bodies.length; b++) {
                self.simulationData[b] = [];
            }
            
            for (var frame = 0; frame < totalFrames; frame++) {
                for (var i = 0; i < self.bodies.length; i++) {
                    var body = self.bodies[i];
                    
                    if (self.settings.enableSleeping && body.isSleeping) {
                        self.simulationData[i][frame] = {
                            position: [body.position[0], body.position[1]],
                            rotation: body.rotation,
                            time: frame * deltaTime
                        };
                        continue;
                    }
                    
                    Physics.applyGravity(body, self.settings.gravityVector || self.settings.gravity, deltaTime);
                    Physics.applyDamping(body, self.settings.damping);
                    Physics.updatePosition(body, deltaTime);
                    Physics.checkFloorCollision(body, self.settings.floorY, self.settings.bounce);
                    
                    if (self.settings.enableSleeping) {
                        Physics.updateSleepState(body, deltaTime);
                    }
                    
                    self.simulationData[i][frame] = {
                        position: [body.position[0], body.position[1]],
                        rotation: body.rotation,
                        time: frame * deltaTime
                    };
                }
            }
            
            self.isSimulating = false;
            Utils.log("Simulation completed");
            return true;
        };
        
        self.bake = function() {
            if (self.simulationData.length === 0) {
                Utils.showError("No simulation data to bake");
                return false;
            }
            
            var comp = Utils.getActiveComp();
            if (!comp) {
                Utils.showError("No active composition found");
                return false;
            }
            
            app.beginUndoGroup("MiniNewton Bake Simulation");
            
            try {
                for (var i = 0; i < self.bodies.length; i++) {
                    var body = self.bodies[i];
                    var frameData = self.simulationData[i];
                    var layer = body.layer;
                    
                    layer.property("Transform").property("Position").setValueAtTime(0, layer.property("Transform").property("Position").value);
                    
                    for (var frame = 0; frame < frameData.length; frame++) {
                        var data = frameData[frame];
                        var time = data.time;
                        
                        layer.property("Transform").property("Position").setValueAtTime(time, data.position);
                        
                        if (Math.abs(data.rotation) > 0.001) {
                            layer.property("Transform").property("Rotation").setValueAtTime(time, data.rotation);
                        }
                    }
                    
                    Utils.log("Baked " + frameData.length + " keyframes to layer: " + layer.name);
                }
                
                app.endUndoGroup();
                Utils.log("Simulation baked successfully");
                return true;
                
            } catch (error) {
                app.endUndoGroup();
                Utils.showError("Error baking simulation: " + error.message);
                return false;
            }
        };
        
        self.reset = function() {
            self.bodies = [];
            self.simulationData = [];
            self.isSimulating = false;
            Utils.log("Simulation reset");
        };
        
        self.getStatus = function() {
            return {
                bodies: self.bodies.length,
                isSimulating: self.isSimulating,
                hasData: self.simulationData.length > 0
            };
        };
        
        return self;
    })();

    /*
     * User Interface Module
     */
    var UI = (function() {
        var self = {};
        var panel = null;
        var controls = {};
        
        self.createPanel = function() {
            // Close existing panel if it exists
            if (panel && panel.parent) {
                panel.close();
                panel = null;
            }
            
            // Create a proper ScriptUI panel that can be docked
            try {
                // Try to create as a dockable panel first
                panel = new Window("panel", "MiniNewton Physics");
                panel.orientation = "column";
                panel.alignChildren = "fill";
                panel.spacing = 8;
                panel.margins = 12;
                panel.preferredSize.width = 300;
                panel.preferredSize.height = 500;
            } catch (e) {
                // Fallback to dialog if panel creation fails
                Utils.log("Panel creation failed, using dialog: " + e.message);
                panel = new Window("dialog", "MiniNewton Physics", undefined, {resizeable: true});
                panel.orientation = "column";
                panel.alignChildren = "fill";
                panel.spacing = 8;
                panel.margins = 12;
            }
            
            // Header
            var header = panel.add("panel", undefined, "MiniNewton - 2D Physics Engine");
            header.alignment = "fill";
            header.margins = 10;
            
            var headerText = header.add("statictext", undefined, "Lightweight Physics for After Effects");
            headerText.alignment = "center";
            
            // Physics Settings Group
            var physicsGroup = panel.add("panel", undefined, "Physics Settings");
            physicsGroup.orientation = "column";
            physicsGroup.alignChildren = "fill";
            physicsGroup.margins = 10;
            physicsGroup.spacing = 8;
            
            // Gravity Control
            var gravityGroup = physicsGroup.add("group");
            gravityGroup.orientation = "row";
            gravityGroup.add("statictext", undefined, "Gravity:");
            controls.gravitySlider = gravityGroup.add("slider", undefined, MiniNewton.settings.gravity, 0, 2000);
            controls.gravitySlider.preferredSize.width = 150;
            controls.gravityText = gravityGroup.add("edittext", undefined, MiniNewton.settings.gravity.toString());
            controls.gravityText.preferredSize.width = 60;
            
            // Bounce Control
            var bounceGroup = physicsGroup.add("group");
            bounceGroup.orientation = "row";
            bounceGroup.add("statictext", undefined, "Bounce:");
            controls.bounceSlider = bounceGroup.add("slider", undefined, MiniNewton.settings.bounce, 0, 1);
            controls.bounceSlider.preferredSize.width = 150;
            controls.bounceText = bounceGroup.add("edittext", undefined, MiniNewton.settings.bounce.toString());
            controls.bounceText.preferredSize.width = 60;
            
            // Floor Position Control
            var floorGroup = physicsGroup.add("group");
            floorGroup.orientation = "row";
            floorGroup.add("statictext", undefined, "Floor Y:");
            controls.floorText = floorGroup.add("edittext", undefined, MiniNewton.settings.floorY.toString());
            controls.floorText.preferredSize.width = 80;
            floorGroup.add("statictext", undefined, "pixels");
            
            // Duration Control
            var durationGroup = physicsGroup.add("group");
            durationGroup.orientation = "row";
            durationGroup.add("statictext", undefined, "Duration:");
            controls.durationText = durationGroup.add("edittext", undefined, MiniNewton.settings.duration.toString());
            controls.durationText.preferredSize.width = 60;
            durationGroup.add("statictext", undefined, "seconds");
            
            // Material Presets Group
            var materialGroup = panel.add("panel", undefined, "Material Presets");
            materialGroup.orientation = "column";
            materialGroup.alignChildren = "fill";
            materialGroup.margins = 10;
            materialGroup.spacing = 8;
            
            var materialSelectGroup = materialGroup.add("group");
            materialSelectGroup.orientation = "row";
            materialSelectGroup.add("statictext", undefined, "Material:");
            controls.materialDropdown = materialSelectGroup.add("dropdownlist", undefined, ["Default", "Rubber", "Metal", "Wood", "Ice", "Concrete"]);
            controls.materialDropdown.selection = 0;
            controls.materialDropdown.preferredSize.width = 120;
            
            // Simulation Controls Group
            var simGroup = panel.add("panel", undefined, "Simulation Controls");
            simGroup.orientation = "column";
            simGroup.alignChildren = "fill";
            simGroup.margins = 10;
            simGroup.spacing = 8;
            
            controls.addBodiesBtn = simGroup.add("button", undefined, "Add Selected Layers as Physics Bodies");
            controls.addBodiesBtn.preferredSize.height = 30;
            
            controls.statusText = simGroup.add("statictext", undefined, "Status: Ready");
            controls.statusText.alignment = "center";
            
            controls.simulateBtn = simGroup.add("button", undefined, "Run Simulation");
            controls.simulateBtn.preferredSize.height = 35;
            controls.simulateBtn.enabled = false;
            
            controls.bakeBtn = simGroup.add("button", undefined, "Bake Keyframes to Layers");
            controls.bakeBtn.preferredSize.height = 30;
            controls.bakeBtn.enabled = false;
            
            controls.resetBtn = simGroup.add("button", undefined, "Reset");
            controls.resetBtn.preferredSize.height = 25;
            
            self.setupEventHandlers();
            
            // Make panel dockable and show it properly
            if (panel instanceof Panel) {
                // This is a dockable panel
                panel.show();
            } else {
                // This is a dialog window, make it non-modal
                panel.show();
            }
            
            return panel;
        };
        
        self.setupEventHandlers = function() {
            controls.gravitySlider.onChanging = function() {
                controls.gravityText.text = Math.round(this.value).toString();
                MiniNewton.settings.gravity = this.value;
            };
            
            controls.gravityText.onChanging = function() {
                var value = parseFloat(this.text);
                if (!isNaN(value) && value >= 0 && value <= 2000) {
                    controls.gravitySlider.value = value;
                    MiniNewton.settings.gravity = value;
                }
            };
            
            controls.bounceSlider.onChanging = function() {
                controls.bounceText.text = this.value.toFixed(2);
                MiniNewton.settings.bounce = this.value;
            };
            
            controls.bounceText.onChanging = function() {
                var value = parseFloat(this.text);
                if (!isNaN(value) && value >= 0 && value <= 1) {
                    controls.bounceSlider.value = value;
                    MiniNewton.settings.bounce = value;
                }
            };
            
            controls.floorText.onChanging = function() {
                var value = parseFloat(this.text);
                if (!isNaN(value)) {
                    MiniNewton.settings.floorY = value;
                }
            };
            
            controls.durationText.onChanging = function() {
                var value = parseFloat(this.text);
                if (!isNaN(value) && value > 0) {
                    MiniNewton.settings.duration = value;
                }
            };
            
            controls.materialDropdown.onChange = function() {
                var materials = ['default', 'rubber', 'metal', 'wood', 'ice', 'concrete'];
                MiniNewton.settings.material = materials[this.selection.index];
                
                var materialProps = Physics.materials[MiniNewton.settings.material];
                if (materialProps) {
                    controls.bounceSlider.value = materialProps.restitution;
                    controls.bounceText.text = materialProps.restitution.toFixed(2);
                    MiniNewton.settings.bounce = materialProps.restitution;
                    MiniNewton.settings.friction = materialProps.friction;
                }
            };
            
            controls.addBodiesBtn.onClick = function() {
                self.updateStatus("Adding physics bodies...");
                
                if (MiniNewton.addBodiesFromSelection()) {
                    var status = MiniNewton.getStatus();
                    self.updateStatus("Added " + status.bodies + " physics bodies");
                    controls.simulateBtn.enabled = true;
                } else {
                    self.updateStatus("Failed to add physics bodies");
                    controls.simulateBtn.enabled = false;
                }
                
                controls.bakeBtn.enabled = false;
            };
            
            controls.simulateBtn.onClick = function() {
                self.updateStatus("Running physics simulation...");
                controls.simulateBtn.enabled = false;
                
                app.scheduleTask("MiniNewton.simulate(); UI.onSimulationComplete();", 100, false);
            };
            
            controls.bakeBtn.onClick = function() {
                self.updateStatus("Baking keyframes...");
                
                if (MiniNewton.bake()) {
                    self.updateStatus("Keyframes baked successfully!");
                } else {
                    self.updateStatus("Failed to bake keyframes");
                }
            };
            
            controls.resetBtn.onClick = function() {
                MiniNewton.reset();
                self.updateStatus("Reset complete");
                controls.simulateBtn.enabled = false;
                controls.bakeBtn.enabled = false;
            };
        };
        
        self.onSimulationComplete = function() {
            var status = MiniNewton.getStatus();
            
            if (status.hasData) {
                self.updateStatus("Simulation complete - Ready to bake");
                controls.bakeBtn.enabled = true;
            } else {
                self.updateStatus("Simulation failed");
            }
            
            controls.simulateBtn.enabled = true;
        };
        
        self.updateStatus = function(message) {
            if (controls.statusText) {
                controls.statusText.text = "Status: " + message;
            }
            Utils.log(message);
        };
        
        return self;
    })();

    // Initialize MiniNewton when script loads
    if (typeof app !== "undefined" && app.project) {
        MiniNewton.init();
        UI.createPanel();
    }

})();