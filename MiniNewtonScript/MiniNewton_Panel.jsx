/*
 * MiniNewton - Dockable ScriptUI Panel for After Effects
 * 2D Physics Engine - Proper Panel Implementation
 */

(function(thisObj) {
    "use strict";

    // Utility Functions
    var Utils = {
        log: function(message) {
            if (typeof $.writeln !== "undefined") {
                $.writeln("[MiniNewton] " + message);
            }
        },
        
        showError: function(message) {
            alert("MiniNewton Error:\n" + message);
            this.log("ERROR: " + message);
        },
        
        showInfo: function(message) {
            alert("MiniNewton:\n" + message);
            this.log("INFO: " + message);
        },
        
        getActiveComp: function() {
            if (!app.project) return null;
            return app.project.activeItem;
        },
        
        validateComp: function(comp) {
            if (!comp) return "No active composition";
            if (!(comp instanceof CompItem)) return "Active item is not a composition";
            if (comp.selectedLayers.length === 0) return "No layers selected in composition";
            return null;
        },
        
        isValidPhysicsLayer: function(layer) {
            try {
                var transform = layer.property("Transform");
                if (!transform) return false;
                var position = transform.property("Position");
                if (!position) return false;
                if (layer.width <= 0 || layer.height <= 0) return false;
                if (!layer.enabled) return false;
                return true;
            } catch (error) {
                this.log("Layer validation error: " + error.message);
                return false;
            }
        },
        
        clamp: function(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        
        distance: function(x1, y1, x2, y2) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
    };

    // Physics Engine
    var Physics = {
        materials: {
            'rubber': { restitution: 0.9, friction: 0.7, density: 0.9 },
            'metal': { restitution: 0.3, friction: 0.1, density: 7.8 },
            'wood': { restitution: 0.5, friction: 0.8, density: 0.6 },
            'ice': { restitution: 0.1, friction: 0.02, density: 0.92 },
            'concrete': { restitution: 0.2, friction: 0.9, density: 2.4 },
            'default': { restitution: 0.8, friction: 0.3, density: 1.0 }
        },
        
        createBody: function(layer, settings) {
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
                
                var materialProps = this.materials[settings.material] || this.materials['default'];
                
                return {
                    layer: layer,
                    originalPosition: [position[0], position[1]], // Store original position
                    position: [position[0], position[1]],
                    velocity: [0, 0],
                    acceleration: [0, 0],
                    rotation: rotation,
                    originalRotation: rotation,
                    angularVelocity: 0,
                    mass: mass * (materialProps.density || 1.0),
                    width: width,
                    height: height,
                    restitution: settings.bounce !== undefined ? settings.bounce : materialProps.restitution,
                    friction: settings.friction !== undefined ? settings.friction : materialProps.friction,
                    isGrounded: false,
                    material: settings.material || 'default'
                };
                
            } catch (error) {
                Utils.log("Error creating body for layer " + layer.name + ": " + error.message);
                return null;
            }
        },
        
        applyGravity: function(body, gravity, deltaTime) {
            if (!body.isGrounded) {
                // Apply gravity as acceleration (pixels per second squared)
                body.acceleration[1] += gravity;
            }
        },
        
        applyDamping: function(body, damping) {
            body.velocity[0] *= damping;
            body.velocity[1] *= damping;
            body.angularVelocity *= damping;
        },
        
        updatePosition: function(body, deltaTime) {
            body.velocity[0] += body.acceleration[0] * deltaTime;
            body.velocity[1] += body.acceleration[1] * deltaTime;
            
            body.position[0] += body.velocity[0] * deltaTime;
            body.position[1] += body.velocity[1] * deltaTime;
            
            body.rotation += body.angularVelocity * deltaTime;
            
            body.acceleration[0] = 0;
            body.acceleration[1] = 0;
        },
        
        checkFloorCollision: function(body, floorY, bounce) {
            var bodyBottom = body.position[1] + (body.height / 2);
            
            if (bodyBottom >= floorY) {
                // Correct position to sit on floor
                body.position[1] = floorY - (body.height / 2);
                
                // Only reverse velocity if moving downward
                if (body.velocity[1] > 0) {
                    body.velocity[1] = -body.velocity[1] * bounce;
                    
                    // Add some rotation on impact
                    var impactStrength = Math.abs(body.velocity[1]);
                    body.angularVelocity += (Math.random() - 0.5) * impactStrength * 0.2;
                    
                    // Check if velocity is low enough to stop bouncing
                    if (Math.abs(body.velocity[1]) < 5) {
                        body.velocity[1] = 0;
                        body.isGrounded = true;
                    } else {
                        body.isGrounded = false;
                    }
                }
                
                // Apply ground friction
                if (body.isGrounded) {
                    body.velocity[0] *= 0.8; // Horizontal friction
                    body.angularVelocity *= 0.9; // Rotational friction
                }
            } else {
                body.isGrounded = false;
            }
        }
    };

    // MiniNewton Core
    var MiniNewton = {
        settings: {
            gravity: 980,
            bounce: 0.8,
            floorY: 1000, // Default floor position
            duration: 5,
            frameRate: 30,
            damping: 0.99,
            friction: 0.3,
            material: 'default'
        },
        
        bodies: [],
        simulationData: [],
        isSimulating: false,
        
        addBodiesFromSelection: function() {
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
            
            this.bodies = [];
            
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var body = Physics.createBody(layer, this.settings);
                
                if (body) {
                    this.bodies.push(body);
                    Utils.log("Added body: " + layer.name);
                }
            }
            
            Utils.log("Added " + this.bodies.length + " physics bodies");
            return this.bodies.length > 0;
        },
        
        simulate: function() {
            if (this.bodies.length === 0) {
                Utils.log("No physics bodies to simulate");
                return false;
            }
            
            this.isSimulating = true;
            this.simulationData = [];
            
            var totalFrames = Math.floor(this.settings.duration * this.settings.frameRate);
            var deltaTime = 1.0 / this.settings.frameRate;
            
            Utils.log("Starting simulation: " + totalFrames + " frames, " + this.bodies.length + " bodies");
            Utils.log("Gravity: " + this.settings.gravity + ", Floor Y: " + this.settings.floorY + ", Duration: " + this.settings.duration);
            
            // Initialize simulation data arrays  
            for (var b = 0; b < this.bodies.length; b++) {
                this.simulationData[b] = [];
                var body = this.bodies[b];
                Utils.log("Body " + b + " (" + body.layer.name + ") starting at position: [" + body.position[0] + ", " + body.position[1] + "]");
            }
            
            // Run simulation
            try {
                for (var frame = 0; frame < totalFrames; frame++) {
                    for (var i = 0; i < this.bodies.length; i++) {
                        var body = this.bodies[i];
                        
                        Physics.applyGravity(body, this.settings.gravity, deltaTime);
                        Physics.applyDamping(body, this.settings.damping);
                        Physics.updatePosition(body, deltaTime);
                        Physics.checkFloorCollision(body, this.settings.floorY, this.settings.bounce);
                        
                        this.simulationData[i][frame] = {
                            position: [body.position[0], body.position[1]],
                            rotation: body.rotation,
                            time: frame * deltaTime
                        };
                    }
                }
                
                this.isSimulating = false;
                
                // Verify simulation data was generated
                var totalKeyframes = 0;
                for (var i = 0; i < this.simulationData.length; i++) {
                    totalKeyframes += this.simulationData[i].length;
                }
                
                if (totalKeyframes > 0) {
                    // Log final positions for debugging
                    for (var b = 0; b < this.bodies.length; b++) {
                        var body = this.bodies[b];
                        var finalData = this.simulationData[b][this.simulationData[b].length - 1];
                        Utils.log("Body " + b + " (" + body.layer.name + ") final position: [" + finalData.position[0] + ", " + finalData.position[1] + "]");
                        Utils.log("Position change: [" + (finalData.position[0] - body.originalPosition[0]) + ", " + (finalData.position[1] - body.originalPosition[1]) + "]");
                    }
                    Utils.log("Simulation completed successfully - " + totalKeyframes + " keyframes generated");
                    return true;
                } else {
                    Utils.log("Simulation completed but no keyframes generated");
                    return false;
                }
                
            } catch (error) {
                this.isSimulating = false;
                Utils.log("Simulation error: " + error.message);
                return false;
            }
        },
        
        bake: function() {
            if (this.simulationData.length === 0) {
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
                for (var i = 0; i < this.bodies.length; i++) {
                    var body = this.bodies[i];
                    var frameData = this.simulationData[i];
                    var layer = body.layer;
                    
                    var position = layer.property("Transform").property("Position");
                    var rotation = layer.property("Transform").property("Rotation");
                    
                    // Clear existing keyframes first
                    while (position.numKeys > 0) {
                        position.removeKey(1);
                    }
                    while (rotation.numKeys > 0) {
                        rotation.removeKey(1);
                    }
                    
                    // Set keyframes starting from current comp time
                    var startTime = comp.time;
                    
                    for (var frame = 0; frame < frameData.length; frame++) {
                        var data = frameData[frame];
                        var compTime = startTime + data.time;
                        
                        // Set position keyframe
                        position.setValueAtTime(compTime, data.position);
                        
                        // Set rotation keyframe if there's significant rotation
                        if (Math.abs(data.rotation - body.originalRotation) > 0.1) {
                            rotation.setValueAtTime(compTime, data.rotation);
                        }
                    }
                    
                    Utils.log("Baked " + frameData.length + " keyframes to layer: " + layer.name);
                }
                
                // Move playhead to start of simulation
                comp.time = comp.time;
                
                app.endUndoGroup();
                Utils.log("Simulation baked successfully");
                return true;
                
            } catch (error) {
                app.endUndoGroup();
                Utils.showError("Error baking simulation: " + error.message);
                return false;
            }
        },
        
        reset: function() {
            this.bodies = [];
            this.simulationData = [];
            this.isSimulating = false;
            Utils.log("Simulation reset");
        }
    };

    // Create the main panel function
    function createMiniNewtonPanel(thisObj) {
        var panel = (thisObj instanceof Panel) ? thisObj : new Window("panel", "MiniNewton", undefined, {resizeable: true});
        
        panel.orientation = "column";
        panel.alignChildren = "fill";
        panel.spacing = 8;
        panel.margins = 12;
        panel.preferredSize.width = 280;
        panel.preferredSize.height = 450;
        
        // Header
        var headerGroup = panel.add("panel", undefined, "MiniNewton Physics");
        headerGroup.alignment = "fill";
        headerGroup.margins = 8;
        
        var headerText = headerGroup.add("statictext", undefined, "2D Physics Engine for After Effects");
        headerText.alignment = "center";
        
        // Physics Settings
        var physicsGroup = panel.add("panel", undefined, "Physics Settings");
        physicsGroup.orientation = "column";
        physicsGroup.alignChildren = "fill";
        physicsGroup.margins = 8;
        physicsGroup.spacing = 6;
        
        // Gravity
        var gravityGroup = physicsGroup.add("group");
        gravityGroup.add("statictext", undefined, "Gravity:");
        var gravitySlider = gravityGroup.add("slider", undefined, MiniNewton.settings.gravity, 0, 2000);
        gravitySlider.preferredSize.width = 120;
        var gravityText = gravityGroup.add("edittext", undefined, MiniNewton.settings.gravity.toString());
        gravityText.preferredSize.width = 50;
        
        // Bounce
        var bounceGroup = physicsGroup.add("group");
        bounceGroup.add("statictext", undefined, "Bounce:");
        var bounceSlider = bounceGroup.add("slider", undefined, MiniNewton.settings.bounce, 0, 1);
        bounceSlider.preferredSize.width = 120;
        var bounceText = bounceGroup.add("edittext", undefined, MiniNewton.settings.bounce.toString());
        bounceText.preferredSize.width = 50;
        
        // Floor Position
        var floorGroup = physicsGroup.add("group");
        floorGroup.add("statictext", undefined, "Floor Y:");
        var floorText = floorGroup.add("edittext", undefined, MiniNewton.settings.floorY.toString());
        floorText.preferredSize.width = 60;
        floorGroup.add("statictext", undefined, "px");
        
        // Duration
        var durationGroup = physicsGroup.add("group");
        durationGroup.add("statictext", undefined, "Duration:");
        var durationText = durationGroup.add("edittext", undefined, MiniNewton.settings.duration.toString());
        durationText.preferredSize.width = 50;
        durationGroup.add("statictext", undefined, "sec");
        
        // Material Presets
        var materialGroup = panel.add("panel", undefined, "Material Presets");
        materialGroup.orientation = "column";
        materialGroup.alignChildren = "fill";
        materialGroup.margins = 8;
        
        var materialSelectGroup = materialGroup.add("group");
        materialSelectGroup.add("statictext", undefined, "Material:");
        var materialDropdown = materialSelectGroup.add("dropdownlist", undefined, ["Default", "Rubber", "Metal", "Wood", "Ice", "Concrete"]);
        materialDropdown.selection = 0;
        materialDropdown.preferredSize.width = 100;
        
        // Controls
        var controlsGroup = panel.add("panel", undefined, "Simulation Controls");
        controlsGroup.orientation = "column";
        controlsGroup.alignChildren = "fill";
        controlsGroup.margins = 8;
        controlsGroup.spacing = 6;
        
        var statusText = controlsGroup.add("statictext", undefined, "Status: Ready");
        statusText.alignment = "center";
        statusText.preferredSize.width = 250;
        statusText.preferredSize.height = 20;
        
        var addBodiesBtn = controlsGroup.add("button", undefined, "Add Selected Layers");
        addBodiesBtn.preferredSize.height = 25;
        
        var simulateBtn = controlsGroup.add("button", undefined, "Run Simulation");
        simulateBtn.preferredSize.height = 30;
        simulateBtn.enabled = false;
        
        var bakeBtn = controlsGroup.add("button", undefined, "Bake Keyframes");
        bakeBtn.preferredSize.height = 25;
        bakeBtn.enabled = false;
        
        var resetBtn = controlsGroup.add("button", undefined, "Reset");
        resetBtn.preferredSize.height = 20;
        
        // Event Handlers
        gravitySlider.onChanging = function() {
            gravityText.text = Math.round(this.value).toString();
            MiniNewton.settings.gravity = this.value;
        };
        
        gravityText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 2000) {
                gravitySlider.value = value;
                MiniNewton.settings.gravity = value;
            }
        };
        
        bounceSlider.onChanging = function() {
            bounceText.text = this.value.toFixed(2);
            MiniNewton.settings.bounce = this.value;
        };
        
        bounceText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 1) {
                bounceSlider.value = value;
                MiniNewton.settings.bounce = value;
            }
        };
        
        floorText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value)) {
                MiniNewton.settings.floorY = value;
            }
        };
        
        durationText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value > 0) {
                MiniNewton.settings.duration = value;
            }
        };
        
        materialDropdown.onChange = function() {
            var materials = ['default', 'rubber', 'metal', 'wood', 'ice', 'concrete'];
            MiniNewton.settings.material = materials[this.selection.index];
            
            var materialProps = Physics.materials[MiniNewton.settings.material];
            if (materialProps) {
                bounceSlider.value = materialProps.restitution;
                bounceText.text = materialProps.restitution.toFixed(2);
                MiniNewton.settings.bounce = materialProps.restitution;
                MiniNewton.settings.friction = materialProps.friction;
            }
        };
        
        addBodiesBtn.onClick = function() {
            statusText.text = "Status: Adding bodies...";
            
            if (MiniNewton.addBodiesFromSelection()) {
                statusText.text = "Status: " + MiniNewton.bodies.length + " bodies added";
                simulateBtn.enabled = true;
            } else {
                statusText.text = "Status: Failed to add bodies";
                simulateBtn.enabled = false;
            }
            
            bakeBtn.enabled = false;
        };
        
        simulateBtn.onClick = function() {
            statusText.text = "Status: Simulating...";
            simulateBtn.enabled = false;
            
            // Run simulation directly instead of using scheduleTask
            try {
                if (MiniNewton.simulate()) {
                    statusText.text = "Status: Simulation complete";
                    bakeBtn.enabled = true;
                    simulateBtn.enabled = true;
                    Utils.log("Simulation completed successfully");
                } else {
                    statusText.text = "Status: Simulation failed";
                    simulateBtn.enabled = true;
                    Utils.log("Simulation failed");
                }
            } catch (error) {
                statusText.text = "Status: Error in simulation";
                simulateBtn.enabled = true;
                Utils.showError("Simulation error: " + error.message);
            }
        };
        
        bakeBtn.onClick = function() {
            statusText.text = "Status: Baking keyframes...";
            
            if (MiniNewton.bake()) {
                statusText.text = "Status: Keyframes baked!";
            } else {
                statusText.text = "Status: Baking failed";
            }
        };
        
        resetBtn.onClick = function() {
            try {
                MiniNewton.reset();
                statusText.text = "Status: Ready";
                simulateBtn.enabled = false;
                bakeBtn.enabled = false;
                Utils.log("System reset successfully");
            } catch (error) {
                statusText.text = "Status: Reset error";
                Utils.showError("Reset error: " + error.message);
            }
        };
        
        // Additional UI improvements
        panel.onResizing = panel.onResize = function() {
            this.layout.resize();
        };
        
        panel.layout.layout(true);
        return panel;
    }
    
    // Initialize the panel
    var miniNewtonPanel = createMiniNewtonPanel(thisObj);
    
    // Show the panel
    if (miniNewtonPanel != null && miniNewtonPanel instanceof Window) {
        miniNewtonPanel.center();
        miniNewtonPanel.show();
    }
    
    return miniNewtonPanel;

})(this);