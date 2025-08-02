// Connect to Socket.IO server
const socket = io.connect('http://localhost:5000', {
  query: { service_type: 'medical' }
});

let map;
let selectedMedicalMarker = null;
let isMapExpanded = false;
let isExpanded = false;
let expandedMapControls = null;
let userLocationMarker = null;
let medicalServiceProfile = null;

let selectedAlertLocation = null;
let routeControl = null;

let allAlertMarkers = [];

document.addEventListener('DOMContentLoaded', async function () {
  let initialLat = 23.685; // Fallback: center of Bangladesh
  let initialLng = 90.3563;
  let initialZoom = 7; // Zoom out if location is default or not found

  const medicalServiceEmail = localStorage.getItem('medicalServiceEmail');

  if (medicalServiceEmail) {
    try {
      const res = await fetch('http://localhost:5000/api/medical/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: medicalServiceEmail })
      });
      const data = await res.json();
      if (data.status === 'success' && data.lat && data.lng) {
        medicalServiceProfile = data;
        initialLat = parseFloat(data.lat);
        initialLng = parseFloat(data.lng);
        initialZoom = 15;
        console.log('Medical service profile loaded:', medicalServiceProfile);
      } else {
        console.warn('Failed to load medical service profile or location data missing:', data.message || 'No specific error message from server.');
      }
    } catch (err) {
      console.warn('Error fetching medical service profile:', err);
    }
  } else {
    console.warn('No medicalServiceEmail found in localStorage. Cannot load profile or specific location.');
    window.location.href = 'medical-login.html';
    return;
  }

  // Initialize map
  map = L.map('osm-map').setView([initialLat, initialLng], initialZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Add marker for the medical service location if profile was loaded successfully
  if (medicalServiceProfile && medicalServiceProfile.lat && medicalServiceProfile.lng) {
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    userLocationMarker = L.circleMarker([parseFloat(medicalServiceProfile.lat), parseFloat(medicalServiceProfile.lng)], {
      radius: 10,
      fillColor: '#007bff',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.7
    }).addTo(map).bindPopup(`<b>${medicalServiceProfile.company_name || 'Your Location'}</b>`).openPopup();
  }

  // Setup profile icon click listener
  const profileIcon = document.querySelector('.medical-profile .fa-user-circle');
  if (profileIcon) {
    profileIcon.addEventListener('click', function () {
      if (!medicalServiceProfile) {
        showProfileModal({
          error: true,
          message: 'Profile not loaded. Please ensure you are logged in and refresh the page.'
        });
        return;
      }
      showProfileModal(medicalServiceProfile);
    });
  }

  // Logout button click
  const logoutBtn = document.getElementById('medical-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('medicalServiceEmail');
      window.location.href = 'medical-login.html';
    });
  }

  // Sidebar navigation
  const sidebarItems = document.querySelectorAll('.medical-sidebar nav ul li');
  sidebarItems.forEach(item => {
    item.addEventListener('click', function() {
      sidebarItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      const section = this.textContent.trim().toLowerCase();
      if (section === 'map') {
        toggleMapView();
      } else if (section === 'alerts') {
        showAlertsView();
      } else {
        console.log(`Switching to ${section} section`);
        if (isMapExpanded && section !== 'map') {
            showAlertsView();
        }
      }
    });
  });

  // Fetch initial medical alerts
  fetch('http://localhost:5000/api/medical/alerts')
    .then(res => res.json())
    .then(alerts => {
      alerts.forEach(alert => addMedicalAlertToList(alert));
      updateAlertsUI();
    })
    .catch((err) => {
      console.error('Could not load medical alerts from server:', err);
    });

  // Expand/Collapse functionality for alerts list
  const expandBtn = document.getElementById('expand-alerts');
  const alertsList = document.querySelector('.alerts-list');
  const expandControls = document.querySelector('.alerts-expand-controls');

  if (expandBtn && alertsList && expandControls) {
    expandBtn.addEventListener('click', function() {
      isExpanded = !isExpanded;
      if (isExpanded) {
        alertsList.classList.remove('collapsed');
        alertsList.classList.add('expanded');
        expandBtn.classList.add('expanded');
        expandBtn.querySelector('.expand-text').textContent = 'Show Less';
        expandBtn.querySelector('i').style.transform = 'rotate(180deg)';
      } else {
        alertsList.classList.remove('expanded');
        alertsList.classList.add('collapsed');
        expandBtn.classList.remove('expanded');
        expandBtn.querySelector('.expand-text').textContent = 'Show All Alerts';
        expandBtn.querySelector('i').style.transform = 'rotate(0deg)';
      }
    });
  } else {
    console.warn('Expand/collapse elements not found for alerts list.');
  }

  // Initial UI update for alerts
  updateAlertsUI();
});

