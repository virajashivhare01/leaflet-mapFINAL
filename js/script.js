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

    function applyFontToMap() {
        const mapElements = document.querySelectorAll('.leaflet-container, .leaflet-popup-content, .marker-cluster div');
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
            attribution: 'Map data © OpenStreetMap contributors',
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
                    <b><span style="color:#0F1B79;">${chapterName}</span></b><br>
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
                const chairInfo = chairData[stateName];

                layer.on({
                    mouseover: e => {
                        const hovered = e.target;
                        hovered.setStyle({ weight: 5, color: '#0F1B79' });
                        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) hovered.bringToFront();
                    },
                    mouseout: e => geojsonLayer.resetStyle(e.target),
                    click: () => {
                        map.removeLayer(markerClusterGroup);
                        map.removeLayer(geojsonLayer);
                        if (selectedStateLayer) map.removeLayer(selectedStateLayer);
                        if (markersLayer) map.removeLayer(markersLayer);

                        stateNameElement.textContent = stateName;

                        stateChairElement.textContent =
                            chairInfo && chairInfo.Chair ? chairInfo.Chair : 'N/A';

                        stateRegionalDirectorElement.textContent =
                            chairInfo && chairInfo.RegionalDirector ? chairInfo.RegionalDirector : 'N/A';

                        stateSlackLinkElement.textContent =
                            chairInfo && chairInfo.SlackLink ? chairInfo.SlackLink : 'N/A';

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
                            const chapterState = row['DeterminedState'];
                            const latitude = row['Latitude'];
                            const longitude = row['Longitude'];

                            if (chapterState === stateName && latitude && longitude) {
                                const marker = L.marker([+latitude, +longitude], { icon: customIcon });
                                marker.bindPopup(`
                                    <b><span style="color:#0F1B79;">${row['ChapterName']}</span></b><br>
                                    <i>${row['City']}</i><br>
                                    Chapter Leader: ${row['ChapterLeaderName']}
                                `);
                                markersLayer.addLayer(marker);
                            }
                        });

                        map.addLayer(markersLayer);
                        map.fitBounds(layer.getBounds());
                        showExitButton();
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
        if (!map.hasLayer(markerClusterGroup)) map.addLayer(markerClusterGroup);
        addStatesToMap();
    }

    exitButton.addEventListener('click', resetMap);

    Promise.all([
        d3.csv('chairs.csv'),
        d3.csv('chapters.csv')
    ]).then(([chairsData, chaptersData]) => {

        chairsData.forEach(row => {
            const stateName = (row.State || '').trim();
            if (!stateName) return;

            const regionalDirector = (row['Regional Director'] || '').trim();

            const slackLink = (row['Slack Link'] || '').trim();

            chairData[stateName] = {
                Chair: (row.Chair || '').trim(),
                RegionalDirector: regionalDirector,
                SlackLink: slackLink
            };
        });

        chaptersDataGlobal = chaptersData;

        fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
            .then(response => response.json())
            .then(geojsonData => {

                allStatesGeoJSON = geojsonData;

                chaptersDataGlobal.forEach(row => {
                    const latitude = row['Latitude'];
                    const longitude = row['Longitude'];
                    const chapterName = row['ChapterName'];
                    const city = row['City'];

                    if (latitude && longitude && chapterName && city) {
                        const point = turf.point([+longitude, +latitude]);
                        let chapterStateName = null;

                        for (let i = 0; i < allStatesGeoJSON.features.length; i++) {
                            const feature = allStatesGeoJSON.features[i];
                            if (turf.booleanPointInPolygon(point, feature)) {
                                chapterStateName = feature.properties.name.trim();
                                break;
                            }
                        }

                        if (chapterStateName) {
                            stateCounts[chapterStateName] = (stateCounts[chapterStateName] || 0) + 1;
                            row['DeterminedState'] = chapterStateName;
                        }
                    }
                });

                allStatesGeoJSON.features = allStatesGeoJSON.features.filter(f =>
                    stateCounts[f.properties.name.trim()] > 0
                );

                initializeMap();
                addClusteredMarkers();
                addStatesToMap();
            });
    });
});
