document.addEventListener('DOMContentLoaded', () => {
  const infoBox = document.getElementById('info-box');
  const defaultMessage = document.getElementById('default-message');
  const stateNameElement = document.getElementById('state-name');
  const stateChairElement = document.getElementById('state-chair');
  const stateRegionalDirectorElement = document.getElementById('state-regional-director');
  const stateSlackLinkElement = document.getElementById('state-slack-link');
  const exitButton = document.getElementById('exit-button');

  let map;
  let geojsonLayer;
  let selectedStateLayer;
  let markersLayer;
  let markerClusterGroup;

  let allStatesGeoJSON;
  let displayStatesGeoJSON;

  let chaptersDataGlobal = [];

  // LOCAL chapters per state (from chapters.csv point-in-polygon)
  const stateCounts = {};

  // State chapter data (from chairs.csv)
  const chairData = {};

  function getColor(count) {
    // Base choropleth for locals
    return count > 10 ? '#08306b'
      : count > 8 ? '#08519c'
        : count > 6 ? '#2171b5'
          : count > 4 ? '#4292c6'
            : count > 2 ? '#6baed6'
              : count > 1 ? '#9ecae1'
                : '#c6dbef';
  }

  function applyFontToMap() {
    const mapElements = document.querySelectorAll(
      '.leaflet-container, .leaflet-popup-content, .marker-cluster div, .leaflet-tooltip'
    );
    mapElements.forEach(el => {
      el.style.fontFamily = "'Montserrat', sans-serif";
    });
  }

  function showExitButton() {
    exitButton.classList.add('visible');
    exitButton.style.display = 'block';
  }

  function hideExitButton() {
    exitButton.classList.remove('visible');
    exitButton.style.display = 'none';
  }

  function initializeMap() {
    map = L.map('map', { zoomControl: false }).setView([39.8283, -98.5795], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: 'Map data &copy; OpenStreetMap contributors',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    applyFontToMap();
  }

  const customIcon = L.divIcon({
    className: 'custom-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  function addClusteredMarkers() {
    markerClusterGroup = L.markerClusterGroup({
      iconCreateFunction: function (cluster) {
        const childCount = cluster.getChildCount();
        let clusterClass = 'marker-cluster-small';

        if (childCount > 50) clusterClass = 'marker-cluster-large';
        else if (childCount > 10) clusterClass = 'marker-cluster-medium';

        return new L.DivIcon({
          html: `<div><span>${childCount}</span></div>`,
          className: `marker-cluster ${clusterClass}`,
          iconSize: [40, 40]
        });
      }
    });

    chaptersDataGlobal.forEach(row => {
      const latitude = row['Latitude'];
      const longitude = row['Longitude'];
      const city = row['City'];
      const chapterName = row['ChapterName'];
      const chapterLeaderName = row['ChapterLeaderName'];

      if (latitude && longitude && chapterName && city && chapterLeaderName) {
        const marker = L.marker([+latitude, +longitude], { icon: customIcon });
        marker.bindPopup(`
          <b><span style="color: #0F1B79;">${chapterName}</span></b><br>
          <i>${city}</i><br>
          Chapter Leader: ${chapterLeaderName}
        `);
        markerClusterGroup.addLayer(marker);
      }
    });

    map.addLayer(markerClusterGroup);
    applyFontToMap();
  }

  function addStatesToMap() {
    // Always draw from displayStatesGeoJSON (chair states OR local states)
    geojsonLayer = L.geoJSON(displayStatesGeoJSON, {
      style: feature => {
        const stateName = feature.properties.name.trim();
        const localCount = stateCounts[stateName] || 0;
        const hasChair = !!chairData[stateName];

        // ✅ Chair-only states are emphasized so they are obvious/clickable
        const isChairOnly = hasChair && localCount === 0;

        return {
          color: hasChair ? '#0F1B79' : '#ffffff',
          weight: hasChair ? 2.5 : 1,
          fillColor: isChairOnly ? '#d9d9d9' : getColor(localCount),
          fillOpacity: 0.75
        };
      },

      onEachFeature: (feature, layer) => {
        const stateName = feature.properties.name.trim();

        layer.on({
          mouseover: e => {
            const layerTarget = e.target;
            layerTarget.setStyle({ weight: 5, color: '#0F1B79' });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              layerTarget.bringToFront();
            }
          },

          mouseout: e => geojsonLayer.resetStyle(e.target),

          click: () => {
            // Remove overview layers
            if (markerClusterGroup && map.hasLayer(markerClusterGroup)) map.removeLayer(markerClusterGroup);
            if (geojsonLayer && map.hasLayer(geojsonLayer)) map.removeLayer(geojsonLayer);

            // Clear previous
            if (selectedStateLayer) map.removeLayer(selectedStateLayer);
            if (markersLayer) map.removeLayer(markersLayer);

            // Fill info box from chairs.csv
            const chairInfo = chairData[stateName];

            stateNameElement.textContent = stateName;
            stateChairElement.textContent = chairInfo?.Chair || 'N/A';

            if (stateRegionalDirectorElement) {
              stateRegionalDirectorElement.textContent = chairInfo?.RegionalDirector || 'N/A';
            }
            if (stateSlackLinkElement) {
              stateSlackLinkElement.textContent = chairInfo?.SlackLink || 'N/A';
            }

            infoBox.classList.remove('hidden');
            defaultMessage.classList.add('hidden');

            // Highlight selected state
            const localCount = stateCounts[stateName] || 0;
            const hasChair = !!chairData[stateName];
            const isChairOnly = hasChair && localCount === 0;

            selectedStateLayer = L.geoJSON(feature, {
              style: {
                color: '#0F1B79',
                weight: 5,
                fillColor: isChairOnly ? '#d9d9d9' : getColor(localCount),
                fillOpacity: 0.75
              }
            }).addTo(map);

            // Add local markers (if any)
            markersLayer = L.layerGroup();
            chaptersDataGlobal.forEach(row => {
              const latitude = row['Latitude'];
              const longitude = row['Longitude'];
              const chapterStateName = row['DeterminedState'];

              if (chapterStateName === stateName && latitude && longitude) {
                const marker = L.marker([+latitude, +longitude], { icon: customIcon });
                marker.bindPopup(`
                  <b><span style="color: #0F1B79;">${row['ChapterName']}</span></b><br>
                  <i>${row['City']}</i><br>
                  Chapter Leader: ${row['ChapterLeaderName']}
                `);
                markersLayer.addLayer(marker);
              }
            });

            map.addLayer(markersLayer);

            // Fit to state bounds regardless of marker count
            map.fitBounds(layer.getBounds());

            showExitButton();
            applyFontToMap();
          }
        });
      }
    }).addTo(map);

    applyFontToMap();
  }

  function resetMap() {
    if (selectedStateLayer) map.removeLayer(selectedStateLayer);
    if (markersLayer) map.removeLayer(markersLayer);
    if (geojsonLayer) map.removeLayer(geojsonLayer);

    infoBox.classList.add('hidden');
    defaultMessage.classList.remove('hidden');
    hideExitButton();

    map.setView([39.8283, -98.5795], 5);

    if (markerClusterGroup && !map.hasLayer(markerClusterGroup)) {
      map.addLayer(markerClusterGroup);
    }

    addStatesToMap();
    applyFontToMap();
  }

  exitButton.addEventListener('click', resetMap);

  Promise.all([d3.csv('chairs.csv'), d3.csv('chapters.csv')])
    .then(([chairsData, chaptersData]) => {
      // Chairs: build chairData map
      chairsData.forEach(row => {
        const stateName = (row.State || '').trim();
        if (!stateName) return;

        const regionalDirector = (row['Regional Director'] || row['RegionalDirector'] || '').trim();
        const slackLink = (row.Slacks || '').trim();

        chairData[stateName] = {
          Chair: (row.Chair || '').trim(),
          RegionalDirector: regionalDirector,
          SlackLink: slackLink
        };
      });

      chaptersDataGlobal = chaptersData;

      return fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
        .then(r => r.json())
        .then(geojsonData => {
          allStatesGeoJSON = geojsonData;

          // Init all state counts to 0
          allStatesGeoJSON.features.forEach(f => {
            const name = f.properties.name.trim();
            stateCounts[name] = 0;
          });

          // Assign each chapter to a state + count locals
          chaptersDataGlobal.forEach(row => {
            const latitude = row['Latitude'];
            const longitude = row['Longitude'];
            const city = row['City'];
            const chapterName = row['ChapterName'];
            const chapterLeaderName = row['ChapterLeaderName'];

            if (latitude && longitude && chapterName && city && chapterLeaderName) {
              const point = turf.point([+longitude, +latitude]);
              let chapterStateName = null;

              for (let i = 0; i < allStatesGeoJSON.features.length; i++) {
                const stateFeature = allStatesGeoJSON.features[i];
                if (turf.booleanPointInPolygon(point, stateFeature)) {
                  chapterStateName = stateFeature.properties.name.trim();
                  break;
                }
              }

              if (chapterStateName) {
                stateCounts[chapterStateName] = (stateCounts[chapterStateName] || 0) + 1;
                row['DeterminedState'] = chapterStateName;
              }
            }
          });

          // ✅ MAIN LOGIC:
          // Show state if it has locals OR it has a chair entry
          displayStatesGeoJSON = {
            type: "FeatureCollection",
            features: allStatesGeoJSON.features.filter(f => {
              const name = f.properties.name.trim();
              const hasLocals = (stateCounts[name] || 0) > 0;
              const hasChair = !!chairData[name];
              return hasLocals || hasChair;
            })
          };

          initializeMap();
          addClusteredMarkers();
          addStatesToMap();
        });
    })
    .catch(err => console.error('Error loading data:', err));
});
