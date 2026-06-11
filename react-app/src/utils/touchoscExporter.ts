import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface TouchOscExportOptions {
  resolution: 'phone_portrait' | 'tablet_portrait' | 'phone_landscape' | 'tablet_landscape';
  includeMasterSliders: boolean;
  includePinnedChannels: boolean;
  includeScenes: boolean;
  includeFixtures: boolean;
  includeAllDmx: boolean;
  masterSliders: any[];
  pinnedChannels: number[];
  scenes: any[];
  fixtures: any[];
  getChannelInfo: (index: number) => { channelName: string; fixtureName?: string };
}

export interface SuperControlExportOptions {
  resolution: 'phone_portrait' | 'tablet_portrait' | 'phone_landscape' | 'tablet_landscape';
  includeBasicControls: boolean;
  includePanTilt: boolean;
  includeColorWheel: boolean;
  includeXYPad: boolean;
  includeEffects: boolean;
  includeAutopilot: boolean;
  includeQuickActions: boolean;
  includeSceneControls: boolean;
  includeNavigation: boolean;
}

export const generateToscLayout = async (options: TouchOscExportOptions) => {
  const {
    resolution,
    includeMasterSliders,
    includePinnedChannels,
    includeScenes,
    includeFixtures,
    includeAllDmx,
    masterSliders,
    pinnedChannels,
    scenes,
    fixtures,
    getChannelInfo
  } = options;

  // Resolution Preset Dimensions
  const resolutions = {
    'phone_portrait': { width: 1170, height: 2532, label: 'iPhone Portrait' },
    'tablet_portrait': { width: 1668, height: 2388, label: 'iPad Portrait' },
    'phone_landscape': { width: 2532, height: 1170, label: 'iPhone Landscape' },
    'tablet_landscape': { width: 2388, height: 1668, label: 'iPad Landscape' },
    'android_phone_portrait': { width: 1080, height: 2400, label: 'Android Phone P' },
    'android_phone_landscape': { width: 2400, height: 1080, label: 'Android Phone L' },
    'android_tablet_portrait': { width: 1600, height: 2560, label: 'Android Tablet P' },
    'android_tablet_landscape': { width: 2560, height: 1600, label: 'Android Tablet L' },
  };

  const res = (resolutions as any)[resolution] || resolutions.phone_portrait;
  const docWidth = res.width;
  const docHeight = res.height;
  const isLandscape = resolution.includes('landscape');

  const fixtureColors = [
    '#f59e0bff', // Amber
    '#ec4899ff', // Pink
    '#3b82f6ff', // Blue
    '#10b981ff', // Emerald
    '#8b5cf6ff', // Violet
    '#06b6d8ff', // Cyan
    '#f43f5eff', // Rose
    '#a855f7ff', // Purple
    '#ef4444ff', // Red
    '#14b8a6ff', // Teal
  ];

  const getFixtureColor = (index: number) => fixtureColors[index % fixtureColors.length];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<node type="DOCUMENT">\n`;
  xml += `  <properties>\n`;
  xml += `    <property name="name">ArtBastard_Ultimate</property>\n`;
  xml += `    <property name="width">${docWidth}</property>\n`;
  xml += `    <property name="height">${docHeight}</property>\n`;
  xml += `  </properties>\n`;
  xml += `  <children>\n`;

  // Pager for different sections
  xml += `    <node type="PAGER">\n`;
  xml += `      <properties>\n`;
  xml += `        <property name="name">MainPager</property>\n`;
  xml += `        <property name="x">0</property>\n`;
  xml += `        <property name="y">0</property>\n`;
  xml += `        <property name="width">${docWidth}</property>\n`;
  xml += `        <property name="height">${docHeight}</property>\n`;
  xml += `        <property name="tabLabels">true</property>\n`;
  xml += `        <property name="tabSize">60</property>\n`;
  xml += `      </properties>\n`;
  xml += `      <children>\n`;

  // --- TAB 1: MASTER CONTROLS ---
  if (includeMasterSliders && masterSliders.length > 0) {
    xml += `        <node type="PAGE">\n`;
    xml += `          <properties><property name="name">Masters</property></properties>\n`;
    xml += `          <children>\n`;
    xml += createLabelXml('Header', 'ARTBASTARD MASTER CONTROLS', 50, 20, docWidth - 100, 60, 24, '#ffffffff');

    let currentX = 50;
    let currentY = 120;
    masterSliders.forEach((master, index) => {
      xml += createFaderXml(`Master_${index + 1}`, `/master/${index + 1}`, currentX, currentY, 140, 450, master.name || `Master ${index + 1}`, '#8b5cf6ff');
      currentX += 180;
      if (currentX > docWidth - 180) {
        currentX = 50;
        currentY += 550;
      }
    });
    xml += `          </children>\n`;
    xml += `        </node>\n`;
  }

  // --- FIXTURE PAGES (One page per fixture) ---
  if (includeFixtures) {
    fixtures.forEach((fixture, fIdx) => {
      const color = getFixtureColor(fIdx);
      xml += `        <node type="PAGE">\n`;
      xml += `          <properties><property name="name">FIX: ${fixture.name.substring(0, 10)}</property></properties>\n`;
      xml += `          <children>\n`;
      xml += createLabelXml('Header', `FIXTURE: ${fixture.name.toUpperCase()}`, 50, 20, docWidth - 100, 60, 24, color);

      // Pan/Tilt XY Pad
      const panCh = fixture.channels.find((c: any) => c.channelType?.toLowerCase() === 'pan');
      const tiltCh = fixture.channels.find((c: any) => c.channelType?.toLowerCase() === 'tilt');

      let currentX = 50;
      let currentY = 120;

      if (panCh || tiltCh) {
        xml += createXYPadXml(`XY_${fIdx}`, fIdx, currentX, currentY, 500, 500, color, panCh?.dmxAddress, tiltCh?.dmxAddress);
        xml += createLabelXml(`XY_Label_${fIdx}`, 'PAN / TILT', currentX, currentY + 510, 500, 40, 18, '#aaaaaaff');
        currentX += 550;
      }

      // Other Channels as Faders
      fixture.channels.forEach((ch: any, cIdx: number) => {
        // Skip pan/tilt if we already added XY pad (optional detail)
        if (ch.channelType?.toLowerCase() === 'pan' || ch.channelType?.toLowerCase() === 'tilt') return;

        xml += createFaderXml(`FixCh_${fIdx}_${cIdx}`, `/channel/${ch.dmxAddress + 1}`, currentX, currentY, 100, 350, ch.name, color);
        currentX += 120;
        if (currentX > docWidth - 120) {
          currentX = 50;
          currentY += 450;
          if ((panCh || tiltCh) && currentY < 600) currentY = 650; // Don't overlap XY pad
        }
      });

      xml += `          </children>\n`;
      xml += `        </node>\n`;
    });
  }

  // --- TAB: SCENE QUICK LOAD ---
  if (includeScenes && scenes.length > 0) {
    xml += `        <node type="PAGE">\n`;
    xml += `          <properties><property name="name">Scene Load</property></properties>\n`;
    xml += `          <children>\n`;
    xml += createLabelXml('Header', 'QUICK SCENE LOAD', 50, 20, docWidth - 100, 60, 24, '#10b981ff');

    let currentX = 50;
    let currentY = 120;
    const btnW = 300;
    const btnH = 150;

    scenes.forEach((scene, index) => {
      xml += createButtonXml(`Load_${index}`, '/scene/load', scene.name, currentX, currentY, btnW, btnH, '#10b981ff');
      currentX += btnW + 20;
      if (currentX > docWidth - btnW) {
        currentX = 50;
        currentY += btnH + 20;
      }
    });
    xml += `          </children>\n`;
    xml += `        </node>\n`;

    // --- TAB: SCENE QUICK SAVE ---
    xml += `        <node type="PAGE">\n`;
    xml += `          <properties><property name="name">Scene Save</property></properties>\n`;
    xml += `          <children>\n`;
    xml += createLabelXml('Header', 'QUICK SCENE SAVE (Warning!)', 50, 20, docWidth - 100, 60, 24, '#ef4444ff');

    currentX = 50;
    currentY = 120;

    scenes.forEach((scene, index) => {
      xml += createButtonXml(`Save_${index}`, '/scene/save', scene.name, currentX, currentY, btnW, btnH, '#ef4444ff');
      currentX += btnW + 20;
      if (currentX > docWidth - btnW) {
        currentX = 50;
        currentY += btnH + 20;
      }
    });
    xml += `          </children>\n`;
    xml += `        </node>\n`;
  }

  // --- TAB: PINNED CHANNELS ---
  if (includePinnedChannels && pinnedChannels && pinnedChannels.length > 0) {
    xml += `        <node type="PAGE">\n`;
    xml += `          <properties><property name="name">Pinned</property></properties>\n`;
    xml += `          <children>\n`;
    xml += createLabelXml('Header', 'PINNED PERFORMANCE CHANNELS', 50, 20, docWidth - 100, 60, 24, '#06b6d8ff');

    let currentX = 50;
    let currentY = 120;
    pinnedChannels.forEach((chIdx) => {
      const info = getChannelInfo(chIdx);
      const name = info?.channelName || `Channel ${chIdx + 1}`;
      xml += createFaderXml(`Pinned_${chIdx}`, `/channel/${chIdx + 1}`, currentX, currentY, 110, 350, name, '#06b6d8ff');
      currentX += 130;
      if (currentX > docWidth - 130) {
        currentX = 50;
        currentY += 450;
      }
    });
    xml += `          </children>\n`;
    xml += `        </node>\n`;
  }

  // --- TAB: ALL DMX (Grid) ---
  if (includeAllDmx) {
    const channelsPerPage = isLandscape ? 40 : 32;
    const numPages = Math.ceil(512 / channelsPerPage);
    for (let p = 0; p < numPages; p++) {
      xml += `        <node type="PAGE">\n`;
      xml += `          <properties><property name="name">DMX ${p * channelsPerPage + 1}-${Math.min(512, (p + 1) * channelsPerPage)}</property></properties>\n`;
      xml += `          <children>\n`;
      xml += createLabelXml('Header', `FULL DMX MONITOR: ${p * channelsPerPage + 1}`, 50, 10, docWidth - 100, 40, 16, '#64748bff');

      let subX = 40;
      let subY = 70;
      const faderW = isLandscape ? 120 : 80;
      const spacingX = isLandscape ? 140 : 100;

      for (let i = 0; i < channelsPerPage; i++) {
        const chIdx = p * channelsPerPage + i;
        if (chIdx >= 512) break;
        xml += createFaderXml(`Full_Dmx_${chIdx + 1}`, `/channel/${chIdx + 1}`, subX, subY, faderW, 250, `${chIdx + 1}`, '#64748bff');
        subX += spacingX;
        if (subX > docWidth - spacingX) {
          subX = 40;
          subY += 350;
        }
      }
      xml += `          </children>\n`;
      xml += `        </node>\n`;
    }
  }

  xml += `      </children>\n`;
  xml += `    </node>\n`;
  xml += `  </children>\n`;
  xml += `</node>\n`;

  // Create Zip
  try {
    const zip = new JSZip();
    zip.file("index.xml", xml);
    const blob = await zip.generateAsync({ type: "blob" });
    console.log('[TouchOSC] Generated .tosc blob, size:', blob.size);
    if (typeof saveAs === 'function') {
      saveAs(blob, "ArtBastard_Ultimate.tosc");
    } else {
      console.warn('[TouchOSC] saveAs not available, export might fail');
    }
    return { success: true, xml, blobSize: blob.size };
  } catch (err) {
    console.error('[TouchOSC] Export generation failed:', err);
    throw err;
  }
};

export const exportSuperControlToToscFile = async (options: SuperControlExportOptions, filename: string = 'ArtBastard_SuperControl.tosc') => {
  const resolutions = {
    'phone_portrait': { width: 1170, height: 2532 },
    'tablet_portrait': { width: 1668, height: 2388 },
    'phone_landscape': { width: 2532, height: 1170 },
    'tablet_landscape': { width: 2388, height: 1668 },
  };

  const res = resolutions[options.resolution] || resolutions.tablet_portrait;
  const docWidth = res.width;
  const docHeight = res.height;
  const isLandscape = options.resolution.includes('landscape');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<node type="DOCUMENT">\n`;
  xml += `  <properties>\n`;
  xml += `    <property name="name">ArtBastard_SuperControl</property>\n`;
  xml += `    <property name="width">${docWidth}</property>\n`;
  xml += `    <property name="height">${docHeight}</property>\n`;
  xml += `  </properties>\n`;
  xml += `  <children>\n`;

  // Main Page
  xml += `    <node type="PAGE">\n`;
  xml += `      <properties><property name="name">Performance</property></properties>\n`;
  xml += `      <children>\n`;
  xml += createLabelXml('Header', 'SUPER CONTROL', 50, 20, docWidth - 100, 60, 24, '#8b5cf6ff');

  let x = 50;
  let y = 100;

  if (options.includeBasicControls) {
    xml += createFaderXml('Dimmer', '/supercontrol/dimmer', x, y, 120, 450, 'DIMMER', '#ffffffff');
    x += 150;
    xml += createFaderXml('Red', '/supercontrol/red', x, y, 100, 350, 'RED', '#ef4444ff');
    x += 120;
    xml += createFaderXml('Green', '/supercontrol/green', x, y, 100, 350, 'GREEN', '#10b981ff');
    x += 120;
    xml += createFaderXml('Blue', '/supercontrol/blue', x, y, 100, 350, 'BLUE', '#3b82f6ff');
    x += 150;
  }

  if (options.includeXYPad) {
    xml += `
            <node type="XYPAD">
              <properties>
                <property name="name">SuperXY</property>
                <property name="x">${x}</property>
                <property name="y">${y}</property>
                <property name="width">500</property>
                <property name="height">500</property>
                <property name="color">#8b5cf6ff</property>
              </properties>
              <messages>
                <osc enabled="1" send="1" receive="1" feedback="0">
                  <property name="address">/supercontrol/pantilt/xy</property>
                </osc>
              </messages>
            </node>`;
    xml += createLabelXml('XYLabel', 'SUPER PAN/TILT', x, y + 510, 500, 40, 18, '#aaaaaaff');
    y += 600;
    x = 50;
  }

  // Quick Actions
  if (options.includeQuickActions) {
    xml += createButtonXml('Flash', '/supercontrol/action/flash', 'FLASH', x, y, 200, 100, '#f59e0bff');
    x += 220;
    xml += createButtonXml('Strobe', '/supercontrol/action/strobe/toggle', 'STROBE', x, y, 200, 100, '#ef4444ff');
  }

  xml += `      </children>\n`;
  xml += `    </node>\n`;
  xml += `  </children>\n`;
  xml += `</node>\n`;

  const zip = new JSZip();
  zip.file("index.xml", xml);
  const blob = await zip.generateAsync({ type: "blob" });
  if (typeof saveAs === 'function') {
    saveAs(blob, filename);
  }

  return { success: true, message: 'Export successful' };
};

