  console.log("✅ HSDA map script loaded (debug build) v1");

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

  const stateCounts = {};
  const chairData = {};

  function getColor(count) {
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

    let markerCount = 0;

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
        markerCount += 1;
      }
    });

    console.log("📍 Total markers added:", markerCount);

    map.addLayer(markerClusterGroup);
    applyFontToMap();
  }

  function addStatesToMap() {
    if (!allStatesGeoJSON || !allStatesGeoJSON.features) {
      console.error("❌ allStatesGeoJSON missing or invalid");
      return;
    }

    console.log("🗺️ Drawing states:", allStatesGeoJSON.features.length);

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
        const count = stateCounts[stateName] || 0;

        // ✅ DEBUG: show tooltip always so you can SEE states exist
        layer.bindTooltip(`${stateName} (${count})`, { sticky: true });

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
            if (markerClusterGroup && map.hasLayer(markerClusterGroup)) map.removeLayer(markerClusterGroup);
            if (geojsonLayer && map.hasLayer(geojsonLayer)) map.removeLayer(geojsonLayer);

            if (selectedStateLayer) map.removeLayer(selectedStateLayer);
            if (markersLayer) map.removeLayer(markersLayer);

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

            selectedStateLayer = L.geoJSON(feature, {
              style: {
                fillColor: getColor(stateCounts[stateName] || 0),
                fillOpacity: 0.7,
                weight: 5,
                color: '#0F1B79'
              }
            }).addTo(map);

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
      chairsData.forEach(row => {
        const stateName = (row.State || '').trim();
        if (!stateName) return;

        const regionalDirector = (row['Regional Director'] || row['RegionalDirector'] || '').trim();
        const slackLink = (row.Slacks || '').trim();

        chairData[stateName] = {
          Chair: (row.Chair || '').trim(),
          RegionalDirector,
          SlackLink: slackLink
        };
      });

      console.log("👤 Chair states loaded:", Object.keys(chairData).length);

      chaptersDataGlobal = chaptersData;

      return fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
        .then(r => r.json())
        .then(geojsonData => {
          allStatesGeoJSON = geojsonData;

          console.log("📦 GeoJSON features total:", allStatesGeoJSON.features.length);
          console.log("🧾 GeoJSON first few:", allStatesGeoJSON.features.slice(0, 5).map(f => f.properties.name));

          // Initialize all states to 0
          allStatesGeoJSON.features.forEach(feature => {
            const stateName = feature.properties.name.trim();
            stateCounts[stateName] = 0;
          });

          // Determine state for each chapter + count
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

          // Debug: how many states have 0 vs >0
          const zeroStates = Object.entries(stateCounts).filter(([, c]) => c === 0).map(([s]) => s);
          const nonZeroStates = Object.entries(stateCounts).filter(([, c]) => c > 0).map(([s]) => s);

          console.log("✅ States with chapters:", nonZeroStates.length, nonZeroStates);
          console.log("✅ States with ZERO chapters:", zeroStates.length, zeroStates);

          initializeMap();
          addClusteredMarkers();
          addStatesToMap();
        });
    })
    .catch(error => console.error('Error loading data:', error));
});
