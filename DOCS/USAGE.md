# 🎛️ **Usage Guide** - ArtBastard V5.12

> *"Mastery comes not from complexity, but from elegant simplicity in powerful tools. ArtBastard provides the latter; you must provide the former. If you find yourself confused, perhaps you should first acquire a basic understanding of theatrical lighting before attempting to use a tool designed for professionals. We recommend starting with a simple on/off switch and working your way up. Remember: the Wind Dancing Masters began with a single candle and a gentle breeze. You, mes amis, have the advantage of modern technology. Do not squander it."*  
> — *Le Créateur des Lumières*

*"This guide assumes a basic understanding of DMX512, theatrical lighting, and general competence. If you find yourself asking 'What is a fixture?' or 'How do I turn on a light?', perhaps you should consult a technical professional, or better yet, acquire one. The ancient masters would have had no patience for such questions, and neither do we."*

## 🎪 **Interface Overview** *(For Those Who Appreciate Elegance)*

ArtBastard's interface is designed for both precision and speed - essential for live performance. We've eliminated the bloated, cluttered interfaces that plague amateur software, replacing them with elegant controls that respect your intelligence and your artistry.

### **Main Control Areas**
- **Channel Faders** - Individual fixture control
- **Group Controls** - Batch fixture management  
- **Master Fader** - Global intensity control
- **Scene Manager** - Saved lighting states

## 🎨 **Basic Operation** *(The Foundation of All Great Art)*

### **1. Controlling Individual Fixtures** *(Because True Artists Command Every Photon)*
- **Sliders**: Adjust intensity, color, position with the precision your artistry demands. We've made them larger and more responsive, because your time is too valuable for fiddly controls.
- **Color Picker**: Visual color selection that produces hues so pure, they would make Monet question his palette choices. Choose your colors with the confidence of a master painter.
- **Preset Buttons**: Quick access to common settings, because true artists understand the value of efficiency. We've eliminated the tedious menu navigation that plagues amateur software.
- **Fine Control**: Hold Shift for precise adjustments. Because sometimes, a single percentage point makes all the difference between art and mere illumination.

### **2. Working with Groups** *(Because True Artists Think in Compositions)*
- Select multiple fixtures using Ctrl+Click - *obviously*. We assume you possess at least this level of competence.
- Create groups for efficient batch control. Because true artists understand that lighting is not about individual fixtures, but about compositions.
- Use group faders for consistent lighting looks. Command entire groups of fixtures with a single gesture, as it should be.

### **3. Scene Management** *(Because True Artists Preserve Their Masterpieces)*
- **Record**: Capture current lighting state with the precision it deserves. Your compositions are worth preserving.
- **Recall**: Instantly return to saved scenes. Because true artists understand the value of preparation, even in the heat of performance.
- **Edit**: Modify existing scenes on-the-fly. Because true artistry sometimes requires improvisation, even within a prepared composition.
- **Crossfade**: Smooth transitions between scenes that eliminate the jarring cuts that plague amateur systems. Your audience deserves better.

### **4. Face Tracking** *(The Future of Photonic Control)*
- **Real-time Face Detection**: Advanced OpenCV-based facial recognition that tracks your movements with precision worthy of a professional installation.
- **Gesture Recognition**: The system detects nodding, head shaking, and stationary states, transforming your movements into photonic choreography.
- **Pan/Tilt Mapping**: Your head movements control fixture pan and tilt in real-time. Nod for tilt, shake for pan - *c'est magnifique!*
- **Consolidated Configuration**: All settings (camera, tracking, DMX channels, OSC endpoints) unified on a single page, because toggling between pages is for peasants.
- **Camera Selection**: Choose from available cameras with user-friendly buttons, because true artists deserve intuitive interfaces.
- **Live Feedback**: Real-time sliders show pan and tilt values as you move, providing visual confirmation that your artistry is being translated into photonic control.

### **5. Timeline Editor** *(DAW-Style Professional Editing)*
- **Keyframe Animation**: Create complex lighting sequences with precise keyframe control. Keyframes display actual DMX values (0-255) and percentages - no more meaningless "X ch" labels. *Finally, a timeline that respects your intelligence!*
- **Timeline Navigation**: Professional timeline ruler with scrubbing support. Click or drag on the ruler to jump to any position or scrub through your timeline. Home/End keys jump to start/end, Space plays/pauses.
- **Visual Feedback**: Clear playhead indicator, drag preview showing exact time positions, and smooth curve visualization between keyframes. *Transparency is artistry, mes amis.*
- **Multi-Track View**: View multiple channels simultaneously in a multi-track timeline. Each channel gets its own track with mute/solo controls, collapsible tracks, and individual keyframe management.
- **Keyboard Shortcuts**: DAW-style shortcuts for efficient editing: Space (play/pause), Home/End (navigation), Shift+Arrow (nudge), Ctrl+C/V (copy/paste), Delete (remove keyframes), Ctrl+Z/Y (undo/redo). Press `?` to view all shortcuts.
- **Curve Editing**: Visualize and edit interpolation curves between keyframes. Choose from linear, ease-in, ease-out, smooth, or step interpolation. *Because true artists understand the importance of smooth transitions.*

### **6. Clip Launcher** *(Session-Style Live Performance)*
- **Grid-Based Interface**: Session-style clip launcher with customizable grid (default 4×4). Organize your scenes in a visual grid for quick access during live performance. *Inspired by Ableton Live, because great artists learn from each other.*
- **Launch Controls**: Click to launch scenes, double-click to edit. Play/stop buttons for each clip, loop toggle, and "Stop All" for emergency control. Multiple clips can play simultaneously for layered effects.
- **Visual States**: Clear indicators for playing (highlighted), queued (different color), recording (pulsing), and empty (dashed border). *Because visual feedback is essential for live performance.*
- **Scene Integration**: Seamlessly integrated with ArtBastard's scene system. Any scene can be assigned to a clip cell, and scenes with timelines will play their timelines when launched.

