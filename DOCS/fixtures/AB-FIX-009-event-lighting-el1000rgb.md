# AB-FIX-009: Event Lighting EL1000RGB

## Identification

- Type: Professional RGB animation laser
- Category: Laser / ILDA RGB animation laser
- Manufacturer: Event Lighting
- Model: EL1000RGB
- ArtBastard profile ID: `event-lighting-el1000rgb`
- Photo: none supplied
- Source confidence: Official manual plus user-supplied partial manual photos

## Menu

| Menu | Values | Function |
| --- | --- | --- |
| `Addr` | 1-512 | Set DMX address |
| `AUTO` | 0-9 | Auto mode 0-9 |
| `SOUN` | 0-9 | Sound active mode 0-9 |
| `VERSION` | Ver1.1 | Software version |

## 16-Channel DMX Mode

| Ch | Function | Values | Description |
| --- | --- | --- | --- |
| 1 | Laser On/Off | 0-9 / 10-255 | Laser off / laser on |
| 2 | Colour Control | See colour table | Static, dynamic and segmented colour control |
| 3 | Colour Speed | 0-9 / 10-127 / 128-255 | No function, clockwise speed or anticlockwise speed |
| 4 | Pattern Option | 0-255 | Pattern option |
| 5 | Pattern Group Option | 0-50 / 51-101 / 102-152 / 153-203 / 204-255 | Inner pattern groups 1-5 |
| 6 | Pattern Size | 0-255 | Pattern size |
| 7 | Pattern Auto Zoom | See zoom table | Auto zoom and cycle zoom speed ranges |
| 8 | Centre Rotation | 0-127 / 128-191 / 192-255 | Rotation angle, clockwise speed or anticlockwise speed |
| 9 | Horizontal Rotation | 0-127 / 128-255 | Flip horizontal location or speed |
| 10 | Vertical Rotation | 0-127 / 128-255 | Flip vertical location or speed |
| 11 | Horizontal Move | 0-127 / 128-255 | Horizontal location or horizontal auto location |
| 12 | Vertical Move | 0-127 / 128-255 | Vertical location or vertical auto location speed |
| 13 | Wave | 0-9 / 10-255 | No function / wave range and speed slow to fast |
| 14 | Pattern Drawing | See drawing table | Manual and automatic drawing behaviours |
| 15 | Inner Dynamic Effect | 0-2 / 3-229 / 230-249 / 250-255 | No function, dynamic effect, random auto effect or no documented action |
| 16 | Inner Dynamic Effect Speed | 0-127 / 128-255 | Internal-program speed or DMX-determined speed |

## Colour Control Detail

| Values | Function |
| --- | --- |
| 0-69 | Static colours, white/red/green |
| 70-79 | Colour change |
| 80-89 | Default colour |
| 90-99 | Rainbow colour |
| 100-224 | Segmented colour, controlled by colour speed |
| 225-229 | Dynamic colour 1 |
| 230-234 | Dynamic colour 2 |
| 235-239 | Dynamic colour 3 |
| 240-244 | Dynamic colour 4 |
| 245-249 | Dynamic colour 5 |
| 250-255 | Dynamic colour 6 |

## Pattern Group And Zoom Detail

| Channel | Values | Function |
| --- | --- | --- |
| Pattern Group Option | 0-50 | Inner patterns group 1 |
| Pattern Group Option | 51-101 | Inner patterns group 2 |
| Pattern Group Option | 102-152 | Inner patterns group 3 |
| Pattern Group Option | 153-203 | Inner patterns group 4 |
| Pattern Group Option | 204-255 | Inner patterns group 5 |
| Pattern Auto Zoom | 0-15 | No auto zoom |
| Pattern Auto Zoom | 16-55 | Zoom 1 speed |
| Pattern Auto Zoom | 56-95 | Zoom 2 speed |
| Pattern Auto Zoom | 96-135 | Zoom 3 speed |
| Pattern Auto Zoom | 136-175 | Cycle zoom 1 speed |
| Pattern Auto Zoom | 176-215 | Cycle zoom 2 speed |
| Pattern Auto Zoom | 216-255 | Cycle zoom 3 speed |

## Pattern Drawing Detail

| Values | Function |
| --- | --- |
| 0-1 | No function |
| 2-63 | Drawing by manual adjustment |
| 64-127 | Drawing by manual adjustment |
| 128-153 | Automatic drawing increasing |
| 154-179 | Automatic drawing decreasing |
| 180-205 | Automatic drawing increasing/reverse |
| 206-255 | Automatic drawing increasing |

## Capability Categories

- Professional RGB animation laser with ILDA support
- Laser on/off, auto mode and sound mode
- Colour, colour speed, pattern selection and pattern group controls
- Pattern size, auto zoom, centre rotation, horizontal/vertical transforms
- Wave, drawing and inner dynamic effect controls

## Sources

- Official manual: https://content.event-lighting.com.au/manuals/EL1000RGB%20manual.pdf
- Search mirror used for text checking: https://www.manualslib.com/manual/2960245/Event-Lighting-El1000rgb.html

## Safety Notes

This is a high-power RGB laser with ILDA support. ArtBastard records the DMX
patch and control map; it does not certify audience scanning or safety
compliance.