const createFaderXml = (name: string, address: string, x: number, y: number, w: number, h: number, label: string, color: string) => {
  return `
            <node type="FADER">
              <properties>
                <property name="name">${name}</property>
                <property name="x">${x}</property>
                <property name="y">${y}</property>
                <property name="width">${w}</property>
                <property name="height">${h}</property>
                <property name="color">${color}</property>
              </properties>
              <messages>
                <osc enabled="1" send="1" receive="1" feedback="0">
                  <property name="address">${address}</property>
                </osc>
              </messages>
            </node>
            <node type="LABEL">
              <properties>
                <property name="x">${x}</property>
                <property name="y">${y + h + 5}</property>
                <property name="width">${w}</property>
                <property name="height">30</property>
                <property name="text">${label}</property>
                <property name="textSize">12</property>
                <property name="textAlignH">2</property>
              </properties>
            </node>
    `;
};

const createXYPadXml = (name: string, fIdx: number, x: number, y: number, w: number, h: number, color: string, panAddr?: number, tiltAddr?: number) => {
  let messages = '';
  if (panAddr !== undefined) {
    messages += `
                <osc enabled="1" send="1" receive="1" feedback="0">
                  <property name="address">/channel/${panAddr + 1}</property>
                  <property name="index">1</property>
                </osc>`;
  }
  if (tiltAddr !== undefined) {
    messages += `
                <osc enabled="1" send="1" receive="1" feedback="0">
                  <property name="address">/channel/${tiltAddr + 1}</property>
                  <property name="index">2</property>
                </osc>`;
  }

  return `
            <node type="XYPAD">
              <properties>
                <property name="name">${name}</property>
                <property name="x">${x}</property>
                <property name="y">${y}</property>
                <property name="width">${w}</property>
                <property name="height">${h}</property>
                <property name="color">${color}</property>
              </properties>
              <messages>${messages}</messages>
            </node>
  `;
};

const createButtonXml = (name: string, address: string, arg: string, x: number, y: number, w: number, h: number, color: string) => {
  return `
            <node type="BUTTON">
              <properties>
                <property name="name">${name}</property>
                <property name="x">${x}</property>
                <property name="y">${y}</property>
                <property name="width">${w}</property>
                <property name="height">${h}</property>
                <property name="color">${color}</property>
                <property name="text">${arg}</property>
                <property name="buttonType">1</property>
              </properties>
              <messages>
                <osc enabled="1" send="1" receive="1" feedback="0">
                  <property name="address">${address}</property>
                  <property name="arguments">
                    <argument type="s">${arg}</argument>
                  </property>
                </osc>
              </messages>
            </node>
  `;
};

const createLabelXml = (name: string, text: string, x: number, y: number, w: number, h: number, size: number, color: string) => {
  return `
            <node type="LABEL">
              <properties>
                <property name="name">${name}</property>
                <property name="x">${x}</property>
                <property name="y">${y}</property>
                <property name="width">${w}</property>
                <property name="height">${h}</property>
                <property name="text">${text}</property>
                <property name="textSize">${size}</property>
                <property name="textColor">${color}</property>
                <property name="textAlignH">2</property>
              </properties>
            </node>
  `;
};
