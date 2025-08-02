
// Connect to Socket.IO server
const socket = io.connect('http://localhost:5000');


let map;
let selectedFireMarker = null;
let isMapExpanded = false;
let isExpanded = false;
let expandedMapControls = null;
let userLocationMarker = null;
let fireServiceProfile = null;

let selectedAlertLocation = null;
let routeControl = null;

let allAlertMarkers = [];


document.addEventListener('DOMContentLoaded', async function () {
  let initialLat = 23.685; // Fallback: center of Bangladesh
  let initialLng = 90.3563;
  let initialZoom = 7; // Zoom out if location is default or not found

  const fireServiceEmail = localStorage.getItem('fireServiceEmail');

  if (fireServiceEmail) {
    try {
      const res = await fetch('http://localhost:5000/api/fire/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fireServiceEmail })
      });
      const data = await res.json();
      if (data.status === 'success' && data.lat && data.lng) {
        fireServiceProfile = data; // Populate global variable
        initialLat = parseFloat(data.lat);
        initialLng = parseFloat(data.lng);
        initialZoom = 15; // Zoom in for specific location
        console.log('Fire service profile loaded:', fireServiceProfile);
      } else {
        console.warn('Failed to load fire service profile or location data missing:', data.message || 'No specific error message from server.');
      }
    } catch (err) {
      console.warn('Error fetching fire service profile:', err);
    }
  } else {
    console.warn('No fireServiceEmail found in localStorage. Cannot load profile or specific location.');
    // Consider redirecting to login if fireServiceEmail is crucial for the page to function
    // For example: window.location.href = 'fire-login.html'; return;
    window.location.href = 'fire-login.html'; // Redirect to login if no profile found
    return;
  }

  // Initialize map AFTER attempting to fetch profile and coordinates
  map = L.map('osm-map').setView([initialLat, initialLng], initialZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Add marker for the fire service location if profile was loaded successfully
  if (fireServiceProfile && fireServiceProfile.lat && fireServiceProfile.lng) {
    if (userLocationMarker) map.removeLayer(userLocationMarker); // Remove old one if any
    userLocationMarker = L.circleMarker([parseFloat(fireServiceProfile.lat), parseFloat(fireServiceProfile.lng)], {
      radius: 10,
      fillColor: '#007bff', // A distinct color for the service's own location
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.7
    }).addTo(map).bindPopup(`<b>${fireServiceProfile.company_name || 'Your Location'}</b>`).openPopup();
  }

 // Setup profile icon click listener AFTER fireServiceProfile might be populated
// Profile icon click (show modal)
const profileIcon = document.querySelector('.fire-profile .fa-user-circle');
if (profileIcon) {
  profileIcon.addEventListener('click', function () {
    if (!fireServiceProfile) {
      showProfileModal({
        error: true,
        message: 'Profile not loaded. Please ensure you are logged in and refresh the page.'
      });
      return;
    }
    showProfileModal(fireServiceProfile);
  });
}

// Logout button click (logout logic)
const logoutBtn = document.getElementById('fire-logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem('fireServiceEmail');
    window.location.href = 'fire-login.html';
  });
}