### **7. Scene Management with MIDI/OSC** *(Because True Artists Prepare)*
- **Per-Scene MIDI Mapping**: Each saved scene can have its own MIDI trigger. Click "MIDI" on any scene, send a MIDI CC or Note, and that scene is now mapped.
- **Per-Scene OSC Addresses**: Each scene gets a unique OSC address (default: `/scene/1`, `/scene/2`, etc.) with custom override capability.
- **Configuration Export/Import**: Export all settings (including scene MIDI/OSC mappings) as JSON for backup or sharing.
- **Factory Reset**: Complete system reset that clears all saved state, fixtures, channel names, MIDI mappings, OSC addresses, and persisted data. Truly fresh start.

*Because true artists understand that lighting is not about individual fixtures, but about compositions. Your scenes deserve to be triggered with the precision of a maestro, and ArtBastard ensures they are.*

### **6. Display Options & Customization** *(Because True Artists Personalize Their Tools)*
- **Display Options**: Scene Controls, MIDI Controls, OSC Controls, and Envelope Automation are enabled by default. Toggle them off in the Display Options section if you prefer a minimalist interface.
- **Customizable Color Themes**: Access Configuration Sanctuary → Theme section. Use HSL sliders for primary, secondary, and accent colors to create your own photonic aesthetic.
- **DMX Visual Effects**: Configure visual effects (off/low/medium/high) in Configuration Sanctuary → Performance section. Adjust GPU usage to match your system's capabilities.
- **Sparkles Toggle**: Quick toggle in the right-hand navbar menu to enable/disable visual sparkles on DMX activity.

### **7. SuperControl Layout** *(Because Efficiency Matters)*
- **Quick Panel Selection**: Switch between 2-column and 3-column layouts with quick selection buttons.
- **Side-by-Side Controls**: Controls are displayed side-by-side within columns for efficient workflow.
- **Responsive Design**: Layout adapts to your screen size automatically.

### **8. Tempo Control with MIDI/OSC** *(Because Rhythm Is Everything)*
- **Tempo Play/Pause MIDI**: Learn MIDI mappings for tempo start/stop in the Pinned Channels panel.
- **Tap Tempo MIDI**: Learn MIDI mappings for tap tempo functionality.
- **Tempo Play/Pause OSC**: Learn OSC addresses (`/tempo/playpause`, `/tempo/toggle`) for wireless tempo control.
- **Tap Tempo OSC**: Learn OSC address (`/tempo/tap`) for wireless tap tempo from any device.

### **9. Network Telemetry** *(Because Monitoring Is Essential)*
- **DMX Message Log**: View real-time DMX/ArtNet message updates in the Network Telemetry panel.
- **Channel Monitoring**: See channel, old value, and new value for every DMX update.
- **Real-time Feedback**: Watch your commands take effect with precision.

## 🎹 **MIDI Control**

### **MIDI Learning**
1. Right-click any control
2. Select **"Learn MIDI"**
3. Move your MIDI controller
4. Control is now mapped

### **Popular MIDI Controllers**
- **Behringer BCF2000** - 8 motorized faders
- **Akai APC40** - Grid-based control
- **NanoKontrol** - Compact solution
- **OSC Protocol** - Wireless control via mobile devices

## 📱 **Touch Interface**

### **Touch Optimization**
- **Large Controls**: 44px+ touch targets
- **Drag Zones**: Clear resize handles
- **Gesture Support**: Pinch-to-zoom, swipe navigation
- **Haptic Feedback**: Visual response to touches


## ⚡ **Live Performance Workflow**

### **Pre-Show Setup**
1. **Load Show File** - Import your saved configuration
2. **Test All Fixtures** - Verify hardware connections  
3. **Check Scenes** - Confirm all cues are working
4. **MIDI Check** - Test controller responsiveness

### **During Show**
- **Master Fader** for house lights/overrides
- **Scene Triggers** for major lighting changes
- **Manual Override** for spontaneous adjustments
- **Emergency Blackout** (spacebar or dedicated button)

### **Advanced Techniques**
- **Crossfade Timing** - Adjust transition speeds
- **Chase Effects** - Automated sequences
- **Beat Sync** - Audio-responsive lighting
- **Backup Scenes** - Always have a fallback plan

## 🔧 **Keyboard Shortcuts** *(Efficiency Is Artistry)*

### **General Controls**
- **Spacebar** - Emergency blackout toggle (or Timeline Play/Pause in timeline editor)
- **Ctrl+S** - Save current state
- **Ctrl+Z/Y** - Undo/Redo changes
- **F11** - Toggle fullscreen
- **Ctrl+H** or **?** - Help overlay / Keyboard shortcuts help
- **Esc** - Close dialogs/overlays

### **Timeline Editor Shortcuts** *(DAW-Style Professional Editing)*
- **Space** - Play/Pause timeline
- **Home** - Jump to start of timeline
- **End** - Jump to end of timeline
- **Shift+Arrow Left/Right** - Nudge playhead or selected keyframes
- **Ctrl+C** - Copy selected keyframes
- **Ctrl+V** - Paste keyframes at playhead position
- **Delete** - Delete selected keyframes
- **Ctrl+Z/Y** - Undo/Redo timeline changes
- **Ctrl+A** - Select all keyframes
- **?** - Show keyboard shortcuts help overlay

*These shortcuts transform timeline editing from a tedious chore into an elegant dance of efficiency. The Wind Dancing Masters would approve.*

---
**Next:** [Features](./FEATURES.md) | [History](./HISTORY.md)