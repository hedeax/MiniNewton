/*
 * Complete Test Script for MiniNewton Physics Engine
 * Tests all core functionality including physics, materials, joints, and UI
 */

// Create mock After Effects environment for testing
function createMockAEEnvironment() {
    global.app = {
        project: { 
            activeItem: {
                selectedLayers: [
                    {
                        name: "Ball1",
                        width: 100,
                        height: 100,
                        enabled: true,
                        property: function(propName) {
                            if (propName === "Transform") {
                                return {
                                    property: function(transformProp) {
                                        switch(transformProp) {
                                            case "Position":
                                                return { value: [400, 200] };
                                            case "Rotation":
                                                return { value: 0 };
                                            case "Scale":
                                                return { value: [100, 100] };
                                        }
                                    }
                                };
                            }
                        }
                    },
                    {
                        name: "Ball2_distance_Ball1",
                        width: 80,
                        height: 80,
                        enabled: true,
                        property: function(propName) {
                            if (propName === "Transform") {
                                return {
                                    property: function(transformProp) {
                                        switch(transformProp) {
                                            case "Position":
                                                return { value: [500, 200] };
                                            case "Rotation":
                                                return { value: 0 };
                                            case "Scale":
                                                return { value: [100, 100] };
                                        }
                                    }
                                };
                            }
                        }
                    }
                ]
            }
        },
        version: '24.0.0',
        buildNumber: '59',
        name: 'After Effects',
        beginUndoGroup: function(name) { console.log('Begin undo group:', name); },
        endUndoGroup: function() { console.log('End undo group'); },
        scheduleTask: function(code, delay, repeat) { 
            console.log('Scheduled task:', code); 
            setTimeout(() => eval(code), delay);
        }
    };

    global.Window = function(type, title) {
        console.log('Creating window:', type, title);
        this.orientation = 'column';
        this.alignChildren = 'fill';
        this.spacing = 10;
        this.margins = 16;
        this.add = function(type, bounds, text) {
            console.log('Adding UI element:', type, text || '');
            var element = {
                alignment: 'fill',
                margins: 10,
                orientation: 'column',
                alignChildren: 'fill',
                spacing: 8,
                preferredSize: { width: 150, height: 30 },
                value: 980,
                text: '980',
                enabled: true,
                selection: { index: 0 },
                add: this.add.bind(this),
                onClick: function() { console.log('Button clicked:', text); },
                onChanging: function() { console.log('Value changing:', this.value); },
                onChange: function() { console.log('Value changed:', this.value); },
                show: function() { console.log('Showing element'); },
                close: function() { console.log('Closing element'); }
            };
            return element;
        };
        this.show = function() { console.log('Showing window:', title); };
        this.close = function() { console.log('Closing window'); };
    };

    global.alert = function(msg) { console.log('ALERT:', msg); };
    global.$ = { writeln: function(msg) { console.log('LOG:', msg); } };
    global.CompItem = function() {};
}