// Function to show modern profile modal
function showProfileModal(profileData) {
  // Remove existing modal if any
  const existingModal = document.getElementById('fire-profile-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'fire-profile-modal-overlay';
  modalOverlay.id = 'fire-profile-modal';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'fire-profile-modal';

  if (profileData.error) {
    // Error state
    modalContent.innerHTML = `
      <div class="profile-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h2>Profile Error</h2>
      <p style="color: #d7263d; text-align: center; margin: 16px 0;">${profileData.message}</p>
      <button class="close-profile-modal">Close</button>
    `;
  } else {
    // Success state with profile data
    modalContent.innerHTML = `
      <div class="profile-icon">
        <i class="fas fa-fire-extinguisher"></i>
      </div>
      <h2>${profileData.company_name || 'Fire Service'}</h2>
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

  // Sidebar navigation
  const sidebarItems = document.querySelectorAll('.fire-sidebar nav ul li');
  sidebarItems.forEach(item => {
    item.addEventListener('click', function() {
      sidebarItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      const section = this.textContent.trim().toLowerCase();
      if (section === 'map') {
        toggleMapView(); // Ensure this function is defined
      } else if (section === 'alerts') {
        showAlertsView(); // Ensure this function is defined
      } else {
        console.log(`Switching to ${section} section`);
        // If map is expanded and user clicks a non-map section, revert to alerts/default view
        if (isMapExpanded && section !== 'map') {
            showAlertsView();
        }
      }
    });
  });

  // Fetch initial fire alerts
  fetch('http://localhost:5000/api/fire/alerts')
    .then(res => res.json())
    .then(alerts => {
      alerts.forEach(alert => addFireAlertToList(alert)); // Ensure addFireAlertToList is defined
      updateAlertsUI(); // Call after alerts are loaded
    })
    .catch((err) => {
      console.error('Could not load fire alerts from server:', err);
    });

  // Expand/Collapse functionality for alerts list
  const expandBtn = document.getElementById('expand-alerts');
  const alertsList = document.querySelector('.alerts-list');
  const expandControls = document.querySelector('.alerts-expand-controls');
  // let isExpanded = false; // Should be declared globally if not already

  if (expandBtn && alertsList && expandControls) { // Check if elements exist
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

  // Note: The resolve button event listeners were previously attached to '.resolve-btn'
  // If addFireAlertToList dynamically adds these buttons, the listeners should be added there
  // or use event delegation. The current structure in your full code (adding listeners in addFireAlertToList) is correct.

}); // End of DOMContentLoaded

// Ensure global functions like updateAlertsUI, addFireAlertToList, toggleMapView, showAlertsView are defined outside DOMContentLoaded
// if they are called from socket events or other global contexts.
// Based on your full code, they seem to be global, which is fine.
// For example:
// function updateAlertsUI() { ... }
// window.updateAlertsUI = updateAlertsUI; // If you need to ensure it's on window
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
  // Only handle fire alerts
  if (data.type && data.type.toLowerCase().includes('fire')) {
    addFireAlertToList(data);
    addFireMarkerToMap(data);
    showFireNotification(data);
  }
});

// Function to add a fire alert to the alerts list
function addFireAlertToList(data) {
  const alertsList = document.querySelector('.alerts-list');
  const li = document.createElement('li');
  li.className = 'alert-card';
  li.dataset.alertId = data.id;
  li.innerHTML = `
    <div>
      <span class="alert-type"><i class="fas fa-fire"></i> Fire</span>
      <span class="alert-time">Just now</span>
    </div>
    <div class="alert-location"><i class="fas fa-map-marker-alt"></i> ${data.details || 'Unknown location'}</div>
    <div class="alert-actions">
      <button class="respond-btn">Respond</button>
      <button class="resolve-btn">Resolved</button>
    </div>
  `;
  alertsList.prepend(li);

  // Update UI state (alerts count and expand button visibility)
  if (window.updateAlertsUI) {
    window.updateAlertsUI();
  }

  // Add interactions
  li.addEventListener('click', function() {
    const isActive = li.classList.contains('active');
    document.querySelectorAll('.alert-card').forEach(c => c.classList.remove('active'));

    if (isActive) {
      // Deselect: clear marker, details, and selectedAlertLocation
      if (selectedFireMarker) {
        map.removeLayer(selectedFireMarker);
        // Remove from allAlertMarkers
        allAlertMarkers = allAlertMarkers.filter(m => m !== selectedFireMarker);
        selectedFireMarker = null;
      }
      selectedAlertLocation = null;
      document.querySelector('.fire-details .details-content').innerHTML = `<p>No alert selected.</p>`;
      // Remove route if exists
      if (window.routeControl) {
        map.removeControl(window.routeControl);
        window.routeControl = null;
      }
    } else {
      // Select this alert
      li.classList.add('active');
      updateAlertDetails(li, data);
      showFireMarkerOnMap(data);

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
      service_type: fireServiceProfile?.service_type || 'fire',
      service_name: fireServiceProfile?.company_name || 'Fire Service'
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
    // Call backend to mark as resolved
    fetch(`http://localhost:5000/api/alerts/${data.id}/resolve`, {
      method: 'PUT'
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          // Remove alert from UI
          li.remove();
          // Update UI state after removal
          if (window.updateAlertsUI) {
            window.updateAlertsUI();
          }
          // Remove marker from map if this alert was selected
          if (selectedFireMarker) {
            map.removeLayer(selectedFireMarker);
            selectedFireMarker = null;
          }
          // Clear details panel if this was the selected alert
          document.querySelector('.fire-details .details-content').innerHTML = `<p>No alert selected.</p>`;
        } else {
          alert('Failed to resolve alert.');
        }
      })
      .catch(() => {
        alert('Failed to resolve alert.');
      });
  });
}