// Function to show modern profile modal
function showProfileModal(profileData) {
  // Remove existing modal if any
  const existingModal = document.getElementById('medical-profile-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'medical-profile-modal-overlay';
  modalOverlay.id = 'medical-profile-modal';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'medical-profile-modal';

  if (profileData.error) {
    // Error state
    modalContent.innerHTML = `
      <div class="profile-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h2>Profile Error</h2>
      <p style="color: #2e7d32; text-align: center; margin: 16px 0;">${profileData.message}</p>
      <button class="close-profile-modal">Close</button>
    `;
  } else {
    // Success state with profile data
    modalContent.innerHTML = `
      <div class="profile-icon">
        <i class="fas fa-ambulance"></i>
      </div>
      <h2>${profileData.company_name || 'Medical Service'}</h2>
      <ul class="profile-info-list">
        <li>
          <span class="profile-info-label">Email:</span>
          <span class="profile-info-value">${profileData.email || 'N/A'}</span>
        </li>
        <li>
          <span class="profile-info-label">Service Type:</span>
          <span class="profile-info-value">${profileData.service_type || 'N/A'}</span>
        </li>
        <li>
          <span class="profile-info-label">Phone:</span>
          <span class="profile-info-value">${profileData.phone || 'N/A'}</span>
        </li>
        <li>
          <span class="profile-info-label">Location:</span>
          <span class="profile-info-value">${profileData.lat && profileData.lng ? `${parseFloat(profileData.lat).toFixed(5)}, ${parseFloat(profileData.lng).toFixed(5)}` : 'N/A'}</span>
        </li>
      </ul>
      <button class="close-profile-modal">Close</button>
    `;
  }

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Add close functionality
  const closeBtn = modalContent.querySelector('.close-profile-modal');
  closeBtn.addEventListener('click', () => {
    modalOverlay.remove();
  });

  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modalOverlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Animate in
  setTimeout(() => {
    modalOverlay.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
  }, 10);
}

function updateAlertsUI() {
  const alertElements = document.querySelectorAll('.alerts-list .alert-card');
  const alertCount = alertElements.length;
  const alertsCountDisplay = document.querySelector('.alerts-header .alerts-count');
  const expandControls = document.querySelector('.alerts-expand-controls');
  const alertsList = document.querySelector('.alerts-list');

  if (alertsCountDisplay) {
    alertsCountDisplay.textContent = `${alertCount} alert${alertCount !== 1 ? 's' : ''}`;
  }

  if (expandControls && alertsList) {
    if (alertCount <= 2) {
      expandControls.classList.add('hidden');
      alertsList.classList.remove('collapsed', 'expanded');
    } else {
      expandControls.classList.remove('hidden');
    }
  }
}

// Listen for emergency alerts
socket.on('emergencyAlert', function(data) {
  // Only handle accident alerts
  if (data.type && data.type.toLowerCase().includes('accident')) {
    addMedicalAlertToList(data);
    addMedicalMarkerToMap(data);
    showMedicalNotification(data);
  }
});

// Function to add a medical alert to the alerts list
function addMedicalAlertToList(data) {
  const alertsList = document.querySelector('.alerts-list');
  const li = document.createElement('li');
  li.className = 'alert-card';
  li.dataset.alertId = data.id;
  li.innerHTML = `
    <div>
      <span class="alert-type"><i class="fas fa-ambulance"></i> Accident</span>
      <span class="alert-time">Just now</span>
    </div>
    <div class="alert-location"><i class="fas fa-map-marker-alt"></i> ${data.details || 'Unknown location'}</div>
    <div class="alert-actions">
      <button class="respond-btn">Respond</button>
      <button class="resolve-btn">Resolved</button>
    </div>
  `;
  alertsList.prepend(li);

  // Update UI state
  if (window.updateAlertsUI) {
    window.updateAlertsUI();
  }

  // Add interactions
  li.addEventListener('click', function() {
    const isActive = li.classList.contains('active');
    document.querySelectorAll('.alert-card').forEach(c => c.classList.remove('active'));

    if (isActive) {
      // Deselect
      if (selectedMedicalMarker) {
        map.removeLayer(selectedMedicalMarker);
        allAlertMarkers = allAlertMarkers.filter(m => m !== selectedMedicalMarker);
        selectedMedicalMarker = null;
      }
      selectedAlertLocation = null;
      document.querySelector('.medical-details .details-content').innerHTML = `<p>No alert selected.</p>`;
      if (window.routeControl) {
        map.removeControl(window.routeControl);
        window.routeControl = null;
      }
    } else {
      // Select this alert
      li.classList.add('active');
      updateAlertDetails(li, data);
      showMedicalMarkerOnMap(data);

      // Store selected alert location for routing
      if (data.location && data.location.lat && data.location.lng) {
        selectedAlertLocation = [data.location.lat, data.location.lng];
      } else {
        selectedAlertLocation = null;
      }
    }
  });

  // Respond button functionality
  li.querySelector('.respond-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    const btn = this;
    btn.textContent = 'Responding...';
    btn.style.background = '#ff9800';
    btn.disabled = true;

    // Emit socket event to backend
    socket.emit('serviceResponded', {
      alert_id: data.id,
      user_id: data.user_id,
      service_type: medicalServiceProfile?.service_type || 'accident',
      service_name: medicalServiceProfile?.company_name || 'Medical Service'
    }, function(ack) {
      // Handle acknowledgment from backend
      btn.textContent = 'Responded';
      btn.style.background = '#4caf50';
      btn.disabled = false; // This removes the spinner
      btn.style.cursor = 'default';
      btn.onclick = null; // Prevent further clicks
    });
  });

  // Resolve button functionality
  li.querySelector('.resolve-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    fetch(`http://localhost:5000/api/alerts/${data.id}/resolve`, {
      method: 'PUT'
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          li.remove();
          if (window.updateAlertsUI) {
            window.updateAlertsUI();
          }
          if (selectedMedicalMarker) {
            map.removeLayer(selectedMedicalMarker);
            selectedMedicalMarker = null;
          }
          document.querySelector('.medical-details .details-content').innerHTML = `<p>No alert selected.</p>`;
        } else {
          alert('Failed to resolve alert.');
        }
      })
      .catch(() => {
        alert('Failed to resolve alert.');
      });
  });
}

