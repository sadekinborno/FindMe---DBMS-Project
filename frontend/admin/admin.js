const socket = io('http://localhost:5000'); // Socket.IO connection
let leafletMapInstance = null;
let locationSelectionMap = null;
let selectedLocation = null;
let locationMarker = null;

document.addEventListener('DOMContentLoaded', () => {
  const reportsLink = document.querySelector('a[href="#reports"]');
    if (reportsLink) {
        reportsLink.addEventListener('click', fetchReports);
    }
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar ul li a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            document.querySelectorAll('.main-content section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(targetId).style.display = 'block';
        });
    });

    // Show dashboard by default
    document.getElementById('dashboard').style.display = 'block';

    // Socket.IO listeners
    socket.on('newAlert', () => {
        fetchDashboardData();
    });

    socket.on('resolveAlert', () => {
        fetchDashboardData();
    });

    // Initial data fetch
    fetchDashboardData();
    fetchUsers();

    async function fetchDashboardData() {
        try {
            // Fetch users
            const [usersResponse, activeAlertsResponse, resolvedAlertsResponse] = await Promise.all([
                fetch('http://localhost:5000/api/users/count'),
                fetch('http://localhost:5000/api/alerts/active'),
                fetch('http://localhost:5000/api/alerts/resolved')
            ]);

            // Update user count
            if (!usersResponse.ok) {
                throw new Error('Failed to fetch total users');
            }
            const usersData = await usersResponse.json();
            console.log('Total Users:', usersData);
            document.getElementById('total-users').textContent = usersData.count;

            // Update active alerts
            if (!activeAlertsResponse.ok) {
                throw new Error('Failed to fetch active alerts');
            }
            const activeAlertsData = await activeAlertsResponse.json();
            console.log('Active Alerts:', activeAlertsData);
            document.getElementById('active-alerts').textContent = activeAlertsData.count || 0;

            // Update resolved alerts
            if (!resolvedAlertsResponse.ok) {
                throw new Error('Failed to fetch resolved alerts');
            }
            const resolvedAlertsData = await resolvedAlertsResponse.json();
            console.log('Resolved Alerts:', resolvedAlertsData);
            document.getElementById('resolved-alerts').textContent = resolvedAlertsData.count || 0;

            // Handle chart
            const alertsOverTimeResponse = await fetch('http://localhost:5000/api/alerts/over-time');
            if (!alertsOverTimeResponse.ok) {
                throw new Error('Failed to fetch alerts over time');
            }
            const alertsOverTimeData = await alertsOverTimeResponse.json();
            console.log('Alerts Over Time:', alertsOverTimeData);

            // Destroy existing chart if it exists
            const chartCanvas = document.getElementById('alertsChart');
            if (chartCanvas.chart) {
                chartCanvas.chart.destroy();
            }

            // Create new chart
            const ctx = chartCanvas.getContext('2d');
            chartCanvas.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: alertsOverTimeData.labels || [],
                    datasets: [{
                        label: 'Alerts Over Time',
                        data: alertsOverTimeData.data || [],
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: { beginAtZero: true },
                        y: { beginAtZero: true }
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }

    // Fetch users
    // Fetch users with search and filter functionality
async function fetchUsers() {
    try {
        // Get filter and search values
        const search = document.getElementById('search-users').value.trim();
        const role = document.getElementById('filter-role').value;
        const status = document.getElementById('filter-status').value;

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (role) queryParams.append('role', role);
        if (status) queryParams.append('status', status);

        // Fetch users with query parameters
        const response = await fetch(`http://localhost:5000/api/users?${queryParams.toString()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        const users = await response.json();
        console.log('Users:', users);

        // Populate the user table
        const userList = document.getElementById('user-list');
        userList.innerHTML = ''; // Clear existing rows
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.role}</td>
                <td>${user.status}</td>
                <td>
                    <button class="edit-user" data-id="${user.id}">Edit</button>
                    <button class="delete-user" data-id="${user.id}">Delete</button>
                </td>
            `;
            userList.appendChild(row);
        });

        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-user').forEach(button => {
            button.addEventListener('click', (event) => {
                const userId = event.target.dataset.id;
                alert(`Edit user with ID: ${userId}`);
                // Implement edit functionality here
            });
        });

        document.querySelectorAll('.delete-user').forEach(button => {
            button.addEventListener('click', (event) => {
                const userId = event.target.dataset.id;
                if (confirm('Are you sure you want to delete this user?')) {
                    deleteUser(userId);
                }
            });
        });

    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

    // Delete user
    async function deleteUser(userId) {
        try {
            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Failed to delete user');
            }
            alert('User deleted successfully');
            fetchUsers(); // Refresh the user list
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    }

    // Search and filter functionality
    const searchInput = document.getElementById('search-users');
    const filterRole = document.getElementById('filter-role');
    const filterStatus = document.getElementById('filter-status');

    searchInput.addEventListener('input', fetchUsers);
    filterRole.addEventListener('change', fetchUsers);
    filterStatus.addEventListener('change', fetchUsers);



    // Location selection functionality
  document.getElementById('select-location-btn').addEventListener('click', openLocationSelectionModal);
  document.getElementById('close-location-modal').addEventListener('click', closeLocationSelectionModal);
  document.getElementById('cancel-location-btn').addEventListener('click', closeLocationSelectionModal);
  document.getElementById('confirm-location-btn').addEventListener('click', confirmSelectedLocation);
});