// Show fire marker only for the selected alert
function showFireMarkerOnMap(data) {
  // Remove previous marker if exists
  if (selectedFireMarker) {
    map.removeLayer(selectedFireMarker);
    selectedFireMarker = null;
  }
  if (!data.location) return;
  // Add a big red circle as the marker
  selectedFireMarker = L.circle([data.location.lat, data.location.lng], {
    color: '#d32f2f',
    fillColor: '#d32f2f',
    fillOpacity: 1,
    radius: 20 // Adjust for your zoom level (in meters)
  })
    .addTo(map)
    .bindPopup('<b>Fire Alert!</b><br>' + (data.details || ''))
    .openPopup();

    // Add to allAlertMarkers if not already present
    allAlertMarkers.push(selectedFireMarker);

  map.setView([data.location.lat, data.location.lng], 16);
}



// Show route from Fire Service to the selected alert
function showRouteToSelectedAlert() {
  if (!fireServiceProfile || !fireServiceProfile.lat || !fireServiceProfile.lng) {
    alert('Your fire service location is not set.');
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
      L.latLng(parseFloat(fireServiceProfile.lat), parseFloat(fireServiceProfile.lng)),
      L.latLng(selectedAlertLocation[0], selectedAlertLocation[1])
    ],
    routeWhileDragging: false,
    draggableWaypoints: false,
    addWaypoints: false,
    show: false,
    lineOptions: {
      styles: [{ color: '#1976D2', weight: 6 }]
    },
    createMarker: function() { return null; } // No extra markers
  }).addTo(map);
}



// Optional: Show a notification popup
function showFireNotification(data) {
  // You can implement a toast or modal here
  alert('🔥 New Fire Alert Received!');
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
      document.querySelector('.fire-details .details-content').innerHTML = `
        <p><strong>Type:</strong> Fire</p>
        <p><strong>Location:</strong> ${address}</p>
        <p><strong>Reported by:</strong> ${data.user_name ? data.user_name : 'User #' + (data.user_id || 'N/A')}</p>
        <p><strong>Time:</strong> Just now</p>
        <p><strong>Status:</strong> <span class="status-active">Active</span></p>
        <button class="contact-btn"><i class="fas fa-phone"></i> Contact Reporter</button>
      `;
    });
  } else {
    document.querySelector('.fire-details .details-content').innerHTML = `
      <p><strong>Type:</strong> Fire</p>
      <p><strong>Location:</strong> Unknown</p>
      <p><strong>Reported by:</strong> ${data.user_name ? data.user_name : 'User #' + (data.user_id || 'N/A')}</p>
      <p><strong>Time:</strong> Just now</p>
      <p><strong>Status:</strong> <span class="status-active">Active</span></p>
      <button class="contact-btn"><i class="fas fa-phone"></i> Contact Reporter</button>
    `;
  }
}





// ADD THESE NEW FUNCTIONS

function toggleMapView() {
  const fireMain = document.querySelector('.fire-main');
  const fireMap = document.querySelector('.fire-map');
  
  if (!isMapExpanded) {
    // Expand map view
    fireMain.classList.add('map-expanded');
    
    // Add map controls ONLY when expanded
    if (!expandedMapControls) {
      expandedMapControls = document.createElement('div');
      expandedMapControls.className = 'map-expanded-controls';
      expandedMapControls.innerHTML = `
        <button class="map-control-btn" id="recenter-location">
          <i class="fas fa-crosshairs"></i> My Location
        </button>
        <button class="map-control-btn" id="show-all-fire-alerts">
          <i class="fas fa-fire"></i> All Alerts
        </button>
        <button class="map-control-btn route-btn" id="route-to-alert">
          <i class="fas fa-route"></i> Route
        </button>
        <button class="map-control-btn resolved-btn" id="mark-resolved">
          <i class="fas fa-check-circle"></i> Mark Resolved
        </button>
        
      `;
      fireMap.appendChild(expandedMapControls);
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
  const fireMain = document.querySelector('.fire-main');
  fireMain.classList.remove('map-expanded');
  
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
  document.querySelectorAll('.fire-sidebar nav ul li').forEach(item => {
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

  // Show all fire alerts on map and ensure list is expanded
  document.getElementById('show-all-fire-alerts').addEventListener('click', () => {
    fitMapToAllAlerts(); // Focus map on all alerts

    // Check if the main alerts list is collapsed, if so, trigger its expand button
    const alertsList = document.querySelector('.alerts-list');
    const mainExpandBtn = document.getElementById('expand-alerts'); // The button below the alerts list

    if (alertsList && mainExpandBtn && alertsList.classList.contains('collapsed')) {
      mainExpandBtn.click(); // Programmatically click the main expand button
    }
    
    // Optionally, scroll to the alerts section if it's not in view
    // This might be redundant if expanding the list already brings it into view.
    // alertsList?.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
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