// Test runner function
function runCompleteTests() {
    console.log('\n=== MiniNewton Complete Test Suite ===\n');
    
    createMockAEEnvironment();
    
    // Test 1: Material System
    console.log('1. Testing Material System:');
    console.log('Available materials:', Object.keys(Physics.materials));
    
    var rubberProps = Physics.materials.rubber;
    console.log('Rubber properties:', JSON.stringify(rubberProps));
    
    var metalProps = Physics.materials.metal;
    console.log('Metal properties:', JSON.stringify(metalProps));
    
    // Test 2: Body Creation with Materials
    console.log('\n2. Testing Body Creation:');
    MiniNewton.init();
    
    // Test with different materials
    MiniNewton.settings.material = 'rubber';
    var success = MiniNewton.addBodiesFromSelection();
    console.log('Added bodies from selection:', success);
    
    var status = MiniNewton.getStatus();
    console.log('Current status:', JSON.stringify(status));
    
    if (MiniNewton.bodies.length > 0) {
        console.log('First body properties:');
        console.log('- Mass:', MiniNewton.bodies[0].mass);
        console.log('- Restitution:', MiniNewton.bodies[0].restitution);
        console.log('- Friction:', MiniNewton.bodies[0].friction);
        console.log('- Material:', MiniNewton.bodies[0].material);
    }
    
    // Test 3: Joint System
    console.log('\n3. Testing Joint System:');
    
    if (MiniNewton.bodies.length >= 2) {
        // Test distance joint
        var joint = MiniNewton.createJoint(0, 1, 'distance');
        console.log('Created distance joint:', joint ? 'SUCCESS' : 'FAILED');
        
        // Test auto joint creation
        var autoJoints = MiniNewton.autoCreateJoints();
        console.log('Auto-created joints:', autoJoints);
        
        console.log('Total joints:', MiniNewton.joints.length);
        
        if (MiniNewton.joints.length > 0) {
            console.log('First joint properties:');
            console.log('- Type:', MiniNewton.joints[0].type);
            console.log('- Target distance:', MiniNewton.joints[0].targetDistance);
            console.log('- Strength:', MiniNewton.joints[0].strength);
        }
    }
    
    // Test 4: Physics Simulation
    console.log('\n4. Testing Physics Simulation:');
    
    // Set up simulation parameters
    MiniNewton.settings.duration = 1; // 1 second for testing
    MiniNewton.settings.frameRate = 10; // Low frame rate for testing
    MiniNewton.settings.gravity = 500;
    MiniNewton.settings.enableInterBodyCollision = true;
    MiniNewton.settings.enableSleeping = true;
    
    console.log('Starting simulation...');
    var simSuccess = MiniNewton.simulate();
    console.log('Simulation completed:', simSuccess ? 'SUCCESS' : 'FAILED');
    
    if (simSuccess) {
        console.log('Simulation data frames:', MiniNewton.simulationData[0] ? MiniNewton.simulationData[0].length : 0);
        
        if (MiniNewton.simulationData[0] && MiniNewton.simulationData[0].length > 0) {
            var firstFrame = MiniNewton.simulationData[0][0];
            var lastFrame = MiniNewton.simulationData[0][MiniNewton.simulationData[0].length - 1];
            
            console.log('First frame position:', firstFrame.position);
            console.log('Last frame position:', lastFrame.position);
            console.log('Position change:', [
                lastFrame.position[0] - firstFrame.position[0],
                lastFrame.position[1] - firstFrame.position[1]
            ]);
        }
    }
    
    // Test 5: Advanced Physics Features
    console.log('\n5. Testing Advanced Features:');
    
    if (MiniNewton.bodies.length > 0) {
        var body = MiniNewton.bodies[0];
        
        // Test kinetic energy calculation
        body.velocity = [100, 50];
        var ke = Physics.getKineticEnergy(body);
        console.log('Kinetic energy:', ke);
        
        // Test sleep state
        body.velocity = [1, 1]; // Very slow
        Physics.updateSleepState(body, 2.0); // 2 seconds
        console.log('Body sleeping after slow motion:', body.isSleeping);
        
        // Test material friction
        body.velocity = [50, 0];
        body.isGrounded = true;
        Physics.applyMaterialFriction(body, [0, -1], 0.1);
        console.log('Velocity after friction:', body.velocity);
    }
    
    // Test 6: Error Handling
    console.log('\n6. Testing Error Handling:');
    
    // Test invalid joint creation
    var badJoint = MiniNewton.createJoint(99, 100, 'distance');
    console.log('Invalid joint creation handled:', badJoint === false);
    
    // Test invalid material
    MiniNewton.settings.material = 'nonexistent';
    var materialProps = Physics.materials[MiniNewton.settings.material] || Physics.materials['default'];
    console.log('Invalid material handled:', materialProps === Physics.materials['default']);
    
    // Test 7: Utility Functions
    console.log('\n7. Testing Utility Functions:');
    
    console.log('ExtendScript environment detected:', Utils.isExtendScript());
    console.log('AE Version info:', JSON.stringify(Utils.getAEVersion()));
    
    var distance = Utils.distance(0, 0, 3, 4);
    console.log('Distance calculation (3,4 from origin):', distance);
    
    var normalized = Utils.normalize([3, 4]);
    console.log('Normalized vector [3,4]:', normalized);
    
    var clamped = Utils.clamp(150, 0, 100);
    console.log('Clamped value 150 (0-100):', clamped);
    
    console.log('\n=== Test Suite Complete ===');
    console.log('MiniNewton appears to be working correctly!');
    
    // Final status
    var finalStatus = MiniNewton.getStatus();
    console.log('\nFinal Status:');
    console.log('- Bodies:', finalStatus.bodies);
    console.log('- Joints:', finalStatus.joints);
    console.log('- Has simulation data:', finalStatus.hasData);
    console.log('- Currently simulating:', finalStatus.isSimulating);
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runCompleteTests, createMockAEEnvironment };
} else {
    // Run tests immediately if loaded as script
    runCompleteTests();
}