function openLocationSelectionModal() {
  const modal = document.getElementById('location-selection-modal');
  modal.style.display = 'flex';
  
  // Initialize map after modal is visible
  setTimeout(() => {
    initializeLocationSelectionMap();
  }, 100);
}


function closeLocationSelectionModal() {
  const modal = document.getElementById('location-selection-modal');
  modal.style.display = 'none';
  
  // Clean up map
  if (locationSelectionMap) {
    locationSelectionMap.remove();
    locationSelectionMap = null;
  }
  
  // Reset location selection
  selectedLocation = null;
  locationMarker = null;
  document.getElementById('confirm-location-btn').disabled = true;
  document.getElementById('selected-address').textContent = 'Click on the map to select a location';
  document.getElementById('selected-coordinates').textContent = '';
}


function initializeLocationSelectionMap() {
  const mapContainer = document.getElementById('location-selection-map');
  
  // Clear any existing map
  if (locationSelectionMap) {
    locationSelectionMap.remove();
  }
  
  // Create new map
  locationSelectionMap = L.map(mapContainer).setView([51.505, -0.09], 13);
  
  // Add tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(locationSelectionMap);
  
  // Try to get user's current location for better initial position
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const userLocation = [position.coords.latitude, position.coords.longitude];
      locationSelectionMap.setView(userLocation, 15);
    });
  }

    // Add click handler for location selection
  locationSelectionMap.on('click', function(e) {
    selectLocationOnMap(e.latlng);
  });
}

