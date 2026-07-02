# SaveTheHives_2: Security & Privacy

## 1. Client-Side Data Handling
SaveTheHives_2 operates as a Progressive Web Application (PWA). Currently, all legacy marker points and historic field notes are statically bundled and served. 

There is **no** continuous connection to a backend SQL database in the primary map view, ensuring that:
- User queries (ZIP codes or GPS locations) are purely front-end interactions.
- Panning, zooming, and map filtration expose no traffic other than static map tiles (MapLibre/OpenStreetMap).

## 2. Geolocation Privacy
The application only invokes `navigator.geolocation` when the user explicitly clicks the "GPS Locate" button. 
- The resulting coordinates are passed directly into the MapLibre `flyTo()` method.
- Real-time location data is **never** stored, cached, or transmitted to any external server (apart from resolving the initial map tile chunking).

## 3. WebGL Context Security
The MapLibre GL JS engine executes entirely within the browser's WebGL context. There is no remote execution of scripts or server-side rendering of the markers, effectively bypassing common injection attacks associated with dynamic GIS frameworks.

*For future updates involving live user reporting and authentication, this document will be expanded to outline the rigorous authentication and payload sanitation protocols.*
