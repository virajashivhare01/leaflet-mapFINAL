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
  let chaptersDataGlobal = [];

  // Counts of LOCAL chapters per state (derived from points in chapters.csv)
  const stateCounts = {};

  // Chair info per state (from chairs.csv)
  const chairData = {};

  function getColor(count) {
    // Make zero-chapter states still visible + clickable
    if (count === 0) return '#f0f0f0';

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
      '.leaflet-container, .leaflet-popup-content, .marker-cluster div'
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

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: 'Map data &copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 19
      }
    ).addTo(map);

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
    geojsonLayer = L.geoJSON(allStatesGeoJSON, {
      style: feature => {
        const stateName = feature.properties.name.trim();
        const count = stateCounts[stateName] || 0;

        return {
          color: '#fff',
          weight: 1,
          fillColor: getColor(count),
          fillOpacity: 0.7
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
            // Hide the overview (states + clusters) when a state is selected
            if (map.hasLayer(markerClusterGroup)) map.removeLayer(markerClusterGroup);
            if (map.hasLayer(geojsonLayer)) map.removeLayer(geojsonLayer);

            if (selectedStateLayer) map.removeLayer(selectedStateLayer);
            if (markersLayer) map.removeLayer(markersLayer);

            // Chair info might exist even if local chapters don't
            const chairInfo = chairData[stateName];

            stateNameElement.textContent = stateName;

            stateChairElement.textContent =
              chairInfo && chairInfo.Chair ? chairInfo.Chair : 'N/A';

            if (stateRegionalDirectorElement) {
              stateRegionalDirectorElement.textContent =
                chairInfo && chairInfo.RegionalDirector ? chairInfo.RegionalDirector : 'N/A';
            }

            if (stateSlackLinkElement) {
              stateSlackLinkElement.textContent =
                chairInfo && chairInfo.SlackLink ? chairInfo.SlackLink : 'N/A';
            }

            infoBox.classList.remove('hidden');
            defaultMessage.classList.add('hidden');

            // Highlight the selected state
            selectedStateLayer = L.geoJSON(feature, {
              style: {
                fillColor: getColor(stateCounts[stateName] || 0),
                fillOpacity: 0.7,
                weight: 5,
                color: '#0F1B79'
              }
            }).addTo(map);

            // Add markers for chapters in this state (if any)
            markersLayer = L.layerGroup();

            let foundAnyMarkers = false;

            chaptersDataGlobal.forEach(row => {
              const latitude = row['Latitude'];
              const longitude = row['Longitude'];
              const chapterStateName = row['DeterminedState'];

              if (chapterStateName === stateName && latitude && longitude) {
                foundAnyMarkers = true;

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

            // Fit to the state bounds; if no markers, still fit to the state polygon
            map.fitBounds(layer.getBounds());

            // If you want: could optionally show a message if foundAnyMarkers === false
            // (left out to avoid requiring HTML changes)

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

  Promise.all([
    d3.csv('chairs.csv'),
    d3.csv('chapters.csv')
  ])
    .then(([chairsData, chaptersData]) => {
      // Load chair data
      chairsData.forEach(row => {
        const stateName = (row.State || '').trim();
        if (!stateName) return;

        const regionalDirector =
          (row['Regional Director'] || row['RegionalDirector'] || '').trim();

        const slackLink = (row.Slacks || '').trim();

        chairData[stateName] = {
          Chair: (row.Chair || '').trim(),
          RegionalDirector: regionalDirector,
          SlackLink: slackLink
        };
      });

      // Load chapter points
      chaptersDataGlobal = chaptersData;

      return fetch(
        'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'
      )
        .then(response => response.json())
        .then(geojsonData => {
          allStatesGeoJSON = geojsonData;

          // Initialize all states to 0 so they still appear even without chapters
          allStatesGeoJSON.features.forEach(feature => {
            const stateName = feature.properties.name.trim();
            stateCounts[stateName] = 0;
          });

          // Determine which state each chapter point is in (and count them)
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

          // ✅ IMPORTANT FIX:
          // Do NOT filter out states with 0 chapters. We want them visible/clickable
          // so chair info can be shown even when there are no local chapters.

          initializeMap();
          addClusteredMarkers();
          addStatesToMap();
        });
    })
    .catch(error => console.error('Error loading data:', error));
});
