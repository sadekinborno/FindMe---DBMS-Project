// Create the WebSocket connection to the server
let socket = io.connect('http://localhost:5000'); // Assuming your Flask server is running on localhost
registerSocketEventListeners(); //Always call right after you create or re-create a socket connection.

let activeEmergencyRooms = {}; // { room_id: {alertData, unreadCount, messages: []} }
let currentEmergencyRoomId = null;

// Function to register socket event listeners
// This function will be called whenever a new socket connection is established
function registerSocketEventListeners() {
  if (!socket) return;

  // Remove previous listeners to avoid duplicates
  socket.off('friendChatMessage');
  socket.off('emergencyAlert');
  socket.off('emergencyChatMessage');

  // Listen for friend chat messages
  socket.on('friendChatMessage', (data) => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return;
    if (
      currentChatFriend && currentChatFriend.id &&
      ((data.sender_id === currentUser.id && data.receiver_id === currentChatFriend.id) ||
       (data.sender_id === currentChatFriend.id && data.receiver_id === currentUser.id))
    ) {
      loadFriendMessages(currentChatFriend.id);
    }
  });

  // Listen for emergency alerts from the server - MOVE THIS INSIDE!
  socket.on('emergencyAlert', function(data) {
    // Always handle the alert, even if it's from the victim
    if (!activeEmergencyRooms[data.room_id]) {
      activeEmergencyRooms[data.room_id] = {
        alertData: data,
        unreadCount: 0,
        messages: []
      };
    }
    // Only show notification if not the victim
    if (data.user_id !== user.id) {
      activeEmergencyRooms[data.room_id].unreadCount += 1;
      addEmergencyNotification(data);
    }
  });

  // Listen for Emergency Chat Messages
  socket.on('emergencyChatMessage', (data) => {
    if (!activeEmergencyRooms[data.room_id]) return;

    // Only push if the message is not already in the array (avoid duplicates)
    const msgs = activeEmergencyRooms[data.room_id].messages;
    if (!msgs.some(m => m.user_id === data.user_id && m.message === data.message && m.sent_at === data.sent_at)) {
      msgs.push(data);
    }

    if (currentEmergencyRoomId === data.room_id) {
      renderEmergencyChatMessages(data.room_id);
    } else {
      activeEmergencyRooms[data.room_id].unreadCount += 1;
      renderEmergencyAlertsList();
    }
  });
}

// Listen for emergency room closed event
socket.on('emergencyRoomClosed', function(data) {
  if (activeEmergencyRooms[data.room_id]) {
    activeEmergencyRooms[data.room_id].closed = true;
    // Optionally show a message in the chat
    const container = document.getElementById('emergency-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'system-message';
    msgDiv.innerHTML = `<i class="fas fa-info-circle"></i> This emergency chat has been closed.`;
    container.appendChild(msgDiv);
    // Disable input
    document.getElementById('emergency-chat-input').disabled = true;
    document.getElementById('send-emergency-chat').disabled = true;
  }
});






// Check if the user is logged in
const user = JSON.parse(localStorage.getItem('user'));

if (user && user.id) {
    // User is logged in
    document.getElementById('signin').style.display = 'none';
    document.getElementById('signup').style.display = 'none';
    document.getElementById('account').style.display = 'block';

    // Reconnect Socket.IO with user_id if not already connected with it
    // or if the current socket is anonymous
    if (socket.io.opts.query?.user_id !== user.id.toString()) {
    if (socket.connected) {
        socket.disconnect();
    }
    socket = io.connect('http://localhost:5000', {
        query: { user_id: user.id.toString() }
    });
    console.log(`Socket re-initiated connection with user_id: ${user.id}`);
    registerSocketEventListeners(); 
}
} else {
    // User is not logged in
    document.getElementById('signin').style.display = 'block';
    document.getElementById('signup').style.display = 'block';
    document.getElementById('account').style.display = 'none';
}
;







// Initialize the notification count
let notificationCount = 0;

// Variable to store the victim's location marker
let victimLocationMarker = null;

// Function to show the victim's location on the map
function showVictimLocation(lat, lng) {
  // Remove existing victim marker (if any)
  if (victimLocationMarker) {
    map.removeLayer(victimLocationMarker);
  }
  // Add a red circular marker for the victim's location
  victimLocationMarker = L.circleMarker([lat, lng], {
    radius: 12,
    fillColor: '#FF0000',
    color: '#FFFFFF',
    weight: 2,
    opacity: 1,
    fillOpacity: 1
  }).addTo(map);

  // Center the map on the victim's location
  map.setView([lat, lng], 16);
}



// Single function to handle emergency notifications
function addEmergencyNotification(data) {
  const notificationMessages = document.getElementById('notification-messages');
  const notificationElement = document.createElement('div');
  notificationElement.className = 'notification';

  reverseGeocode(data.location.lat, data.location.lng, (address) => {
    notificationElement.textContent = `${data.user_name || 'Someone'}: ${data.type} at ${address}`;
    notificationMessages.insertBefore(notificationElement, notificationMessages.firstChild);

    notificationCount++;
    document.getElementById('notification-count').textContent = notificationCount;

    // Click: open the emergency chat window for this room
    notificationElement.addEventListener('click', () => {
      document.getElementById('emergency-chat-window').classList.remove('hide');
      renderEmergencyAlertsList();
      openEmergencyChatRoom(data.room_id);
      showVictimLocation(data.location.lat, data.location.lng);
    });

    // Hover: show mini window
    notificationElement.addEventListener('mouseenter', () => {
      const miniWindow = document.createElement('div');
      miniWindow.className = 'mini-window';
      miniWindow.textContent = data.details || 'No additional details provided';
      document.body.appendChild(miniWindow);

      const rect = notificationElement.getBoundingClientRect();
      miniWindow.style.top = `${rect.top + window.scrollY + rect.height}px`;
      miniWindow.style.left = `${rect.left + window.scrollX}px`;
      miniWindow.classList.add('show');

      notificationElement.addEventListener('mouseleave', () => {
        miniWindow.classList.remove('show');
        setTimeout(() => miniWindow.remove(), 300);
      });
    });
  });
}



// Emergency Chat Button Opens Chat Window
document.getElementById('emergency-chat-button').addEventListener('click', () => {
  document.getElementById('emergency-chat-window').classList.remove('hide');
  renderEmergencyAlertsList();
});




function openEmergencyChatRoom(roomId) {
  currentEmergencyRoomId = roomId;
  const room = activeEmergencyRooms[roomId];
  if (!room) return;

  // Join the room via Socket.IO
  socket.emit('joinEmergencyRoom', { room_id: roomId, user_id: user.id });

  // Update UI
  showActiveChat(room.alertData);
  renderEmergencyAlertsList();

  // Fetch message history from backend and REPLACE in-memory messages
  fetch(`http://localhost:5000/api/emergency-chat/messages?room_id=${roomId}`)
    .then(res => res.json())
    .then(messages => {
      // Replace in-memory messages with backend messages
      activeEmergencyRooms[roomId].messages = messages;
      renderEmergencyChatMessages(roomId);
    })
    .catch(() => {
      renderEmergencyChatMessages(roomId);
    });

    // Check if the room is closed
    if (activeEmergencyRooms[roomId].closed) {
    document.getElementById('emergency-chat-input').disabled = true;
    document.getElementById('send-emergency-chat').disabled = true;
  } else {
    document.getElementById('emergency-chat-input').disabled = false;
    document.getElementById('send-emergency-chat').disabled = false;
  }
    
  console.log('Opening chat for roomId:', roomId);

  // Mark as read
  activeEmergencyRooms[roomId].unreadCount = 0;
}



// Send Message (Updated)
document.getElementById('send-emergency-chat').addEventListener('click', sendEmergencyMessage);
document.getElementById('emergency-chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendEmergencyMessage();
});