function selectLocationOnMap(latlng) {
  selectedLocation = latlng;
  
  // Remove existing marker
  if (locationMarker) {
    locationSelectionMap.removeLayer(locationMarker);
  }


  // Add new marker
  locationMarker = L.marker([latlng.lat, latlng.lng], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(locationSelectionMap);
  
  // Update coordinates display
  const coordsText = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  document.getElementById('selected-coordinates').textContent = coordsText;
  
  // Reverse geocode to get address
  reverseGeocodeLocation(latlng.lat, latlng.lng, (address) => {
    document.getElementById('selected-address').textContent = address;
  });

  // Enable confirm button
  document.getElementById('confirm-location-btn').disabled = false;
}

function reverseGeocodeLocation(lat, lng, callback) {
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


function confirmSelectedLocation() {
  if (selectedLocation) {
    const address = document.getElementById('selected-address').textContent;
    const coords = document.getElementById('selected-coordinates').textContent;
    
    // Update the location input field
    document.getElementById('service-location').value = `${address} (${coords})`;
    
    // Store the coordinates for form submission
    document.getElementById('service-location').dataset.lat = selectedLocation.lat;
    document.getElementById('service-location').dataset.lng = selectedLocation.lng;
    
    closeLocationSelectionModal();
  }
}

// Handle Modal and form submission
// Show the modal when "Add User" is clicked
document.getElementById('add-user').addEventListener('click', () => {
    const modal = document.getElementById('add-user-modal');
    modal.style.display = 'flex';

    // Show Admin form by default
    document.getElementById('user-fields').style.display = 'block';
    document.getElementById('service-fields').style.display = 'none';

    // Set Admin button as selected
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('add-admin-btn').classList.add('selected');
    document.getElementById('add-user-form').dataset.role = 'admin';

    console.log('Add User modal opened with Admin form by default'); // Debugging
});

// Close the modal when "Cancel" is clicked
document.getElementById('cancel-add-user').addEventListener('click', () => {
    const modal = document.getElementById('add-user-modal');
    modal.style.display = 'none';
    document.getElementById('add-user-form').reset();
    console.log('Add User modal closed'); // Debugging
});

// Handle role selection
document.querySelectorAll('.role-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const role = e.target.dataset.role;

        // Highlight the selected button
        document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');

        // Show the corresponding form and toggle required attributes
        if (role === 'admin' || role === 'user') {
            document.getElementById('user-fields').style.display = 'block';
            document.getElementById('service-fields').style.display = 'none';
            document.getElementById('add-user-form').dataset.role = role;

            // Add required attributes to user fields
            document.getElementById('name').setAttribute('required', 'true');
            document.getElementById('email').setAttribute('required', 'true');
            document.getElementById('password').setAttribute('required', 'true');
            document.getElementById('phone').removeAttribute('required'); // Optional field

            // Remove required attributes from service fields
            document.getElementById('company-name').removeAttribute('required');
            document.getElementById('service-email').removeAttribute('required');
            document.getElementById('service-type').removeAttribute('required');
            document.getElementById('service-phone').removeAttribute('required');
        } else if (role === 'service') {
            document.getElementById('user-fields').style.display = 'none';
            document.getElementById('service-fields').style.display = 'block';
            document.getElementById('add-user-form').dataset.role = role;

            // Add required attributes to service fields
            document.getElementById('company-name').setAttribute('required', 'true');
            document.getElementById('service-email').setAttribute('required', 'true');
            document.getElementById('service-type').setAttribute('required', 'true');
            document.getElementById('service-phone').removeAttribute('required'); // Optional field

            // Remove required attributes from user fields
            document.getElementById('name').removeAttribute('required');
            document.getElementById('email').removeAttribute('required');
            document.getElementById('password').removeAttribute('required');
            document.getElementById('phone').removeAttribute('required');
        }

        console.log(`${role.charAt(0).toUpperCase() + role.slice(1)} role selected`); // Debugging
    });
});

// Handle form submission
document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = e.target.dataset.role;
    console.log(`Form submitted for role: ${role}`); // Debugging

    if (role === 'admin' || role === 'user') {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone').value;

        try {
            const response = await fetch('http://localhost:5000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone, role })
            });
            const result = await response.json();
            if (response.ok) {
                alert('User added successfully!');
                fetchUsers();
                // Close modal and reset form
                document.getElementById('add-user-modal').style.display = 'none';
                document.getElementById('add-user-form').reset();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Failed to add user.');
        }

    } else if (role === 'service') {
        const companyName = document.getElementById('company-name').value;
        const email = document.getElementById('service-email').value;
        const password = document.getElementById('service-password').value;
        const serviceType = document.getElementById('service-type').value;
        const phone = document.getElementById('service-phone').value;
        
        // Get location data
        const locationInput = document.getElementById('service-location');
        const latitude = locationInput.dataset.lat;
        const longitude = locationInput.dataset.lng;
        
        if (!latitude || !longitude) {
            alert('Please select a location for the service.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    company_name: companyName, 
                    email, 
                    password,
                    service_type: serviceType, 
                    phone,
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude)
                })
            });
            const result = await response.json();
            if (response.ok) {
                alert('Service added successfully!');
                // Close modal and reset form
                document.getElementById('add-user-modal').style.display = 'none';
                document.getElementById('add-user-form').reset();
                // Clear location data
                document.getElementById('service-location').value = '';
                delete document.getElementById('service-location').dataset.lat;
                delete document.getElementById('service-location').dataset.lng;
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error adding service:', error);
            alert('Failed to add service.');
        }
    }
}); 










