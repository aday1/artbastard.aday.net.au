# 💡 **Fixture Setup Guide** - ArtBastard V5.12

> *"A lighting designer without proper fixture configuration is like a painter without pigments."*

## 🎯 **Fixture Setup Overview**

Configure your luminaires for intelligent control through ArtBastard's comprehensive fixture management system.

## 📚 **Built-in Fixture Profiles**
ArtBastard includes professional profiles for:

### 🔄 **Moving Lights**
- **Pan/Tilt** positioning with speed control
- **Color wheels** and **GOBO** selection
- **Beam control** (zoom, focus, iris)
- **Animation effects** and pattern generators

### 🌈 **LED Fixtures** 
- **RGB/RGBW** color mixing
- **Strobe** and dimming control
- **Color temperature** correction (CTO/CTB)
- **Special effects** and macros

### ⚡ **Specialty Effects**
- **Lasers** (EL1000RGB profiles included)
- **Haze/Fog machines** with timing control
- **LED strips** and pixel mapping
- **UV/Blacklight** fixtures

## 🛠️ **Adding Custom Fixtures**

### 1. **Access Fixture Setup**
- Click **"Fixture Setup"** in main navigation
- Select **"Add New Fixture"**

### 2. **Configure Channels**
```
Channel 1: Dimmer (0-255)
Channel 2: Red (0-255)
Channel 3: Green (0-255)
Channel 4: Blue (0-255)
Channel 5: Strobe (0=off, 1-255=speed)
```

### 3. **Set DMX Address**
- Choose starting DMX address (1-512)
- System automatically calculates channel span
- Avoid address conflicts with existing fixtures

### 4. **Test Configuration**
- Use **Channel Test** to verify each function
- Adjust ranges if needed
- Save profile for future use

## 📡 **DMX Addressing**

### **Address Planning**
- **Universe 1**: Main stage lighting (1-200)
- **Universe 2**: Moving lights (201-400) 
- **Universe 3**: Effects/specialty (401-512)

### **Best Practices**
- Leave gaps between fixture groups for expansion
- Document your addressing scheme
- Use logical numbering (stage left to right)

## 🎨 **Grouping & Organization**
- Create **Fixture Groups** for batch control
- Organize by type, position, or function
- Name groups clearly ("Front Wash", "Movers", "Effects")

---
**Next:** [Usage Guide](./USAGE.md) | [Features](./FEATURES.md)