function sendEmergencyMessage() {
  const input = document.getElementById('emergency-chat-input');
  const message = input.value.trim();
  
  if (!message || !currentEmergencyRoomId) return;
  
  socket.emit('emergencyChatMessage', {
    room_id: currentEmergencyRoomId,
    user_id: user.id,
    user_name: user.name || 'User',
    message
  });
  
  input.value = '';
}




// Close Emergency Chat Window
document.getElementById('close-emergency-chat').addEventListener('click', () => {
  document.getElementById('emergency-chat-window').classList.add('hide');
  currentEmergencyRoomId = null;
  showNoSelection();
});


// Render Emergency Alerts List (Messenger Style)
function renderEmergencyAlertsList() {
  const list = document.getElementById('emergency-alerts-list');
  const countBadge = document.getElementById('alerts-count');
  
  list.innerHTML = '';
  const alertsArray = Object.values(activeEmergencyRooms);
  countBadge.textContent = alertsArray.length;
  
  if (alertsArray.length === 0) {
    list.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #666;">
        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>No active emergency alerts</p>
      </div>
    `;
    return;
  }
  
  alertsArray.forEach(room => {
    const alertItem = document.createElement('div');
    alertItem.className = 'alert-item';
    if (currentEmergencyRoomId === room.alertData.room_id) {
      alertItem.classList.add('active');
    }
    
    const alertIcon = getAlertIcon(room.alertData.type);
    const timeAgo = getTimeAgo(room.alertData.timestamp || new Date());

    const isVictim = room.alertData.user_id === room.alertData.victim_id || !room.alertData.victim_id; // fallback if victim_id not present
    const victimNameHtml = isVictim
      ? `<span class="victim-name">${room.alertData.user_name || 'Anonymous'}</span>`
      : `${room.alertData.user_name || 'Anonymous'}`;
    
    alertItem.innerHTML = `
      <div class="alert-item-icon">
        <i class="${alertIcon}"></i>
      </div>
      <div class="alert-item-info">
        <h5 class="alert-item-title">${room.alertData.type} Emergency</h5>
        <p class="alert-item-details">${victimNameHtml} • ${room.alertData.details || 'No additional details'}</p>
        <p class="alert-item-time">${timeAgo}</p>
      </div>
      ${room.unreadCount > 0 ? `<span class="alert-item-badge">${room.unreadCount}</span>` : ''}
    `;
    
    alertItem.onclick = () => openEmergencyChatRoom(room.alertData.room_id);
    list.appendChild(alertItem);
  });
}

// Get Alert Icon
function getAlertIcon(type) {
  const icons = {
    'fire': 'fas fa-fire',
    'accident': 'fas fa-car-crash',
    'kidnapped': 'fas fa-user-times',
    'attacked': 'fas fa-fist-raised',
    'teased': 'fas fa-user-injured',
    'harassed': 'fas fa-hand-paper',
    'medical': 'fas fa-heartbeat',
    'other': 'fas fa-exclamation-triangle'
  };
  return icons[type.toLowerCase()] || 'fas fa-exclamation-triangle';
}

// Get Time Ago
function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Show Active Chat..
function showActiveChat(alertData) {
  document.getElementById('no-alert-selected').style.display = 'none';
  document.getElementById('active-chat-container').style.display = 'flex';
  
  // Update chat header
  document.getElementById('chat-alert-icon').className = getAlertIcon(alertData.type);
  document.getElementById('chat-alert-title').textContent = `${alertData.type} Emergency`;
  document.getElementById('chat-alert-location').textContent = alertData.details || 'Emergency assistance needed';
  
  // Update participants count dynamically
  const count = alertData.notified_count || 0;
  document.getElementById('participants-count').textContent = `${count} user${count === 1 ? '' : 's'} nearby`;
}

// Show No Selection
function showNoSelection() {
  document.getElementById('no-alert-selected').style.display = 'flex';
  document.getElementById('active-chat-container').style.display = 'none';
}

// Render Messages (Updated)
function renderEmergencyChatMessages(roomId) {
  const container = document.getElementById('emergency-chat-messages');
  container.innerHTML = '';

  const messages = activeEmergencyRooms[roomId]?.messages || [];
  const victimId = activeEmergencyRooms[roomId]?.alertData?.user_id;

  messages.forEach(msg => {
    const msgDiv = document.createElement('div');
    
    if (msg.user_name === 'System') {
      // System message styling
      msgDiv.className = 'system-message';
      msgDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${msg.message}`;
    } else if (msg.user_id === user.id) {
      msgDiv.className = 'my-message';
      msgDiv.textContent = msg.message;
    } else if (msg.user_id === victimId) {
      msgDiv.className = 'victim-message';
      msgDiv.innerHTML = `<strong>${msg.user_name || 'Victim'}:</strong> ${msg.message}`;
    } else {
      msgDiv.className = 'their-message';
      msgDiv.innerHTML = `<strong>${msg.user_name || 'Helper'}:</strong> ${msg.message}`;
    }
    container.appendChild(msgDiv);
  });

  container.scrollTop = container.scrollHeight;
}