// Emergency Alerts Management
document.addEventListener('DOMContentLoaded', () => {
  // Fetch and render alerts
  async function fetchAlerts() {
    const search = document.getElementById('search-alerts').value.trim();
    const type = document.getElementById('filter-alert-type').value;
    const status = document.getElementById('filter-alert-status').value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    if (status) params.append('status', status);

    const response = await fetch(`http://localhost:5000/api/alerts?${params.toString()}`);
    const alerts = await response.json();

    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';
    alerts.forEach(alert => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${alert.id}</td>
        <td>${alert.type}</td>
        <td>${alert.user_name || 'User #' + alert.user_id}</td>
        <td>${new Date(alert.created_at).toLocaleString()}</td>
        <td>${alert.resolved ? '<span style="color:green;">Resolved</span>' : '<span style="color:#EA4335;">Active</span>'}</td>
        <td>
          <button class="alert-action-btn details" data-id="${alert.id}">Details</button>
          ${!alert.resolved ? `<button class="alert-action-btn resolve" data-id="${alert.id}">Resolve</button>` : ''}
          <button class="alert-action-btn assign" data-id="${alert.id}">Assign</button>
        </td>
      `;
      alertsList.appendChild(row);
    });

    // Details button
    document.querySelectorAll('.alert-action-btn.details').forEach(btn => {
      btn.addEventListener('click', () => showAlertDetails(btn.dataset.id));
    });
    // Resolve button
    document.querySelectorAll('.alert-action-btn.resolve').forEach(btn => {
      btn.addEventListener('click', () => resolveAlert(btn.dataset.id));
    });
    // Assign button
    document.querySelectorAll('.alert-action-btn.assign').forEach(btn => {
      btn.addEventListener('click', () => assignAlert(btn.dataset.id));
    });
  }

  // Filter/search events
  document.getElementById('search-alerts').addEventListener('input', fetchAlerts);
  document.getElementById('filter-alert-type').addEventListener('change', fetchAlerts);
  document.getElementById('filter-alert-status').addEventListener('change', fetchAlerts);

  // Show alert details modal
  // ...existing code...
async function showAlertDetails(alertId) {
  const response = await fetch(`http://localhost:5000/api/alerts/${alertId}`);
  const alert = await response.json();

  // Fill modal fields
  document.getElementById('alert-type').textContent = alert.type;
  document.getElementById('alert-user').textContent = alert.user_name || 'User #' + alert.user_id;
  document.getElementById('alert-date').textContent = new Date(alert.created_at).toLocaleString();
  document.getElementById('alert-status').innerHTML = alert.resolved
    ? '<span style="color:green;">Resolved</span>'
    : '<span style="color:#EA4335;">Active</span>';
  document.getElementById('alert-details').textContent = alert.details || 'N/A';
  document.getElementById('alert-location').textContent = `${alert.latitude}, ${alert.longitude}`;



  // Show map
  setTimeout(() => {
  const mapDiv = document.getElementById('alert-details-map');
  mapDiv.innerHTML = '';

  // Remove previous map instance if exists
  if (leafletMapInstance) {
    leafletMapInstance.remove();
    leafletMapInstance = null;
  }

  leafletMapInstance = L.map(mapDiv).setView([alert.latitude, alert.longitude], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(leafletMapInstance);
  L.marker([alert.latitude, alert.longitude]).addTo(leafletMapInstance);
}, 100);

document.getElementById('alert-details-modal').style.display = 'flex';

  // Set button actions
  document.getElementById('resolve-alert-btn').onclick = () => resolveAlert(alertId, true);
  document.getElementById('assign-alert-btn').onclick = () => assignAlert(alertId, true);
  document.getElementById('close-alert-details').onclick = () => {
    document.getElementById('alert-details-modal').style.display = 'none';
  };
}

  // Mark alert as resolved
  async function resolveAlert(alertId, closeModal) {
    if (!confirm('Mark this alert as resolved?')) return;
    const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/resolve`, { method: 'PUT' });
    if (response.ok) {
      alert('Alert marked as resolved!');
      fetchAlerts();
      if (closeModal) document.getElementById('alert-details-modal').style.display = 'none';
    } else {
      alert('Failed to resolve alert.');
    }
  }

  // Assign alert to a responder/service (simple prompt for now)
  async function assignAlert(alertId, closeModal) {
    const serviceId = prompt('Enter Service ID to assign:');
    if (!serviceId) return;
    const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: serviceId })
    });
    if (response.ok) {
      alert('Alert assigned!');
      fetchAlerts();
      if (closeModal) document.getElementById('alert-details-modal').style.display = 'none';
    } else {
      alert('Failed to assign alert.');
    }
  }

  // Initial fetch
  fetchAlerts();
});











// Show only dashboard on load, show only selected section on sidebar click
    document.addEventListener('DOMContentLoaded', function () {
      // Hide all sections except dashboard on load
      document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = section.id === 'dashboard' ? 'block' : 'none';
      });

      // Sidebar navigation
      document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          const target = this.getAttribute('href').replace('#', '');
          document.querySelectorAll('.admin-section').forEach(section => {
            section.style.display = section.id === target ? 'block' : 'none';
          });
        });
      });
    });


// Fetch and render user reports
async function fetchReports() {
  try {
    const response = await fetch('http://localhost:5000/api/reports');
    if (!response.ok) throw new Error('Failed to fetch reports');
    const reports = await response.json();

    const reportsGrid = document.getElementById('reports-grid');
    reportsGrid.innerHTML = '';

    reports.forEach(report => {
      const card = document.createElement('div');
      card.className = 'report-card';

      // Status class for color
      let statusClass = '';
      if (report.status === 'reviewed') statusClass = 'reviewed';
      else if (report.status === 'resolved') statusClass = 'resolved';

        // Split the name into parts
  const nameParts = report.user_name?.split(' ') || ['Anonymous'];
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' '); // Combine the rest of the name

      card.innerHTML = `
      <div class="report-header">
        <div class="report-user">
          <span class="first-name">${report.user_name?.split(' ')[0] || 'Anonymous'}</span>
          <span class="last-name">${report.user_name?.split(' ').slice(1).join(' ') || ''}</span>
        </div>
        <div class="report-date">${new Date(report.created_at).toLocaleString()}</div>
      </div>
      <div class="report-details">${report.text}</div>
      <div class="report-footer">
        <span class="report-status ${statusClass}" id="status-${report.id}">
          ${capitalize(report.status)}
        </span>
        <div class="report-actions">
          <button class="report-btn review" data-id="${report.id}">Review</button>
          <button class="report-btn resolved" data-id="${report.id}">Resolved</button>
        </div>
      </div>
    `;
      reportsGrid.appendChild(card);
    });

    // Button event listeners
    document.querySelectorAll('.report-btn.review').forEach(btn => {
      btn.addEventListener('click', async () => {
        await updateReportStatus(btn.dataset.id, 'reviewed');
      });
    });
    document.querySelectorAll('.report-btn.resolved').forEach(btn => {
      btn.addEventListener('click', async () => {
        await updateReportStatus(btn.dataset.id, 'resolved');
      });
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
  }
}

// Helper to capitalize status
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Update report status
async function updateReportStatus(reportId, status) {
  try {
    const response = await fetch(`http://localhost:5000/api/reports/${reportId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      // Update status label in UI
      const statusSpan = document.getElementById(`status-${reportId}`);
      statusSpan.textContent = capitalize(status);
      statusSpan.className = `report-status ${status}`;
    } else {
      alert('Failed to update report status.');
    }
  } catch (error) {
    alert('Failed to update report status.');
  }
}

// Add these event listeners in your DOMContentLoaded section
document.getElementById('recenter-map')?.addEventListener('click', recenterToUserLocation);
document.getElementById('search-location')?.addEventListener('keypress', handleLocationSearch);

// Recenter map to user location
function recenterToUserLocation() {
  if (navigator.geolocation) {
    document.getElementById('recenter-map').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';
    
    navigator.geolocation.getCurrentPosition((position) => {
      const userLocation = [position.coords.latitude, position.coords.longitude];
      locationSelectionMap.setView(userLocation, 15);
      
      // Add user location marker
      L.circleMarker(userLocation, {
        radius: 8,
        fillColor: '#4285F4',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(locationSelectionMap).bindPopup('Your Location').openPopup();
      
      document.getElementById('recenter-map').innerHTML = '<i class="fas fa-crosshairs"></i> My Location';
    }, (error) => {
      alert('Unable to get your location. Please check location permissions.');
      document.getElementById('recenter-map').innerHTML = '<i class="fas fa-crosshairs"></i> My Location';
    });
  } else {
    alert('Geolocation is not supported by this browser.');
  }
}

// Handle location search
function handleLocationSearch(e) {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      searchLocation(query);
    }
  }
}

// Search for location using Nominatim
function searchLocation(query) {
  const searchBtn = document.getElementById('search-location');
  searchBtn.placeholder = 'Searching...';
  
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        locationSelectionMap.setView([lat, lng], 15);
        
        // Auto-select this location
        selectLocationOnMap({ lat, lng });
        
        searchBtn.placeholder = 'Search for a location...';
        searchBtn.value = '';
      } else {
        alert('Location not found. Try a different search term.');
        searchBtn.placeholder = 'Location not found...';
        setTimeout(() => {
          searchBtn.placeholder = 'Search for a location...';
        }, 2000);
      }
    })
    .catch(error => {
      console.error('Search error:', error);
      alert('Error searching for location.');
      searchBtn.placeholder = 'Search for a location...';
    });
}