// Show medical marker only for the selected alert
function showMedicalMarkerOnMap(data) {
  // Remove previous marker if exists
  if (selectedMedicalMarker) {
    map.removeLayer(selectedMedicalMarker);
    selectedMedicalMarker = null;
  }
  if (!data.location) return;

  // Add a green circle as the marker
  selectedMedicalMarker = L.circle([data.location.lat, data.location.lng], {
    color: '#2e7d32',
    fillColor: '#2e7d32',
    fillOpacity: 1,
    radius: 20
  })
    .addTo(map)
    .bindPopup('<b>Accident Alert!</b><br>' + (data.details || ''))
    .openPopup();

    allAlertMarkers.push(selectedMedicalMarker);

  map.setView([data.location.lat, data.location.lng], 16);
}

// Show route from Medical Service to the selected alert
function showRouteToSelectedAlert() {
  if (!medicalServiceProfile || !medicalServiceProfile.lat || !medicalServiceProfile.lng) {
    alert('Your medical service location is not set.');
    return;
  }
  if (!selectedAlertLocation) {
    alert('Please select an alert to route to.');
    return;
  }

  // Remove previous route if exists
  if (window.routeControl) {
    map.removeControl(window.routeControl);
    window.routeControl = null;
  }

  // Create a new route
  window.routeControl = L.Routing.control({
    waypoints: [
      L.latLng(parseFloat(medicalServiceProfile.lat), parseFloat(medicalServiceProfile.lng)),
      L.latLng(selectedAlertLocation[0], selectedAlertLocation[1])
    ],
    routeWhileDragging: false,
    draggableWaypoints: false,
    addWaypoints: false,
    show: false,
    lineOptions: {
      styles: [{ color: '#1976D2', weight: 6 }]
    },
    createMarker: function() { return null; }
  }).addTo(map);
}

// Optional: Show a notification popup
function showMedicalNotification(data) {
  alert('🚑 New Accident Alert Received!');
}

// Function to reverse geocode coordinates to an address
function reverseGeocode(lat, lng, callback) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
    .then(response => response.json())
    .then(data => {
      if (data && data.display_name) {
        callback(data.display_name);
      } else {
        callback('Address not found');
      }
    })
    .catch(() => callback('Error retrieving address'));
}

// Update details panel with live data
function updateAlertDetails(alertCard, data) {
  // Reverse geocode the coordinates to get the address
  if (data.location && data.location.lat && data.location.lng) {
    reverseGeocode(data.location.lat, data.location.lng, (address) => {
      document.querySelector('.medical-details .details-content').innerHTML = `
        <p><strong>Type:</strong> Accident</p>
        <p><strong>Location:</strong> ${address}</p>
        <p><strong>Reported by:</strong> ${data.user_name ? data.user_name : 'User #' + (data.user_id || 'N/A')}</p>
        <p><strong>Time:</strong> Just now</p>
        <p><strong>Status:</strong> <span class="status-active">Active</span></p>
        <button class="contact-btn"><i class="fas fa-phone"></i> Contact Reporter</button>
      `;
    });
  } else {
    document.querySelector('.medical-details .details-content').innerHTML = `
      <p><strong>Type:</strong> Accident</p>
      <p><strong>Location:</strong> Unknown</p>
      <p><strong>Reported by:</strong> ${data.user_name ? data.user_name : 'User #' + (data.user_id || 'N/A')}</p>
      <p><strong>Time:</strong> Just now</p>
      <p><strong>Status:</strong> <span class="status-active">Active</span></p>
      <button class="contact-btn"><i class="fas fa-phone"></i> Contact Reporter</button>
    `;
  }
}