// Function to display the message window
function displayMessage(data) {
    if (!data || !document.body) {
        console.error('Invalid data or document body not found');
        return;
    }

    const messageWindow = document.createElement('div');
    messageWindow.className = 'message-window';

    reverseGeocode(data.location.lat, data.location.lng, (address) => {
      messageWindow.innerHTML = `
        <h4>Emergency Alert</h4>
        <p>Type: ${data.type}</p>
        <p>Details: ${data.details}</p>
        <p>Location: ${data.location.lat}, ${data.location.lng}</p>
        <p>User ID: ${data.user_id}</p>
    `;
    document.body.appendChild(messageWindow);
    });
    
    // Automatically close the message window after a few seconds
    //setTimeout(() => {
    //    messageWindow.remove();
   // }, 10000);
}



// Initialize the map without default zoom controls
const map = L.map('map', {
    zoomControl: false,
  }).setView([51.505, -0.09], 13); // Default center (London)
  
  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  // Add custom zoom controls
  L.control.zoom({
    position: 'topright'
  }).addTo(map);

  // Variable to store the search marker
  let searchMarker = null;
  
  // Add search control
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topright',
    collapsed: false,
    placeholder: 'Search for places...',
    errorMessage: 'No results found.',
  })
    .on('markgeocode', function (e) {
      const latlng = e.geocode.center;

      // Remove existing search marker (if any)
      if (searchMarker) {
        map.removeLayer(searchMarker);
      }

      // Add a new marker for the searched location
      searchMarker = L.marker(latlng).addTo(map).bindPopup(e.geocode.name).openPopup();
      map.setView(latlng, 13);

      // Remove the marker after 15 seconds
      setTimeout(() => {
        if (searchMarker) {
          map.removeLayer(searchMarker);
          searchMarker = null;
        }
      }, 10000); // 15000 milliseconds = 15 seconds
    })
    .addTo(map);
  
  // Variable to store the user's location marker
  let userLocationMarker = null;
  
  // Function to set the map view to the user's current location
  function setMapToCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Geolocation Data:", position);
  
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
  
          console.log("Accuracy (meters):", position.coords.accuracy);
  
          // Remove existing marker (if any)
          if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
          }
  
          // Add a blue circular marker for the user's location
          userLocationMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
            radius: 8,
            fillColor: '#4285F4',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          }).addTo(map);
  
          // Center the map on the user's location
          map.setView([userLocation.lat, userLocation.lng], 16);
        },
        (error) => {
          console.error("Geolocation Error:", error);
          alert('Unable to retrieve your location. Please try again.');
        },
        {
          enableHighAccuracy: true, // Force high-accuracy mode
          timeout: 15000, // Increase timeout to allow GPS lock
          maximumAge: 0, // Prevent cached locations
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }
  
  
  // Recenter button event listener
  document.getElementById('recenter-btn').addEventListener('click', () => {
    setMapToCurrentLocation();
  });

  // Automatically show user's current location on page load
setMapToCurrentLocation();

  
  // Helpful keys functionality
  document.getElementById('tutorial').addEventListener('click', () => {
    
  });




  // Update user locations on database on page load and every 20 mins
  function updateUserLocationOnBackend() {
  if (!user || !user.id) return;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetch('http://localhost:5000/api/users/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        });
      }
    );
  }
}

// Call once on page load
updateUserLocationOnBackend();

// Call every 20 minutes (120000 ms)
setInterval(updateUserLocationOnBackend, 1200000);



// Tutorial button event listener
document.getElementById('tutorial').addEventListener('click', () => {
  window.open('https://youtu.be/BRii9rkKVQY?si=Sca2Nu4jVrvg_6nc', '_blank');
});


  
  // Show Friends Modal
document.getElementById('friends-btn').addEventListener('click', () => {
  document.getElementById('friends-modal').style.display = 'flex';
  loadFriendsList();
});

// Close Friends Modal
document.getElementById('close-friends-modal').addEventListener('click', () => {
  document.getElementById('friends-modal').style.display = 'none';
});

// Sidebar navigation for Friends Modal
document.querySelectorAll('.sidebar-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.friends-section').forEach(section => section.style.display = 'none');
    const sectionId = this.getAttribute('data-section') + '-section';
    document.getElementById(sectionId).style.display = 'block';
  });
});





// Helper: Get current user from localStorage
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('user'));
}

// 1. Listen for input in the add-friend-search field
const addFriendSearch = document.getElementById('add-friend-search');
const addFriendResults = document.getElementById('add-friend-results');

addFriendSearch.addEventListener('input', async function() {
  const query = this.value.trim();
  const user = getCurrentUser();
  addFriendResults.innerHTML = '';
  if (!query || !user) return;

  // 2. Fetch matching users from backend
  const res = await fetch(`http://localhost:5000/api/friends/search?user_id=${user.id}&q=${encodeURIComponent(query)}`);
  const users = await res.json();
  if (!Array.isArray(users) || users.length === 0) {
    addFriendResults.innerHTML = '<div class="add-friend-card">No users found.</div>';
    return;
  }

  // 3. Display results
  users.forEach(u => {
    const card = document.createElement('div');
    card.className = 'add-friend-card';
    card.innerHTML = `
      <div class="friend-avatar">${u.name[0]}</div>
      <div class="friend-info">
        <div class="friend-name">${u.name}</div>
        <div class="friend-email">${u.email}</div>
      </div>
    `;
    // 4. Handle click to confirm sending request
    card.addEventListener('click', () => {
      if (confirm(`Send friend request to ${u.name}?`)) {
        // 5. Send friend request
        fetch('http://localhost:5000/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, friend_id: u.id })
        })
        .then(res => res.json())
        .then(data => {
          alert(data.message || 'Request sent!');
          addFriendResults.innerHTML = '';
          addFriendSearch.value = '';
        })
        .catch(() => alert('Failed to send friend request.'));
      }
    });
    addFriendResults.appendChild(card);
  });
});



