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

    function showExitButton() {
        exitButton.style.display = 'block';
    }

    function hideExitButton() {
        exitButton.style.display = 'none';
    }

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
        geojsonLayer = L.geoJSON(allSt