function toggleMapView() {
  const medicalMain = document.querySelector('.medical-main');
  const medicalMap = document.querySelector('.medical-map');
  
  if (!isMapExpanded) {
    // Expand map view
    medicalMain.classList.add('map-expanded');
    
    // Add map controls ONLY when expanded
    if (!expandedMapControls) {
      expandedMapControls = document.createElement('div');
      expandedMapControls.className = 'map-expanded-controls';
      expandedMapControls.innerHTML = `
        <button class="map-control-btn" id="recenter-location">
          <i class="fas fa-crosshairs"></i> My Location
        </button>
        <button class="map-control-btn" id="show-all-medical-alerts">
          <i class="fas fa-ambulance"></i> All Alerts
        </button>
        <button class="map-control-btn route-btn" id="route-to-alert">
          <i class="fas fa-route"></i> Route
        </button>
        <button class="map-control-btn resolved-btn" id="mark-resolved">
          <i class="fas fa-check-circle"></i> Mark Resolved
        </button>
      `;
      medicalMap.appendChild(expandedMapControls);
      setupExpandedMapControls();
    } else {
      // Show existing controls
      expandedMapControls.style.display = 'flex';
    }
    
    // Resize map after transition
    setTimeout(() => {
      if (window.map) {
        map.invalidateSize();
      }
    }, 300);
    
    isMapExpanded = true;
  } else {
    // Return to normal view
    showAlertsView();
  }
}

function showAlertsView() {
  const medicalMain = document.querySelector('.medical-main');
  medicalMain.classList.remove('map-expanded');
  
  // Hide map controls when returning to alerts view
  if (expandedMapControls) {
    expandedMapControls.style.display = 'none';
  }
  
  // Resize map after transition
  setTimeout(() => {
    if (window.map) {
      map.invalidateSize();
    }
  }, 300);
  
  isMapExpanded = false;
  
  // Set alerts as active in sidebar
  document.querySelectorAll('.medical-sidebar nav ul li').forEach(item => {
    item.classList.remove('active');
    if (item.textContent.trim().toLowerCase() === 'alerts') {
      item.classList.add('active');
    }
  });
}

function setupExpandedMapControls() {
  // Recenter to user location
  document.getElementById('recenter-location').addEventListener('click', () => {
    getCurrentLocationAndCenter();
  });

  // Show all medical alerts on map and ensure list is expanded
  document.getElementById('show-all-medical-alerts').addEventListener('click', () => {
    fitMapToAllAlerts();

    const alertsList = document.querySelector('.alerts-list');
    const mainExpandBtn = document.getElementById('expand-alerts');

    if (alertsList && mainExpandBtn && alertsList.classList.contains('collapsed')) {
      mainExpandBtn.click();
    }
  });
  
  // Route button
  document.getElementById('route-to-alert').addEventListener('click', () => {
    showRouteToSelectedAlert();
  });
  
  // Mark resolved
  document.getElementById('mark-resolved').addEventListener('click', () => {
    const activeAlertCard = document.querySelector('.alert-card.active');
    if (activeAlertCard && activeAlertCard.dataset.alertId) {
        const alertIdToResolve = activeAlertCard.dataset.alertId;
        const resolveButtonInCard = activeAlertCard.querySelector('.resolve-btn');
        if (resolveButtonInCard) {
            resolveButtonInCard.click();
        } else {
            alert('Could not find resolve action for the selected alert.');
        }
    } else {
        alert('Please select an alert first to mark it as resolved.');
    }
  });
}

function getCurrentLocationAndCenter() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const userLocation = [position.coords.latitude, position.coords.longitude];
      map.setView(userLocation, 16);
      
      // Add/update user location marker
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }
      userLocationMarker = L.circleMarker(userLocation, {
        radius: 10,
        fillColor: '#4285F4',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);
    });
  }
}

function fitMapToAllAlerts() {
  if (allAlertMarkers.length === 0) return;
  const group = new L.featureGroup(allAlertMarkers);
  map.fitBounds(group.getBounds().pad(0.2));
}

function markAllVisibleAlertsResolved() {
  console.log('Marking all visible alerts as resolved');
  // You can implement this to resolve all visible alerts
}