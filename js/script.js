document.addEventListener('DOMContentLoaded', () => {
    const infoBox = document.getElementById('info-box');
    const defaultMessage = document.getElementById('default-message');
    const stateNameElement = document.getElementById('state-name');
    const stateChairElement = document.getElementById('state-chair');
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
        return count > 10 ? '#08306b' :
               count > 8 ? '#08519c' :
               count > 6 ? '#2171b5' :
               count > 4 ? '#4292c6' :
               count > 2 ? '#6baed6' :
               count > 1 ? '#9ecae1' : '#c6dbef';
    }

    function initializeMap() {
        map = L.map('map', { zoomControl: false }).setView([39.8283, -98.5795], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: 'Map data &copy; OpenStreetMap contributors',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    const customIcon = L.divIcon({
        className: 'custom-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    d3.csv('chairs.csv').then(chairsData => {
        chairsData.forEach(row => {
            const stateName = row['State'].trim();
            chairData[stateName] = {
                Chair: row['Chair'].trim(),
                'Regional Director': row['Regional Director']?.trim() || 'N/A'
            };
        });

        d3.csv('chapters.csv').then(chaptersData => {
            chaptersDataGlobal = chaptersData;

            chaptersDataGlobal.forEach(row => {
                const stateName = row['State'].trim();
                stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;
            });

            fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
                .then(res => res.json())
                .then(geojsonData => {
                    allStatesGeoJSON = geojsonData;

                    initializeMap();
                    addClusteredMarkers();
                    addStatesToMap();
                });
        });
    });

    function addClusteredMarkers() {
        markerClusterGroup = L.markerClusterGroup();
        chaptersDataGlobal.forEach(row => {
            const latitude = row['Latitude'];
            const longitude = row['Longitude'];
            if (!latitude || !longitude) return;

            const marker = L.marker([+latitude, +longitude], { icon: customIcon });
            marker.bindPopup(`
                <b style="color:#0F1B79;">${row['ChapterName']}</b><br>
                City: ${row['City']}<br>
                Leader: ${row['ChapterLeaderName']}
            `);
            markerClusterGroup.addLayer(marker);
        });
        map.addLayer(markerClusterGroup);
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
                    fillOpacity: count > 0 ? 0.7 : 0
                };
            },
            onEachFeature: (feature, layer) => {
                const stateName = feature.properties.name.trim();
                layer.on({
                    mouseover: e => e.target.setStyle({ weight: 4, color: '#0F1B79', fillOpacity: 0.8 }),
                    mouseout: e => geojsonLayer.resetStyle(e.target),
                    click: () => {
                        // Remove previous layers
                        if (selectedStateLayer) map.removeLayer(selectedStateLayer);
                        if (markersLayer) map.removeLayer(markersLayer);

                        // Highlight state
                        selectedStateLayer = L.geoJSON(feature, {
                            style: {
                                fillColor: getColor(stateCounts[stateName] || 0),
                                fillOpacity: 0.7,
                                weight: 5,
                                color: '#0F1B79'
                            }
                        }).addTo(map);

                        // Show info
                        stateNameElement.textContent = stateName;
                        stateChairElement.innerHTML = `
                            Chair: ${chairData[stateName]?.Chair || 'N/A'}<br>
                            Regional Director: ${chairData[stateName]?.['Regional Director'] || 'N/A'}
                        `;
                        infoBox.classList.remove('hidden');
                        defaultMessage.classList.add('hidden');

                        // Add state markers
                        markersLayer = L.layerGroup();
                        chaptersDataGlobal.forEach(row => {
                            if (row['State'].trim() === stateName) {
                                const lat = row['Latitude'];
                                const lng = row['Longitude'];
                                if (lat && lng) {
                                    const marker = L.marker([+lat, +lng], { icon: customIcon });
                                    marker.bindPopup(`
                                        <b style="color:#0F1B79;">${row['ChapterName']}</b><br>
                                        City: ${row['City']}<br>
                                        Leader: ${row['ChapterLeaderName']}
                                    `);
                                    markersLayer.addLayer(marker);
                                }
                            }
                        });
                        map.addLayer(markersLayer);

                        map.fitBounds(layer.getBounds());
                    }
                });
            }
        }).addTo(map);
    }

    exitButton.addEventListener('click', () => {
        if (selectedStateLayer) map.removeLayer(selectedStateLayer);
        if (markersLayer) map.removeLayer(markersLayer);
        if (geojsonLayer) map.removeLayer(geojsonLayer);

        addStatesToMap();
        infoBox.classList.add('hidden');
        defaultMessage.classList.remove('hidden');

        map.setView([39.8283, -98.5795], 5);
    });
});