async function loadIncomingRequests() {
  const user = getCurrentUser();
  if (!user) return;
  const res = await fetch(`http://localhost:5000/api/friends/requests/incoming/${user.id}`);
  const requests = await res.json();
  const container = document.getElementById('incoming-requests');
  container.innerHTML = '';
  if (!Array.isArray(requests) || requests.length === 0) {
    container.innerHTML = '<div class="request-card">No pending requests.</div>';
    return;
  }
  requests.forEach(req => {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.innerHTML = `
      <div class="friend-avatar">${req.name[0]}</div>
      <div class="friend-info">
        <div class="friend-name">${req.name}</div>
        <div class="friend-email">${req.email}</div>
      </div>
      <div class="request-actions">
        <button class="accept-btn">Accept</button>
        <button class="decline-btn">Decline</button>
      </div>
    `;

    card.querySelector('.accept-btn').onclick = async () => {
      await fetch('http://localhost:5000/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, friend_id: req.requester_id })
      });
      loadIncomingRequests();
      loadFriendsList(); // <-- Add this line
    };
    container.appendChild(card);
  });
}

// Call this when opening the requests section
document.querySelector('[data-section="friend-requests"]').addEventListener('click', loadIncomingRequests);



async function loadFriendsList() {
  const user = getCurrentUser();
  if (!user) return;
  const res = await fetch(`http://localhost:5000/api/friends/list/${user.id}`);
  const friends = await res.json();
  const container = document.getElementById('friends-list');
  container.innerHTML = '';
  if (!Array.isArray(friends) || friends.length === 0) {
    container.innerHTML = '<div class="friend-card">No friends yet.</div>';
    return;
  }
  friends.forEach(friend => {
    const card = document.createElement('div');
    card.className = 'friend-card';
    card.innerHTML = `
      <div class="friend-avatar">${friend.name[0]}</div>
      <div class="friend-info">
        <div class="friend-name">${friend.name}</div>
        <div class="friend-email">${friend.email}</div>
      </div>
      <div class="friend-actions">
        <button class="unfriend-btn">Unfriend</button>
        <button class="block-btn">Block</button>
      </div>
    `;
    card.querySelector('.unfriend-btn').onclick = async () => {
      await fetch('http://localhost:5000/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, friend_id: friend.id })
      });
      loadFriendsList();
    };
    card.querySelector('.block-btn').onclick = async () => {
    if (confirm(`Block ${friend.name}?`)) {
      await fetch('http://localhost:5000/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, blocked_user_id: friend.id })
      });
      loadFriendsList();
    }
  };

  // Messenger-style chat: open chat section on click (not on button click)
  card.querySelector('.friend-info').onclick = () => {
    openFriendChat(friend);
  };

    container.appendChild(card);
  });
}

document.querySelector('[data-section="friends-list"]').addEventListener('click', loadFriendsList);




let currentChatFriend = null;

// Show chat section for a friend
function openFriendChat(friend) {
  currentChatFriend = friend;
  // Hide all sections
  document.querySelectorAll('.friends-section').forEach(section => section.style.display = 'none');
  // Show chat section
  document.getElementById('friend-chat-section').style.display = 'flex';
  // Set header
  document.getElementById('chat-with-friend-header').textContent = `${friend.name}`;
  // Clear and load messages
  document.getElementById('friend-chat-messages').innerHTML = '';
  loadFriendMessages(friend.id);
}

// Back button
document.getElementById('back-to-friends').addEventListener('click', () => {
  document.getElementById('friend-chat-section').style.display = 'none';
  document.getElementById('friends-list-section').style.display = 'block';
  loadFriendsList();
  currentChatFriend = null;
});

// Send message
document.getElementById('send-friend-chat').addEventListener('click', () => {
  const input = document.getElementById('friend-chat-input');
  const message = input.value.trim();
  if (!message || !currentChatFriend) return;
  const user = getCurrentUser();

  // Send to backend via Socket.IO
  socket.emit('friendChatMessage', {
    sender_id: user.id,
    receiver_id: currentChatFriend.id,
    message
  });
  input.value = '';
});

// Load messages with a friend
async function loadFriendMessages(friendId) {
  const user = getCurrentUser();
  if (!user || !friendId) { // Added a check for friendId
      console.error("Cannot load messages: user or friendId is missing.");
      return;
  }
  const res = await fetch(`http://localhost:5000/api/friends/messages?user1=${user.id}&user2=${friendId}`);
  const messages = await res.json();
  const container = document.getElementById('friend-chat-messages');
  if (!container) { // Added a check for the container
      console.error("Chat messages container not found.");
      return;
  }
  container.innerHTML = '';
  messages.forEach(msg => {
    const msgDiv = document.createElement('div');
    msgDiv.className = msg.sender_id === user.id ? 'my-message' : 'their-message';
    msgDiv.textContent = msg.message;
    container.appendChild(msgDiv);
  });
  container.scrollTop = container.scrollHeight;
}

// Listen for friend chat messages
socket.on('friendChatMessage', (data) => {
  console.log('Received friendChatMessage on frontend', data);
  const currentUser = getCurrentUser(); // Get the current user at the time of event

  if (!currentUser || !currentUser.id) {
    console.warn('Cannot process friendChatMessage: current user not identified on frontend.');
    return;
  }
  // Check if the message is relevant to the currently open chat window
  if (currentChatFriend && currentChatFriend.id &&
      ((data.sender_id === currentUser.id && data.receiver_id === currentChatFriend.id) ||
       (data.sender_id === currentChatFriend.id && data.receiver_id === currentUser.id))) {
    console.log(`Message is for current chat with ${currentChatFriend.name} (ID: ${currentChatFriend.id}). Reloading messages.`);
    loadFriendMessages(currentChatFriend.id);
  }

  // Optional: Add a notification if the chat window isn't open with this friend
  else if (data.receiver_id === currentUser.id) {
    console.log(`New message received from user ${data.sender_id}. Current chat is with: ${currentChatFriend ? currentChatFriend.name + ` (ID: ${currentChatFriend.id})` : 'nobody'}. This message will not auto-display in the current view unless it's for this chat.`);
    // Here you could increment an unread counter or show a notification
  }
});


