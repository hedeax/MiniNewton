# MiniNewton - 2D Physics Engine for After Effects

## Overview

MiniNewton is a lightweight, script-based physics engine designed as an alternative to the After Effects Newton plugin. Built using Adobe ExtendScript (.jsx), it provides essential 2D physics simulation capabilities directly within After Effects without requiring external plugins. The project focuses on creating realistic physics behaviors for layers including gravity, bounce, collision detection, and velocity-based motion.

## System Architecture

### Core Architecture Pattern
- **Modular JavaScript Architecture**: The system follows a modular pattern with separate modules for physics calculations, UI management, and utility functions
- **ExtendScript Environment**: Built specifically for Adobe After Effects using ExtendScript, allowing direct manipulation of AE layers and properties
- **Event-Driven UI**: ScriptUI-based interface that responds to user inputs and triggers physics simulations

### Technology Stack
- **Runtime**: Adobe ExtendScript (.jsx)
- **UI Framework**: ScriptUI for dockable After Effects panels
- **Host Application**: Adobe After Effects (2021+)
- **Target Elements**: 2D shape layers, solids, and precompositions

## Key Components

### 1. Physics Engine (physics.js)
- **Body Creation**: Converts After Effects layers into physics bodies with properties like mass, velocity, and acceleration
- **Mass Calculation**: Automatically calculates mass based on layer dimensions and scale
- **Property Management**: Handles position, rotation, velocity, and acceleration for each physics body
- **Collision Properties**: Manages restitution (bounce) and other collision-related properties

### 2. User Interface (ui.js)
- **ScriptUI Panel**: Creates a dockable panel within After Effects
- **Physics Controls**: Provides sliders and inputs for gravity, bounce, and other physics parameters
- **Real-time Updates**: Allows users to adjust physics settings and see immediate feedback
- **Simulation Controls**: Includes buttons to start, stop, and configure physics simulations

### 3. Utilities (utils.js)
- **Logging System**: Centralized logging for debugging and error tracking
- **Error Handling**: Standardized error display and management
- **Composition Validation**: Ensures the active composition is suitable for physics simulation
- **After Effects Integration**: Helper functions for interacting with AE's object model

## Data Flow

1. **Layer Selection**: User selects layers in After Effects composition
2. **Body Creation**: Physics module converts selected layers into physics bodies
3. **Property Extraction**: System reads layer transform properties (position, rotation, scale)
4. **Physics Calculation**: Engine applies forces like gravity and calculates new positions/velocities
5. **Collision Detection**: System checks for collisions with floor and other boundaries
6. **Keyframe Baking**: Results are applied back to AE layers as keyframes
7. **UI Feedback**: Interface updates to reflect current simulation state

## External Dependencies

### After Effects API
- **Layer Property Access**: Direct manipulation of transform properties
- **Keyframe Management**: Creation and modification of animation keyframes
- **Composition Interface**: Access to active compositions and selected layers

### ExtendScript Runtime
- **JavaScript Engine**: Adobe's ExtendScript environment for scripting
- **ScriptUI Framework**: Built-in UI creation and management system
- **File System Access**: For potential asset loading and script management

## Deployment Strategy

### Installation Method
- **Script File Deployment**: Single .jsx file or modular script package
- **After Effects Scripts Folder**: Installation in AE's Scripts/ScriptUI Panels directory
- **Manual Installation**: Users can run scripts directly from the File > Scripts menu

### Distribution Approach
- **Direct File Sharing**: Scripts distributed as .jsx files
- **Version Management**: Simple file replacement for updates
- **Cross-Platform**: Compatible with Windows and macOS versions of After Effects

### Performance Considerations
- **Real-time Simulation**: Optimized for interactive feedback during simulation setup
- **Keyframe Baking**: One-time calculation with results baked to standard AE keyframes
- **Memory Management**: Efficient handling of layer data and physics calculations

## Recent Changes

```
June 29, 2025:
✓ Enhanced Phase 1 core physics engine with material system
✓ Added Phase 2 multi-body collision detection and optimization
✓ Implemented Phase 3 joints system (distance, spring, pivot, weld)
✓ Created advanced UI with material presets and joint builder
✓ Added sleeping body optimization for performance
✓ Implemented auto-joint creation from layer naming conventions
✓ Added comprehensive test suite for all functionality
✓ Redesigned UI completely with Newton 4 inspired interface layout
✓ Fixed missing simulation controls (Add Bodies, Simulate, Bake, Reset)
✓ Added professional material system with real-time property updates
✓ Implemented contact tracking with export slider effects
✓ Added progress bars and enhanced status display system
✓ FINAL VERSION: Complete rewrite addressing all critical issues
✓ Fixed simulation failures, joint creation errors, and baking system
✓ Implemented working special effects (magnetism, waterlike, fixed rotation)
✓ Created robust error handling and validation throughout
✓ Delivered production-ready MiniNewton_Final.jsx with full Newton 4 features
```

## Changelog

```
Changelog:
- June 29, 2025. Initial setup and Phase 1-3 implementation
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
File management: Keep download page clean with only the latest working version.
Project approach: Single-file solutions to avoid confusion and multiple versions.
```