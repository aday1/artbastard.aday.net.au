# Fixture Intake Checklist

Use this checklist for each uploaded manual/photo batch before adding a fixture
to ArtBastard.

## Identify

- Catalog ID: next `AB-FIX-###`
- Visible fixture labels, brand, model and confidence level
- Product category, such as moving head spot, LED wash, laser, strobe or smoke
- Gallery image path

## Extract

- Every DMX mode and channel count
- Ordered channel map with exact DMX value ranges
- Shared channel roles: pan, tilt, dimmer, colour, gobo, prism, focus, zoom,
  strobe, shutter, macro, effect, speed, reset or other
- Fine/coarse channel relationships
- DIP switch or menu addressing rules
- Service or hazardous functions such as reset, lamp power or laser emission

## Implement

- Add one canonical profile under `react-app/src/fixtures/library`
- Add the entry to `fixtureLibraryEntries`
- Document the fixture under `DOCS/fixtures`
- Store gallery assets under `react-app/public/fixtures`
- Mark unclear manual details as probable or unknown

## Verify

- `npm run test -- src/fixtures/library --run`
- `npm run build`
- Deploy beta and confirm `deploy-meta.json`, fixture strings in the JS bundle
  and gallery images over HTTP.