// Fetch and render blocked users
async function loadBlockedUsers() {
  const user = getCurrentUser();
  if (!user) return;
  const res = await fetch(`http://localhost:5000/api/friends/blocked/${user.id}`);
  const blocked = await res.json();
  const container = document.getElementById('blocked-users-list');
  container.innerHTML = '';
  if (!Array.isArray(blocked) || blocked.length === 0) {
    container.innerHTML = '<div class="friend-card">No blocked users.</div>';
    return;
  }
  blocked.forEach(u => {
    const card = document.createElement('div');
    card.className = 'friend-card';
    card.innerHTML = `
      <div class="friend-avatar">${u.name[0]}</div>
      <div class="friend-info">
        <div class="friend-name">${u.name}</div>
        <div class="friend-email">${u.email}</div>
      </div>
      <div class="friend-actions">
        <button class="unblock-btn">Unblock</button>
      </div>
    `;
    card.querySelector('.unblock-btn').onclick = async () => {
      if (confirm(`Unblock ${u.name}?`)) {
        await fetch('http://localhost:5000/api/friends/unblock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, blocked_user_id: u.id })
        });
        loadBlockedUsers();
      }
    };
    container.appendChild(card);
  });
}

// Load blocked users when the sidebar button is clicked
document.querySelector('[data-section="blocked-users"]').addEventListener('click', loadBlockedUsers);





  
  //Report Window
// Show the report popup when "Report" is clicked
document.getElementById('report').addEventListener('click', () => {
  document.getElementById('report-popup').style.display = 'flex';
});

// Hide the report popup when "Cancel" is clicked
document.getElementById('cancel-report').addEventListener('click', () => {
  document.getElementById('report-popup').style.display = 'none';
  document.getElementById('report-text').value = '';
});

// Handle report submission
document.getElementById('submit-report').addEventListener('click', () => {
  const text = document.getElementById('report-text').value.trim();
  if (!text) {
    alert('Please describe the issue.');
    return;
  }
  // Send the report to the backend (implement the endpoint in your backend)
  fetch('http://localhost:5000/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, user_id: user?.id || null })
  })
    .then(res => res.json())
    .then(data => {
      alert('Thank you for your feedback!');
      document.getElementById('report-popup').style.display = 'none';
      document.getElementById('report-text').value = '';
    })
    .catch(() => {
      alert('Failed to submit report. Please try again.');
    });
});
  
  // Function to search for places
  function searchPlaces(type) {
    const query = `${type} near me`;
    geocoder.geocode(query);
  }
  
// Seek Help Button (Main Button)
const seekHelpButton = document.getElementById('seek-help');
let holdTimeout;

seekHelpButton.addEventListener('mousedown', () => {
  holdTimeout = setTimeout(() => {
    sendEmergencyHelp();
  }, 1500); // 1500 milliseconds = 1.5 seconds
});

seekHelpButton.addEventListener('mouseup', () => {
  clearTimeout(holdTimeout);
});

seekHelpButton.addEventListener('mouseleave', () => {
  clearTimeout(holdTimeout);
});

seekHelpButton.addEventListener('click', () => {
  // Show the popup
  document.getElementById('seek-help-popup').style.display = 'flex';

  
});

// Add event listeners to emergency buttons to toggle the "selected" class
document.querySelectorAll('.emergency-btn').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('selected'); // Toggle the "selected" class
  });
});

// Cancel Button (Inside Popup)
document.getElementById('cancel-seek-help').addEventListener('click', () => {
  // Hide the popup
  document.getElementById('seek-help-popup').style.display = 'none';
});

// Confirm Seek Help Button (Inside Popup)
document.getElementById('confirm-seek-help').addEventListener('click', () => {
  // Get selected emergency types
  const selectedEmergencies = Array.from(document.querySelectorAll('.emergency-btn.selected'))
    .map((button) => button.dataset.emergency);

  if (selectedEmergencies.length === 0) {
    alert('Please select at least one emergency type.');
          return;
  }

  // Get additional details
  const emergencyDetails = document.getElementById('emergency-details').value;

  // Get user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Prepare data to send to the backend
        const emergencyData = {
          type: selectedEmergencies.join(', '), // Join selected types into a string
          details: emergencyDetails,
          location: location,
          user_id: user.id,
        };

        // Send data to the backend
        fetch('http://127.0.0.1:5000/emergency', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emergencyData),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log('Emergency alert sent:', data);
            alert('Help is on the way!');
            // Hide the popup
            document.getElementById('seek-help-popup').style.display = 'none';
            // Show the "Mark Safe" button
            document.getElementById('mark-safe').style.display = 'block';
          })
          .catch((error) => {
            console.error('Error sending emergency alert:', error);
            alert('Failed to send emergency alert. Please try again.');
          });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location. Please try again.');
      }
    );
  } else {
    alert('Geolocation is not supported by this browser.');
  }
});

// ...existing code...

// Handle the "Mark Safe" button click
document.getElementById('mark-safe').addEventListener('click', () => {
  // Hide the "Mark Safe" button
  document.getElementById('mark-safe').style.display = 'none';
  alert('You have marked yourself as safe.');

  // Send a request to the backend to update the alert status
  fetch('http://127.0.0.1:5000/mark-safe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: user.id }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log('Marked as safe:', data);
      if (data.status === 'success') {
        alert('You have been marked as safe.');
      } else {
        alert('Failed to mark as safe. Please try again.');
      }
    })
    .catch((error) => {
      console.error('Error marking as safe:', error);
      alert('Failed to mark as safe. Please try again.');
    });
});
// Function to send emergency help
function sendEmergencyHelp() {
  // Get user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Prepare data to send to the backend
        const emergencyData = {
          type: 'Emergency',
          details: 'Need help!!',
          location: location,
          user_id: user.id,
        };

        // Send data to the backend
        fetch('http://127.0.0.1:5000/emergency', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emergencyData),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log('Emergency alert sent:', data);
            alert('Help is on the way!');
          })
          .catch((error) => {
            console.error('Error sending emergency alert:', error);
            alert('Failed to send emergency alert. Please try again.');
          });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location. Please try again.');
      }
    );
  } else {
    alert('Geolocation is not supported by this browser.');
  }
}



  // Sign Up Form Submission
document.getElementById('signup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value;
  
    console.log('Sign Up Data:', { name, email, password, phone });
    alert('Sign Up Successful!');
    window.location.href = 'signin.html'; // Redirect to Sign In page
  });
  
  


  // Redirect Sign In button
document.getElementById('signin').addEventListener('click', () => {
    window.location.href = 'auth/signin.html'; // Change to the actual path if needed
});

