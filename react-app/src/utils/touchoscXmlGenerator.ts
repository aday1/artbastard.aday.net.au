// TouchOSC XML Generator - Creates XML that can be pasted into TouchOSC Editor
// Based on the TouchOSC XML format

export interface FixtureInfo {
  id: string;
  name: string;
  startAddress: number;
  channels: any[];
  type?: string;
}

export interface SceneInfo {
  name: string;
  oscAddress?: string;
}

export interface TouchOscXmlOptions {
  fixtures: FixtureInfo[];
  scenes: SceneInfo[];
  pinnedChannels?: number[];
  masterSliders?: any[];
  width?: number;
  height?: number;
  oscBasePath?: string;
}

// Generate a unique ID for nodes
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Build OSC path partials matching TouchOSC format
// The example shows paths built with multiple partials: / + segment + / + segment
const buildOscPathPartials = (oscPath: string): string => {
  const pathParts = oscPath.split('/').filter(p => p.length > 0);
  
  if (pathParts.length === 0) {
    // Fallback: single constant path
    return `<partial>
<type>CONSTANT</type>
<conversion>STRING</conversion>
<value><![CDATA[${oscPath}]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
  }
  
  // Build path with alternating / and segment partials
  let pathPartials = '';
  pathParts.forEach((part, idx) => {
    if (idx === 0) {
      // First segment: start with /
      pathPartials += `<partial>
<type>CONSTANT</type>
<conversion>FLOAT</conversion>
<value><![CDATA[/]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
<partial>
<type>CONSTANT</type>
<conversion>STRING</conversion>
<value><![CDATA[${part}]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
    } else {
      // Subsequent segments: add / then segment
      pathPartials += `
<partial>
<type>CONSTANT</type>
<conversion>FLOAT</conversion>
<value><![CDATA[/]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
<partial>
<type>CONSTANT</type>
<conversion>STRING</conversion>
<value><![CDATA[${part}]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
    }
  });
  
  return pathPartials;
};

// Create XML for a fader control
export const createFaderXml = (
  name: string,
  oscPath: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string = '#ff0000ff'
): string => {
  const id = generateId();
  // Build path partials - split OSC path and create partials for each segment
  const pathParts = oscPath.split('/').filter(p => p.length > 0);
  let pathPartials = '';
  if (pathParts.length > 0) {
    pathPartials = `<partial>
<type>CONSTANT</type>
<conversion>FLOAT</conversion>
<value><![CDATA[/]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
    pathParts.forEach((part) => {
      pathPartials += `
<partial>
<type>CONSTANT</type>
<conversion>STRING</conversion>
<value><![CDATA[${part}]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
<partial>
<type>CONSTANT</type>
<conversion>FLOAT</conversion>
<value><![CDATA[/]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
    });
    // Remove the trailing slash partial
    pathPartials = pathPartials.replace(/<partial>[\s\S]*?<\/partial>\s*$/, '');
  } else {
    // Fallback: single constant path
    pathPartials = `<partial>
<type>CONSTANT</type>
<conversion>STRING</conversion>
<value><![CDATA[${oscPath}]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>`;
  }
  
  return `<node ID='${id}' type='FADER'>
<properties>
<property type='b'>
<key><![CDATA[background]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[bar]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[barDisplay]]></key>
<value>0</value>
</property>
<property type='b'>
<key><![CDATA[centered]]></key>
<value>0</value>
</property>
<property type='c'>
<key><![CDATA[color]]></key>
<value>
<r>${parseInt(color.slice(1, 3), 16) / 255}</r>
<g>${parseInt(color.slice(3, 5), 16) / 255}</g>
<b>${parseInt(color.slice(5, 7), 16) / 255}</b>
<a>${parseInt(color.slice(7, 9) || 'ff', 16) / 255}</a>
</value>
</property>
<property type='f'>
<key><![CDATA[cornerRadius]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[cursor]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[cursorDisplay]]></key>
<value>0</value>
</property>
<property type='r'>
<key><![CDATA[frame]]></key>
<value>
<x>${x}</x>
<y>${y}</y>
<w>${width}</w>
<h>${height}</h>
</value>
</property>
<property type='b'>
<key><![CDATA[grabFocus]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[grid]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[gridColor]]></key>
<value>
<r>0</r>
<g>0</g>
<b>0</b>
<a>0.25</a>
</value>
</property>
<property type='i'>
<key><![CDATA[gridSteps]]></key>
<value>10</value>
</property>
<property type='b'>
<key><![CDATA[interactive]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[locked]]></key>
<value>0</value>
</property>
<property type='s'>
<key><![CDATA[name]]></key>
<value><![CDATA[${name}]]></value>
</property>
<property type='i'>
<key><![CDATA[orientation]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[outline]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[outlineStyle]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[pointerPriority]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[response]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[responseFactor]]></key>
<value>100</value>
</property>
<property type='i'>
<key><![CDATA[shape]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[visible]]></key>
<value>1</value>
</property>
</properties>
<values>
<value>
<key><![CDATA[x]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[touch]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[false]]></default>
<defaultPull>0</defaultPull>
</value>
</values>
<messages>
<osc>
<enabled>1</enabled>
<send>1</send>
<receive>1</receive>
<feedback>0</feedback>
<noDuplicates>0</noDuplicates>
<connections>1111111111</connections>
<triggers>
<trigger>
<var><![CDATA[x]]></var>
<condition>ANY</condition>
</trigger>
</triggers>
<path>
${pathPartials}
</path>
<arguments>
<partial>
<type>VALUE</type>
<conversion>FLOAT</conversion>
<value><![CDATA[x]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
</arguments>
</osc>
</messages>
</node>`;
};

// Create XML for an encoder (XY pad)
// TouchOSC encoders can send both X and Y, but we'll create two separate encoders
// positioned side by side for clearer control
export const createEncoderXml = (
  name: string,
  oscPathX: string,
  oscPathY: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string = '#ff0000ff'
): string => {
  const idX = generateId();
  const idY = generateId();
  const pathPartialsX = buildOscPathPartials(oscPathX);
  const pathPartialsY = buildOscPathPartials(oscPathY);
  
  // Create two encoders side by side - one for X (pan), one for Y (tilt)
  // X encoder (Pan)
  return `<node ID='${idX}' type='ENCODER'>
<properties>
<property type='b'>
<key><![CDATA[background]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[color]]></key>
<value>
<r>${parseInt(color.slice(1, 3), 16) / 255}</r>
<g>${parseInt(color.slice(3, 5), 16) / 255}</g>
<b>${parseInt(color.slice(5, 7), 16) / 255}</b>
<a>${parseInt(color.slice(7, 9) || 'ff', 16) / 255}</a>
</value>
</property>
<property type='f'>
<key><![CDATA[cornerRadius]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[cursor]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[cursorDisplay]]></key>
<value>0</value>
</property>
<property type='r'>
<key><![CDATA[frame]]></key>
<value>
<x>${x}</x>
<y>${y}</y>
<w>${width}</w>
<h>${height}</h>
</value>
</property>
<property type='b'>
<key><![CDATA[grabFocus]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[grid]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[gridColor]]></key>
<value>
<r>0</r>
<g>0</g>
<b>0</b>
<a>0.25</a>
</value>
</property>
<property type='i'>
<key><![CDATA[gridSteps]]></key>
<value>20</value>
</property>
<property type='b'>
<key><![CDATA[interactive]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[locked]]></key>
<value>0</value>
</property>
<property type='s'>
<key><![CDATA[name]]></key>
<value><![CDATA[${name}]]></value>
</property>
<property type='i'>
<key><![CDATA[orientation]]></key>
<value>0</value>
</property>
<property type='b'>
<key><![CDATA[outline]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[outlineStyle]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[pointerPriority]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[response]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[responseFactor]]></key>
<value>100</value>
</property>
<property type='i'>
<key><![CDATA[shape]]></key>
<value>2</value>
</property>
<property type='b'>
<key><![CDATA[visible]]></key>
<value>1</value>
</property>
</properties>
<values>
<value>
<key><![CDATA[x]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[y]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[touch]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[false]]></default>
<defaultPull>0</defaultPull>
</value>
</values>
<messages>
<osc>
<enabled>1</enabled>
<send>1</send>
<receive>1</receive>
<feedback>0</feedback>
<noDuplicates>0</noDuplicates>
<connections>1111111111</connections>
<triggers>
<trigger>
<var><![CDATA[x]]></var>
<condition>ANY</condition>
</trigger>
</triggers>
<path>
${pathPartialsX}
</path>
<arguments>
<partial>
<type>VALUE</type>
<conversion>FLOAT</conversion>
<value><![CDATA[x]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
</arguments>
</osc>
</messages>
</node>
<node ID='${idY}' type='ENCODER'>
<properties>
<property type='b'>
<key><![CDATA[background]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[color]]></key>
<value>
<r>${parseInt(color.slice(1, 3), 16) / 255}</r>
<g>${parseInt(color.slice(3, 5), 16) / 255}</g>
<b>${parseInt(color.slice(5, 7), 16) / 255}</b>
<a>${parseInt(color.slice(7, 9) || 'ff', 16) / 255}</a>
</value>
</property>
<property type='f'>
<key><![CDATA[cornerRadius]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[cursor]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[cursorDisplay]]></key>
<value>0</value>
</property>
<property type='r'>
<key><![CDATA[frame]]></key>
<value>
<x>${x + width + 10}</x>
<y>${y}</y>
<w>${width}</w>
<h>${height}</h>
</value>
</property>
<property type='b'>
<key><![CDATA[grabFocus]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[grid]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[gridColor]]></key>
<value>
<r>0</r>
<g>0</g>
<b>0</b>
<a>0.25</a>
</value>
</property>
<property type='i'>
<key><![CDATA[gridSteps]]></key>
<value>20</value>
</property>
<property type='b'>
<key><![CDATA[interactive]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[locked]]></key>
<value>0</value>
</property>
<property type='s'>
<key><![CDATA[name]]></key>
<value><![CDATA[${name}_y]]></value>
</property>
<property type='i'>
<key><![CDATA[orientation]]></key>
<value>0</value>
</property>
<property type='b'>
<key><![CDATA[outline]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[outlineStyle]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[pointerPriority]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[response]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[responseFactor]]></key>
<value>100</value>
</property>
<property type='i'>
<key><![CDATA[shape]]></key>
<value>2</value>
</property>
<property type='b'>
<key><![CDATA[visible]]></key>
<value>1</value>
</property>
</properties>
<values>
<value>
<key><![CDATA[x]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[y]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[touch]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[false]]></default>
<defaultPull>0</defaultPull>
</value>
</values>
<messages>
<osc>
<enabled>1</enabled>
<send>1</send>
<receive>1</receive>
<feedback>0</feedback>
<noDuplicates>0</noDuplicates>
<connections>1111111111</connections>
<triggers>
<trigger>
<var><![CDATA[y]]></var>
<condition>ANY</condition>
</trigger>
</triggers>
<path>
${pathPartialsY}
</path>
<arguments>
<partial>
<type>VALUE</type>
<conversion>FLOAT</conversion>
<value><![CDATA[y]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
</arguments>
</osc>
</messages>
</node>`;
};

// Create XML for a button
export const createButtonXml = (
  name: string,
  oscPath: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string = '#00ff00ff'
): string => {
  const id = generateId();
  const pathPartials = buildOscPathPartials(oscPath);
  return `<node ID='${id}' type='BUTTON'>
<properties>
<property type='b'>
<key><![CDATA[background]]></key>
<value>1</value>
</property>
<property type='c'>
<key><![CDATA[color]]></key>
<value>
<r>${parseInt(color.slice(1, 3), 16) / 255}</r>
<g>${parseInt(color.slice(3, 5), 16) / 255}</g>
<b>${parseInt(color.slice(5, 7), 16) / 255}</b>
<a>${parseInt(color.slice(7, 9) || 'ff', 16) / 255}</a>
</value>
</property>
<property type='f'>
<key><![CDATA[cornerRadius]]></key>
<value>1</value>
</property>
<property type='r'>
<key><![CDATA[frame]]></key>
<value>
<x>${x}</x>
<y>${y}</y>
<w>${width}</w>
<h>${height}</h>
</value>
</property>
<property type='b'>
<key><![CDATA[grabFocus]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[interactive]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[locked]]></key>
<value>0</value>
</property>
<property type='s'>
<key><![CDATA[name]]></key>
<value><![CDATA[${name}]]></value>
</property>
<property type='i'>
<key><![CDATA[orientation]]></key>
<value>0</value>
</property>
<property type='b'>
<key><![CDATA[outline]]></key>
<value>1</value>
</property>
<property type='i'>
<key><![CDATA[outlineStyle]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[pointerPriority]]></key>
<value>0</value>
</property>
<property type='i'>
<key><![CDATA[shape]]></key>
<value>1</value>
</property>
<property type='b'>
<key><![CDATA[visible]]></key>
<value>1</value>
</property>
</properties>
<values>
<value>
<key><![CDATA[x]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[0]]></default>
<defaultPull>0</defaultPull>
</value>
<value>
<key><![CDATA[touch]]></key>
<locked>0</locked>
<lockedDefaultCurrent>0</lockedDefaultCurrent>
<default><![CDATA[false]]></default>
<defaultPull>0</defaultPull>
</value>
</values>
<messages>
<osc>
<enabled>1</enabled>
<send>1</send>
<receive>1</receive>
<feedback>0</feedback>
<noDuplicates>0</noDuplicates>
<connections>1111111111</connections>
<triggers>
<trigger>
<var><![CDATA[x]]></var>
<condition>ANY</condition>
</trigger>
</triggers>
<path>
${pathPartials}
</path>
<arguments>
<partial>
<type>VALUE</type>
<conversion>FLOAT</conversion>
<value><![CDATA[x]]></value>
<scaleMin>0</scaleMin>
<scaleMax>1</scaleMax>
</partial>
</arguments>
</osc>
</messages>
</node>`;
};

// Generate XML for 512 channel strip
// Helper to extract just the children nodes for pasting into existing layouts
const extractChildrenNodes = (fullXml: string): string => {
  const childrenMatch = fullXml.match(/<children>([\s\S]*?)<\/children>/);
  if (childrenMatch && childrenMatch[1]) {
    return childrenMatch[1].trim();
  }
  // Fallback: return full XML if we can't extract children
  return fullXml;
};

export const generate512ChannelXml = (oscBasePath: string = '/channel', extractChildren: boolean = false): string => {
  let xml = `<?xml version='1.0' encoding='UTF-8'?>\n`;
  xml += `<lexml version='5'>\n`;
  xml += `<node ID='${generateId()}' type='GROUP'>\n`;
  xml += `<properties>\n`;
  xml += `<property type='r'>\n`;
  xml += `<key><![CDATA[frame]]></key>\n`;
  xml += `<value>\n`;
  xml += `<x>0</x>\n`;
  xml += `<y>0</y>\n`;
  xml += `<w>640</w>\n`;
  xml += `<h>860</h>\n`;
  xml += `</value>\n`;
  xml += `</property>\n`;
  xml += `</properties>\n`;
  xml += `<children>\n`;

  const faderWidth = 50;
  const faderHeight = 200;
  const spacingX = 60;
  const spacingY = 220;
  let x = 20;
  let y = 20;
  const channelsPerRow = 10;

  for (let ch = 1; ch <= 512; ch++) {
    const chName = `ch${ch}`;
    const oscPath = `${oscBasePath}/${ch}`;
    xml += createFaderXml(chName, oscPath, x, y, faderWidth, faderHeight, `CH${ch}`, '#3b82f6ff');
    
    x += spacingX;
    if ((ch % channelsPerRow) === 0) {
      x = 20;
      y += spacingY;
    }
  }

  xml += `</children>\n`;
  xml += `</node>\n`;
  xml += `</lexml>\n`;
  
  // If extractChildren is true, return just the children nodes for pasting into existing layouts
  if (extractChildren) {
    return extractChildrenNodes(xml);
  }
  
  return xml;
};

// Generate XML for fixtures control
export const generateFixturesXml = (
  fixtures: FixtureInfo[],
  oscBasePath: string = '/fixture'
): string => {
  let xml = `<?xml version='1.0' encoding='UTF-8'?>\n`;
  xml += `<lexml version='5'>\n`;
  xml += `<node ID='${generateId()}' type='GROUP'>\n`;
  xml += `<properties>\n`;
  xml += `<property type='r'>\n`;
  xml += `<key><![CDATA[frame]]></key>\n`;
  xml += `<value>\n`;
  xml += `<x>0</x>\n`;
  xml += `<y>0</y>\n`;
  xml += `<w>640</w>\n`;
  xml += `<h>860</h>\n`;
  xml += `</value>\n`;
  xml += `</property>\n`;
  xml += `</properties>\n`;
  xml += `<children>\n`;

  const fixtureColors = [
    '#f59e0bff', '#ec4899ff', '#3b82f6ff', '#10b981ff', '#8b5cf6ff',
    '#06b6d8ff', '#f43f5eff', '#a855f7ff', '#ef4444ff', '#14b8a6ff'
  ];

  let x = 20;
  let y = 20;
  const encoderSize = 150;
  const spacing = 180;
  const itemsPerRow = 3;

  fixtures.forEach((fixture, index) => {
    const color = fixtureColors[index % fixtureColors.length];
    const fixtureName = fixture.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // XY Pad for Pan/Tilt - create two encoders side by side
    const panPath = `${oscBasePath}/${fixture.id}/pan` || `/fixture/${fixture.id}/pan`;
    const tiltPath = `${oscBasePath}/${fixture.id}/tilt` || `/fixture/${fixture.id}/tilt`;
    xml += createEncoderXml(
      `${fixtureName}_pan_tilt`,
      panPath,
      tiltPath,
      x,
      y,
      encoderSize,
      encoderSize,
      fixture.name,
      color
    );

    x += spacing;
    if ((index + 1) % itemsPerRow === 0) {
      x = 20;
      y += spacing;
    }
  });

  xml += `</children>\n`;
  xml += `</node>\n`;
  xml += `</lexml>\n`;
  return xml;
};

// Generate XML for scene launchers
export const generateScenesXml = (
  scenes: SceneInfo[],
  oscBasePath: string = '/scene'
): string => {
  let xml = `<?xml version='1.0' encoding='UTF-8'?>\n`;
  xml += `<lexml version='5'>\n`;
  xml += `<node ID='${generateId()}' type='GROUP'>\n`;
  xml += `<properties>\n`;
  xml += `<property type='r'>\n`;
  xml += `<key><![CDATA[frame]]></key>\n`;
  xml += `<value>\n`;
  xml += `<x>0</x>\n`;
  xml += `<y>0</y>\n`;
  xml += `<w>640</w>\n`;
  xml += `<h>860</h>\n`;
  xml += `</value>\n`;
  xml += `</property>\n`;
  xml += `</properties>\n`;
  xml += `<children>\n`;

  let x = 20;
  let y = 20;
  const buttonWidth = 120;
  const buttonHeight = 60;
  const spacingX = 140;
  const spacingY = 80;
  const itemsPerRow = 4;

  scenes.forEach((scene, index) => {
    const sceneName = scene.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    // Use scene OSC address if available, otherwise use standard format
    const oscPath = scene.oscAddress || `${oscBasePath}/load` || `/scene/load`;
    const color = index % 2 === 0 ? '#10b981ff' : '#3b82f6ff';
    
    xml += createButtonXml(
      `scene_${sceneName}`,
      oscPath,
      x,
      y,
      buttonWidth,
      buttonHeight,
      scene.name,
      color
    );

    x += spacingX;
    if ((index + 1) % itemsPerRow === 0) {
      x = 20;
      y += spacingY;
    }
  });

  xml += `</children>\n`;
  xml += `</node>\n`;
  xml += `</lexml>\n`;
  return xml;
};

// Generate complete XML with all sections
export const generateCompleteXml = (options: TouchOscXmlOptions): string => {
  const { fixtures, scenes, pinnedChannels = [], width = 640, height = 860, oscBasePath = '' } = options;
  
  let xml = `<?xml version='1.0' encoding='UTF-8'?>\n`;
  xml += `<lexml version='5'>\n`;
  xml += `<node ID='${generateId()}' type='GROUP'>\n`;
  xml += `<properties>\n`;
  xml += `<property type='r'>\n`;
  xml += `<key><![CDATA[frame]]></key>\n`;
  xml += `<value>\n`;
  xml += `<x>0</x>\n`;
  xml += `<y>0</y>\n`;
  xml += `<w>${width}</w>\n`;
  xml += `<h>${height}</h>\n`;
  xml += `</value>\n`;
  xml += `</property>\n`;
  xml += `</properties>\n`;
  xml += `<children>\n`;

  // Add fixtures
  if (fixtures.length > 0) {
    fixtures.forEach((fixture, index) => {
      const fixtureName = fixture.name.replace(/[^a-zA-Z0-9]/g, '_');
      const x = 20 + (index % 3) * 200;
      const y = 20 + Math.floor(index / 3) * 200;
      
      // XY Pad - Pan and Tilt encoders
      const panPath = `${oscBasePath}/fixture/${fixture.id}/pan` || `/fixture/${fixture.id}/pan`;
      const tiltPath = `${oscBasePath}/fixture/${fixture.id}/tilt` || `/fixture/${fixture.id}/tilt`;
      xml += createEncoderXml(
        `${fixtureName}_pan_tilt`,
        panPath,
        tiltPath,
        x,
        y,
        150,
        150,
        fixture.name,
        '#3b82f6ff'
      );
    });
  }

  // Add scenes
  if (scenes.length > 0) {
    scenes.forEach((scene, index) => {
      const sceneName = scene.name.replace(/[^a-zA-Z0-9]/g, '_');
      const x = 20 + (index % 4) * 140;
      const y = 400 + Math.floor(index / 4) * 80;
      const oscPath = scene.oscAddress || `${oscBasePath}/scene/${sceneName}/load`;
      
      xml += createButtonXml(
        `scene_${sceneName}`,
        oscPath,
        x,
        y,
        120,
        60,
        scene.name,
        '#10b981ff'
      );
    });
  }

  xml += `</children>\n`;
  xml += `</node>\n`;
  xml += `</lexml>\n`;
  return xml;
};