// Redirect Sign Up button
document.getElementById('signup').addEventListener('click', () => {
    window.location.href = 'auth/signup.html'; // Change to the actual path if needed
});




// Account Button (Show Enhanced Personal Details and Options)
document.getElementById('account').addEventListener('click', () => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Remove existing popup if any
  const existingPopup = document.querySelector('.account-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'account-popup-overlay';
  
  // Create popup
  const accountPopup = document.createElement('div');
  accountPopup.className = 'account-popup';
  
  // Get user initials for avatar
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
  
  accountPopup.innerHTML = `
    <div class="account-popup-content">
      <!-- Close Button -->
      <button class="popup-close-btn" id="close-account-popup">
        <i class="fas fa-times"></i>
      </button>
      
      <!-- Profile Avatar Section -->
      <div class="profile-avatar-section">
        <div class="profile-avatar">
          <span class="avatar-initials">${initials}</span>
          <div class="status-indicator online"></div>
        </div>
        <h2 class="profile-name">${user.name}</h2>
        <p class="profile-subtitle">Active User</p>
      </div>
      
      <div class="divider"></div>
      
      <!-- User Info Section -->
      <div class="user-info-section">
        <div class="info-item">
          <i class="fas fa-envelope info-icon"></i>
          <div class="info-content">
            <label>Email</label>
            <span>${user.email}</span>
          </div>
        </div>
        <div class="info-item">
          <i class="fas fa-phone info-icon"></i>
          <div class="info-content">
            <label>Phone</label>
            <span>${user.phone || 'Not provided'}</span>
          </div>
        </div>
        <div class="info-item">
          <i class="fas fa-user-tag info-icon"></i>
          <div class="info-content">
            <label>Role</label>
            <span>${user.role || 'User'}</span>
          </div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="action-btn edit-profile-btn" id="edit-profile">
          <i class="fas fa-edit"></i> Edit Profile
        </button>
        <button class="action-btn change-password-btn" id="change-password">
          <i class="fas fa-key"></i> Change Password
        </button>
        <button class="action-btn logout-btn" id="logout">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(accountPopup);
  document.body.appendChild(overlay);

  // Add fade-in animation
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);

  // Event Listeners
  
  // Close button
  document.getElementById('close-account-popup').addEventListener('click', () => {
    closeAccountPopup(overlay);
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeAccountPopup(overlay);
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeAccountPopup(overlay);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);








  // Edit Profile button
document.getElementById('edit-profile').addEventListener('click', () => {
  showEditProfileModal(user);
});

// Function to show edit profile modal
function showEditProfileModal(currentUser) {
  // Remove existing edit modal if any
  const existingEditModal = document.querySelector('.edit-profile-modal');
  if (existingEditModal) {
    existingEditModal.remove();
  }

  // Create edit profile overlay
  const editOverlay = document.createElement('div');
  editOverlay.className = 'edit-profile-overlay';
  
  // Create edit profile modal
  const editModal = document.createElement('div');
  editModal.className = 'edit-profile-modal';
  
  editModal.innerHTML = `
    <div class="edit-profile-content">
      <div class="edit-profile-header">
        <h3>Edit Profile</h3>
        <button class="edit-close-btn" id="close-edit-profile">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <form id="edit-profile-form" class="edit-profile-form">
        <div class="edit-form-group">
          <label for="edit-name">
            <i class="fas fa-user"></i> Name
          </label>
          <input type="text" id="edit-name" value="${currentUser.name}" required>
        </div>
        
        <div class="edit-form-group">
          <label for="edit-email">
            <i class="fas fa-envelope"></i> Email
          </label>
          <input type="email" id="edit-email" value="${currentUser.email}" required>
        </div>
        
        <div class="edit-form-group">
          <label for="edit-phone">
            <i class="fas fa-phone"></i> Phone
          </label>
          <input type="tel" id="edit-phone" value="${currentUser.phone || ''}" placeholder="Enter phone number">
        </div>
        
        <div class="password-section">
          <h4>Confirm Changes</h4>
          <div class="edit-form-group">
            <label for="edit-current-password">
              <i class="fas fa-lock"></i> Current Password
            </label>
            <input type="password" id="edit-current-password" placeholder="Enter your current password" required>
          </div>
        </div>
        
        <div class="edit-form-actions">
          <button type="button" class="cancel-edit-btn" id="cancel-edit-profile">Cancel</button>
          <button type="submit" class="save-edit-btn">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </form>
      
      <div id="edit-profile-error" class="edit-error-message"></div>
    </div>
  `;

  editOverlay.appendChild(editModal);
  document.body.appendChild(editOverlay);

  // Add animation
  setTimeout(() => {
    editOverlay.classList.add('show');
  }, 10);

  // Event Listeners for edit modal
  
  // Close button
  document.getElementById('close-edit-profile').addEventListener('click', () => {
    closeEditProfileModal(editOverlay);
  });

  // Cancel button
  document.getElementById('cancel-edit-profile').addEventListener('click', () => {
    closeEditProfileModal(editOverlay);
  });

  // Close on overlay click
  editOverlay.addEventListener('click', (e) => {
    if (e.target === editOverlay) {
      closeEditProfileModal(editOverlay);
    }
  });

  // Close on Escape key
  const handleEditEscape = (e) => {
    if (e.key === 'Escape') {
      closeEditProfileModal(editOverlay);
      document.removeEventListener('keydown', handleEditEscape);
    }
  };
  document.addEventListener('keydown', handleEditEscape);

  // Form submission
  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newName = document.getElementById('edit-name').value.trim();
    const newEmail = document.getElementById('edit-email').value.trim();
    const newPhone = document.getElementById('edit-phone').value.trim();
    const currentPassword = document.getElementById('edit-current-password').value;
    const errorDiv = document.getElementById('edit-profile-error');
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    // Validation
    if (!newName || !newEmail || !currentPassword) {
      errorDiv.textContent = 'Please fill in all required fields.';
      return;
    }
    
    if (!isValidEmail(newEmail)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('.save-edit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('http://127.0.0.1:5000/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          name: newName,
          email: newEmail,
          phone: newPhone,
          current_password: currentPassword
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        // Update localStorage with new user data
        const updatedUser = {
          ...currentUser,
          name: newName,
          email: newEmail,
          phone: newPhone
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        alert('Profile updated successfully!');
        closeEditProfileModal(editOverlay);
        
        // Close and reopen account popup to show updated info
        const accountOverlay = document.querySelector('.account-popup-overlay');
        if (accountOverlay) {
          closeAccountPopup(accountOverlay);
          setTimeout(() => {
            document.getElementById('account').click();
          }, 300);
        }
      } else {
        errorDiv.textContent = result.message || 'Failed to update profile.';
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      errorDiv.textContent = 'Network error. Please try again.';
    } finally {
      // Reset button state
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Function to close edit profile modal
function closeEditProfileModal(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.remove();
  }, 300);
}

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}







  // Change Password button
document.getElementById('change-password').addEventListener('click', () => {
  showChangePasswordModal(user);
});

// Function to show change password modal
function showChangePasswordModal(currentUser) {
  // Remove existing change password modal if any
  const existingModal = document.querySelector('.change-password-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create change password overlay
  const changePasswordOverlay = document.createElement('div');
  changePasswordOverlay.className = 'change-password-overlay';
  
  // Create change password modal
  const changePasswordModal = document.createElement('div');
  changePasswordModal.className = 'change-password-modal';
  
  changePasswordModal.innerHTML = `
    <div class="change-password-content">
      <div class="change-password-header">
        <h3>Change Password</h3>
        <button class="change-password-close-btn" id="close-change-password">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <form id="change-password-form" class="change-password-form">
        <div class="change-password-info">
          <i class="fas fa-info-circle"></i>
          <span>Enter your new password below</span>
        </div>
        
        <div class="password-form-group">
          <label for="new-password">
            <i class="fas fa-key"></i> New Password
          </label>
          <input type="password" id="new-password" placeholder="Enter new password" required minlength="4">
        </div>
        
        <div class="password-form-group">
          <label for="confirm-new-password">
            <i class="fas fa-lock"></i> Confirm New Password
          </label>
          <input type="password" id="confirm-new-password" placeholder="Confirm new password" required minlength="4">
        </div>
        
        <div class="password-strength">
          <div class="strength-bar">
            <div class="strength-progress" id="strength-progress"></div>
          </div>
          <span class="strength-text" id="strength-text">Password strength</span>
        </div>
        
        <div class="change-password-actions">
          <button type="button" class="cancel-password-btn" id="cancel-change-password">Cancel</button>
          <button type="submit" class="save-password-btn">
            <i class="fas fa-save"></i> Change Password
          </button>
        </div>
      </form>
      
      <div id="change-password-error" class="password-error-message"></div>
    </div>
  `;

  changePasswordOverlay.appendChild(changePasswordModal);
  document.body.appendChild(changePasswordOverlay);

  // Add animation
  setTimeout(() => {
    changePasswordOverlay.classList.add('show');
  }, 10);

  // Password strength checker
  const newPasswordInput = document.getElementById('new-password');
  const strengthProgress = document.getElementById('strength-progress');
  const strengthText = document.getElementById('strength-text');

  newPasswordInput.addEventListener('input', () => {
    const password = newPasswordInput.value;
    const strength = checkPasswordStrength(password);
    
    strengthProgress.style.width = `${strength.score * 25}%`;
    strengthProgress.className = `strength-progress strength-${strength.level}`;
    strengthText.textContent = strength.text;
  });

  // Event Listeners for change password modal
  
  // Close button
  document.getElementById('close-change-password').addEventListener('click', () => {
    closeChangePasswordModal(changePasswordOverlay);
  });

  // Cancel button
  document.getElementById('cancel-change-password').addEventListener('click', () => {
    closeChangePasswordModal(changePasswordOverlay);
  });

  // Close on overlay click
  changePasswordOverlay.addEventListener('click', (e) => {
    if (e.target === changePasswordOverlay) {
      closeChangePasswordModal(changePasswordOverlay);
    }
  });

  // Close on Escape key
  const handlePasswordEscape = (e) => {
    if (e.key === 'Escape') {
      closeChangePasswordModal(changePasswordOverlay);
      document.removeEventListener('keydown', handlePasswordEscape);
    }
  };
  document.addEventListener('keydown', handlePasswordEscape);

  // Form submission
  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const errorDiv = document.getElementById('change-password-error');
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    // Validation
    if (!newPassword || !confirmPassword) {
      errorDiv.textContent = 'Please fill in both password fields.';
      return;
    }
    
    if (newPassword.length < 4) {
      errorDiv.textContent = 'Password must be at least 6 characters long.';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match.';
      return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('.save-password-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('http://127.0.0.1:5000/api/profile/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          new_password: newPassword
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        alert('Password changed successfully!');
        closeChangePasswordModal(changePasswordOverlay);
      } else {
        errorDiv.textContent = result.message || 'Failed to change password.';
      }
    } catch (error) {
      console.error('Error changing password:', error);
      errorDiv.textContent = 'Network error. Please try again.';
    } finally {
      // Reset button state
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Function to close change password modal
function closeChangePasswordModal(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.remove();
  }, 300);
}

// Function to check password strength
function checkPasswordStrength(password) {
  let score = 0;
  let text = 'Very Weak';
  let level = 'very-weak';
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  switch (score) {
    case 0:
    case 1:
      text = 'Very Weak';
      level = 'very-weak';
      break;
    case 2:
      text = 'Weak';
      level = 'weak';
      break;
    case 3:
      text = 'Medium';
      level = 'medium';
      break;
    case 4:
      text = 'Strong';
      level = 'strong';
      break;
    case 5:
      text = 'Very Strong';
      level = 'very-strong';
      break;
  }
  
  return { score, text, level };
}






  // Logout Button
  document.getElementById('logout').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('user');
      alert('You have been logged out.');
      closeAccountPopup(overlay);
      window.location.reload(); // Refresh to update UI
    }
  });
});

// Function to close account popup with animation
function closeAccountPopup(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.remove();
  }, 150);
}

// Show the notification window when the notification button is clicked
document.addEventListener('DOMContentLoaded', () => {
  const notificationsButton = document.getElementById('notifications');
  const notificationMenu = document.getElementById('notification-menu');
  const notificationCountElement = document.getElementById('notification-count');
  const clearNotificationsButton = document.getElementById('clear-notifications');
  const markAsReadButton = document.getElementById('mark-as-read');
  const notificationMessages = document.getElementById('notification-messages');

  let notificationCount = 0;

  // Toggle the notifications dropdown menu with animation
  notificationsButton.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent closing when clicking the button
    notificationMenu.classList.toggle('show');

    // Reset the notification count when opened
    if (notificationMenu.classList.contains('show')) {
      notificationCount = 0;
      notificationCountElement.textContent = notificationCount;
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!notificationMenu.contains(event.target) && !notificationsButton.contains(event.target)) {
      notificationMenu.classList.remove('show');
    }
  });

  // Prevent dropdown from closing when clicking inside
  notificationMenu.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  // Clear all notifications when "Clear All" button is clicked
  clearNotificationsButton.addEventListener('click', () => {
    notificationMessages.innerHTML = ''; // Remove all notifications
    notificationCount = 0; // Reset the notification count
    notificationCountElement.textContent = '0'; // Update the badge count
  });

  // Mark all notifications as read when "Mark as Read" button is clicked
  markAsReadButton.addEventListener('click', () => {
    const notifications = notificationMessages.getElementsByClassName('notification');
    for (let notification of notifications) {
      notification.classList.add('read'); // Add a class to mark as read
    }
  });

  // Function to add a new notification
  function addNotification(message) {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification';
    notificationElement.textContent = message;

    // Insert at the top of the notifications list
    notificationMessages.insertBefore(notificationElement, notificationMessages.firstChild);

    // Increment and update the notification count
    notificationCount++;
    notificationCountElement.textContent = notificationCount;

    // Click to highlight and show on map (if needed)
    notificationElement.addEventListener('click', () => {
      notificationMenu.classList.remove('show'); // Close dropdown after clicking
      console.log('Notification clicked:', message);
      // Add your logic to show the location on the map
    });
  }

  // Example usage: Simulating receiving a new notification (for testing)
  // setTimeout(() => addNotification('🚨 Emergency Alert: Someone needs help!'), 3000);
});

// Function to reverse geocode the coordinates
function reverseGeocode(lat, lng, callback) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data.address) {
          const addressComponents = [
              data.address.road,
              data.address.city || data.address.town || data.address.village,
              data.address.state,
              data.address.country
          ];
          const address = addressComponents.filter(component => component).join(', ');
          callback(address);
          } else {
              callback('Address not found');
          }
      })
      .catch(error => {
          console.error('Error during reverse geocoding:', error);
          callback('Error retrieving address');
      });
}





// response button start


let serviceResponses = {}; // { room_id: [ {service_name, service_type, time}, ... ] }

// Listen for serviceResponded events
socket.on('serviceResponded', function(data) {
  console.log('Received serviceResponded event:', data); // Debug log
  
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser) {
    console.log('No user found in localStorage');
    return;
  }
  
  // Save the response for the relevant room
  if (!serviceResponses[data.room_id]) serviceResponses[data.room_id] = [];
  serviceResponses[data.room_id].push({
    service_name: data.service_name,
    service_type: data.service_type,
    time: new Date()
  });

  console.log('Updated serviceResponses:', serviceResponses); // Debug log

  // Show a notification to the user WITHOUT location/address
  const notificationMessages = document.getElementById('notification-messages');
  const notificationElement = document.createElement('div');
  notificationElement.className = 'notification';

  // Set the notification text directly without reverse geocoding
  notificationElement.textContent = `${data.service_name}: Service Response - A ${data.service_type} service is responding to your alert!`;
  notificationMessages.insertBefore(notificationElement, notificationMessages.firstChild);

  notificationCount++;
  document.getElementById('notification-count').textContent = notificationCount;

  // Click: open the emergency chat window for this room
  notificationElement.addEventListener('click', () => {
    document.getElementById('emergency-chat-window').classList.remove('hide');
    renderEmergencyAlertsList();
    if (data.room_id) {
      openEmergencyChatRoom(data.room_id);
    }
  });

    // Hover: show mini window with detailed service information
    notificationElement.addEventListener('mouseenter', () => {
      const miniWindow = document.createElement('div');
      miniWindow.className = 'mini-window';
      
      // Show detailed service info instead of generic message
      miniWindow.innerHTML = `
        <div class="service-info-popup">
          <h4>${data.service_name}</h4>
          <p><strong>Service Type:</strong> ${data.service_type}</p>
          <p><strong>Status:</strong> Responded</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>Response Time:</strong> ${new Date().toLocaleTimeString()}</p>
          <p><small>Click notification to open chat</small></p>
        </div>
      `;
      
      document.body.appendChild(miniWindow);

      const rect = notificationElement.getBoundingClientRect();
      miniWindow.style.top = `${rect.top + window.scrollY + rect.height}px`;
      miniWindow.style.left = `${rect.left + window.scrollX}px`;
      miniWindow.classList.add('show');

      notificationElement.addEventListener('mouseleave', () => {
        miniWindow.classList.remove('show');
        setTimeout(() => miniWindow.remove(), 300);
      });
    });
});


// click handler for the "Response" button
  document.getElementById('response').addEventListener('click', () => {
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
      alert('Please sign in to view responses.');
      return;
    }
    
    // Find the user's current active emergency room
    const myRoom = Object.values(activeEmergencyRooms).find(room =>
      room.alertData.user_id === currentUser.id
    );
    
    // Remove existing popup if any
    document.querySelectorAll('.response-popup-overlay').forEach(e => e.remove());

    let html = `<div class="response-popup"><h3>Service Responses</h3><ul>`;
    if (!myRoom) {
      html += `<li>You have not sent any emergency alert.</li>`;
    } else {
      const responses = serviceResponses[myRoom.alertData.room_id] || [];
      console.log('Found room:', myRoom.alertData.room_id, 'Responses:', responses); // Debug log
      if (responses.length === 0) {
        html += `<li>No services have responded yet.</li>`;
      } else {
        responses.forEach(r => {
          html += `<li><b>${r.service_name}</b> (${r.service_type}) - ${r.time.toLocaleString()}</li>`;
        });
      }
    }
    html += `</ul><button id="close-response-popup">Close</button></div>`;

    const div = document.createElement('div');
    div.className = 'response-popup-overlay';
    div.innerHTML = html;
    document.body.appendChild(div);

    document.getElementById('close-response-popup').onclick = () => div.remove();
  });


// response button end