from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import pymysql
from werkzeug.security import generate_password_hash, check_password_hash
from flask import send_from_directory
from flask import request, jsonify
import math
import uuid
import threading
import time

# Initialize the Flask application
app = Flask(__name__)
CORS(app)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Database connection
def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='root',  # Replace with your MySQL username
        password='password',  # Replace with your MySQL password
        database='safety_db',
        cursorclass=pymysql.cursors.DictCursor  # Return results as dictionaries
    )

# Calculate distance between two points
def haversine(lat1, lng1, lat2, lng2):
    # Earth radius in km
    R = 6371.0
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


# Serve the main index.html
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

# Serve files from the auth folder
@app.route('/auth/<path:filename>')
def serve_auth_files(filename):
    return send_from_directory('../frontend/auth', filename)

# Serve other static files (e.g., CSS, JS)
@app.route('/<path:filename>')
def serve_static_files(filename):
    return send_from_directory('../frontend', filename)



# authentication start
# Sign Up Endpoint
@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone')

        if not name or not email or not password:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        hashed_password = generate_password_hash(password)

        connection = get_db_connection()
        cursor = connection.cursor()

        # Check if email already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        query = "INSERT INTO users (name, email, password, phone) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (name, email, hashed_password, phone))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'User registered successfully!'}), 201
    except Exception as e:
        print(f"Error during signup: {e}")
        return jsonify({'status': 'error', 'message': 'Registration failed. Please try again.'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Sign In Endpoint
@app.route('/signin', methods=['POST'])
def signin():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Fetch user by email
            sql = "SELECT id, name, email, password, role, phone FROM users WHERE email = %s"
            cursor.execute(sql, (email,))
            user = cursor.fetchone()

            if user and check_password_hash(user['password'], password):
                # Successful login
                return jsonify({
                    'status': 'success',
                    'message': 'Sign In Successful!',
                    'user': {
                        'id': user['id'],
                        'name': user['name'],
                        'email': user['email'],
                        'role': user['role'],  # Include the role in the response
                        'phone': user['phone']
                    }
                }), 200
            else:
                # Invalid credentials
                return jsonify({'status': 'error', 'message': 'Invalid email or password'}), 401
    except Exception as e:
        print('Error:', e)
        return jsonify({'status': 'error', 'message': 'An error occurred'}), 500
    finally:
        connection.close()




# Endpoint to Update User Profile
@app.route('/api/profile/update', methods=['PUT'])
def update_profile():
    try:
        data = request.json
        user_id = data.get('user_id')
        new_name = data.get('name')
        new_email = data.get('email')
        new_phone = data.get('phone')
        current_password = data.get('current_password')

        if not user_id or not new_name or not new_email or not current_password:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        # Verify current password
        cursor.execute("SELECT password FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row or not check_password_hash(user_row['password'], current_password):
            return jsonify({'status': 'error', 'message': 'Current password is incorrect'}), 400

        # Check if new email is already taken by another user
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'Email is already taken by another user'}), 400

        # Update user profile
        query = """
            UPDATE users 
            SET name = %s, email = %s, phone = %s 
            WHERE id = %s
        """
        cursor.execute(query, (new_name, new_email, new_phone, user_id))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'Profile updated successfully!'})
        
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to update profile'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


    

# Endpoint to change password
@app.route('/api/profile/change-password', methods=['PUT'])
def change_password():
    try:
        data = request.json
        user_id = data.get('user_id')
        new_password = data.get('new_password')

        if not user_id or not new_password:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        if len(new_password) < 4:
            return jsonify({'status': 'error', 'message': 'Password must be at least 6 characters long'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        # Hash the new password
        hashed_password = generate_password_hash(new_password)

        # Update user password
        query = "UPDATE users SET password = %s WHERE id = %s"
        cursor.execute(query, (hashed_password, user_id))
        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404

        return jsonify({'status': 'success', 'message': 'Password changed successfully!'})
        
    except Exception as e:
        print(f"Error changing password: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to change password'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# authentication end



# emergency start
#Emergency Endpoint
@app.route('/emergency', methods=['POST'])
def emergency():
    try:
        data = request.json
        emergency_type = data.get('type')
        details = data.get('details')
        location = data.get('location')
        user_id = data.get('user_id')

        if not emergency_type or not location:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            INSERT INTO emergency_alerts (type, details, latitude, longitude, user_id)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (emergency_type, details, location['lat'], location['lng'], user_id))
        connection.commit()

        alert_id = cursor.lastrowid

        # Fetch user name from users table
        cursor.execute("SELECT name FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        user_name = user_row['name'] if user_row else None

        # --- NEW: Notify only nearby users ---
        # Get all users with location (except the victim)
        cursor.execute("SELECT id, lat, lng FROM users WHERE id != %s AND lat IS NOT NULL AND lng IS NOT NULL", (user_id,))
        users = cursor.fetchall()
        nearby_user_ids = []
        for user in users:
            distance = haversine(location['lat'], location['lng'], user['lat'], user['lng'])
            if distance <= 2.0:  # 2km radius
                nearby_user_ids.append(str(user['id']))

        # 2. Find friends of the victim
        cursor.execute("""
            SELECT friend_id AS friend_user_id FROM friends WHERE user_id = %s AND status = 'accepted'
            UNION
            SELECT user_id AS friend_user_id FROM friends WHERE friend_id = %s AND status = 'accepted'
        """, (user_id, user_id))
        friends = cursor.fetchall()
        friend_user_ids = [str(row['friend_user_id']) for row in friends]

        # 3. Combine and deduplicate user IDs
        notify_user_ids = set(nearby_user_ids) | set(friend_user_ids)
        notify_user_ids.discard(str(user_id))  # Don't notify the victim

        alert_data = {
            'type': emergency_type,
            'details': details,
            'location': location,
            'user_id': user_id,
            'user_name': user_name,
        }


        # Optionally, still emit to the victim (so they see their own alert)
        # socketio.emit('emergencyAlert', alert_data, room=str(user_id))

        # Emit newAlert event (for admin dashboards etc.)
        socketio.emit('newAlert')
        socketio.emit('resolveAlert')

        # New code: After alert is created and notifications are sent:
        room_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO emergency_chats (alert_id, room_id, victim_id) VALUES (%s, %s, %s)",
            (alert_id, room_id, user_id)
        )
        # Add victim and all notified users to emergency_chat_members
        for uid in notify_user_ids | {str(user_id)}:
            cursor.execute(
                "INSERT INTO emergency_chat_members (room_id, user_id) VALUES (%s, %s)",
                (room_id, uid)
            )
        connection.commit()
        # Include room_id in the notification payload
        alert_data['room_id'] = room_id
        alert_data['notified_count'] = len(notify_user_ids)
        # Emit to all relevant users with room_id
        for uid in notify_user_ids | {str(user_id)}:
            socketio.emit('emergencyAlert', alert_data, room=uid)

        return jsonify({'status': 'success', 'message': 'Alert sent!'})
    except Exception as e:
        print(f"Error saving emergency data to database: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to send emergency alert.'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()



# Mark Safe Button Functionality
@app.route('/mark-safe', methods=['POST'])
def mark_safe():
    try:
        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({'status': 'error', 'message': 'Missing user ID'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Get active emergency rooms for this user before resolving
        cursor.execute("""
            SELECT ec.room_id, ea.id as alert_id
            FROM emergency_chats ec 
            JOIN emergency_alerts ea ON ec.alert_id = ea.id 
            WHERE ea.user_id = %s AND ea.resolved = 0
        """, (user_id,))
        active_rooms = cursor.fetchall()
        
        # Update alerts as resolved
        query = """
            UPDATE emergency_alerts
            SET resolved = 1
            WHERE user_id = %s AND resolved = 0
        """
        cursor.execute(query, (user_id,))
        connection.commit()

        # Send automated message to each active room
        for room in active_rooms:
            room_id = room['room_id']
            
            # Insert automated message
            cursor.execute("""
                INSERT INTO emergency_chat_messages (room_id, user_id, message)
                VALUES (%s, %s, %s)
            """, (room_id, None, 'The victim has marked themselves as safe. Thank you for your assistance! 🙏\nThis room will be closed in 30 seconds.'))
            
            # Emit message to all room members
            socketio.emit('emergencyChatMessage', {
                'room_id': room_id,
                'user_id': None,
                'user_name': 'System',
                'message': 'The victim has marked themselves as safe. Thank you for your assistance! 🙏\nThis room will be closed in 30 seconds.'
            }, room=room_id)
            
            # Start a timer to close the room after 30 seconds
            threading.Thread(target=close_emergency_room_after_delay, args=(room_id,)).start()

        connection.commit()

        # Emit resolveAlert event
        socketio.emit('resolveAlert')

        return jsonify({'status': 'success', 'message': 'Marked as safe'})
    except Exception as e:
        print(f"Error marking as safe: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to mark as safe'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Function to close emergency room after a delay
def close_emergency_room_after_delay(room_id):
    time.sleep(30)
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        # Mark the room as closed
        cursor.execute("UPDATE emergency_chats SET closed = 1 WHERE room_id = %s", (room_id,))
        connection.commit()
        # Insert system message into chat history
        cursor.execute(
            "INSERT INTO emergency_chat_messages (room_id, user_id, message) VALUES (%s, %s, %s)",
            (room_id, None, 'This emergency chat has been closed.')
        )
        connection.commit()
        # Notify all room members
        socketio.emit('emergencyRoomClosed', {'room_id': room_id}, room=room_id)
        # Also emit the system message to the chat
        socketio.emit('emergencyChatMessage', {
            'room_id': room_id,
            'user_id': None,
            'user_name': 'System',
            'message': 'This emergency chat has been closed.'
        }, room=room_id)
    except Exception as e:
        print(f"Error closing emergency room {room_id}: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Update User location on DB Endpoint
@app.route('/api/users/location', methods=['POST'])
def update_user_location():
    data = request.json
    user_id = data.get('user_id')
    lat = data.get('lat')
    lng = data.get('lng')
    if not user_id or lat is None or lng is None:
        return jsonify({'status': 'error', 'message': 'Missing user_id or location'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("UPDATE users SET lat=%s, lng=%s WHERE id=%s", (lat, lng, user_id))
        connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        print('Error updating user location:', e)
        return jsonify({'status': 'error', 'message': 'Failed to update location'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# emergency end







#Socket.IO Room Join & Messaging
@socketio.on('joinEmergencyRoom')
def join_emergency_room(data):
    room_id = data['room_id']
    join_room(room_id)

# Send/Receive Group Messages
@socketio.on('emergencyChatMessage')
def handle_emergency_chat_message(data):
    room_id = data['room_id']
    user_id = data['user_id']
    message = data['message']

    # Check if the room is closed
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT closed FROM emergency_chats WHERE room_id = %s", (room_id,))
    result = cursor.fetchone()
    if result and result.get('closed'):
        # Optionally, emit a warning to the sender
        emit('emergencyChatMessage', {
            'room_id': room_id,
            'user_id': None,
            'user_name': 'System',
            'message': 'This emergency chat has been closed. You cannot send messages.'
        }, room=request.sid)
        cursor.close()
        connection.close()
        return

    # Save to DB
    cursor.execute(
        "INSERT INTO emergency_chat_messages (room_id, user_id, message) VALUES (%s, %s, %s)",
        (room_id, user_id, message)
    )
    cursor.connection.commit()
    # Broadcast to room
    socketio.emit('emergencyChatMessage', data, room=room_id)
    cursor.close()
    connection.close()



# Fetch Message History
@app.route('/api/emergency-chat/messages')
def get_emergency_chat_messages():
    room_id = request.args.get('room_id')
    cursor = get_db_connection().cursor()
    cursor.execute(
        "SELECT user_id, message, sent_at FROM emergency_chat_messages WHERE room_id = %s ORDER BY sent_at ASC",
        (room_id,)
    )
    return jsonify(cursor.fetchall())


        


# friends start
# Send a friend request
@app.route('/api/friends/request', methods=['POST'])
def send_friend_request():
    data = request.json
    user_id = data.get('user_id')
    friend_id = data.get('friend_id')
    if not user_id or not friend_id or user_id == friend_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        # Check if already friends or pending
        cursor.execute("SELECT * FROM friends WHERE user_id=%s AND friend_id=%s", (user_id, friend_id))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'Request already exists or already friends'}), 400
        # Insert request (pending)
        cursor.execute("INSERT INTO friends (user_id, friend_id, status) VALUES (%s, %s, 'pending')", (user_id, friend_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Friend request sent'})
    except Exception as e:
        print('Error sending friend request:', e)
        return jsonify({'status': 'error', 'message': 'Failed to send friend request'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Accept a friend request
@app.route('/api/friends/accept', methods=['POST'])
def accept_friend_request():
    data = request.json
    user_id = data.get('user_id')        # The user accepting the request
    friend_id = data.get('friend_id')    # The user who sent the request
    if not user_id or not friend_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        # Update the request to accepted
        cursor.execute("UPDATE friends SET status='accepted' WHERE user_id=%s AND friend_id=%s AND status='pending'", (friend_id, user_id))
        # Add reciprocal friendship
        cursor.execute("INSERT IGNORE INTO friends (user_id, friend_id, status) VALUES (%s, %s, 'accepted')", (user_id, friend_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Friend request accepted'})
    except Exception as e:
        print('Error accepting friend request:', e)
        return jsonify({'status': 'error', 'message': 'Failed to accept friend request'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Decline a friend request
@app.route('/api/friends/decline', methods=['POST'])
def decline_friend_request():
    data = request.json
    user_id = data.get('user_id')        # The user declining the request
    friend_id = data.get('friend_id')    # The user who sent the request
    if not user_id or not friend_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("UPDATE friends SET status='declined' WHERE user_id=%s AND friend_id=%s AND status='pending'", (friend_id, user_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Friend request declined'})
    except Exception as e:
        print('Error declining friend request:', e)
        return jsonify({'status': 'error', 'message': 'Failed to decline friend request'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Remove a friend
@app.route('/api/friends/remove', methods=['POST'])
def remove_friend():
    data = request.json
    user_id = data.get('user_id')
    friend_id = data.get('friend_id')
    if not user_id or not friend_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM friends WHERE (user_id=%s AND friend_id=%s) OR (user_id=%s AND friend_id=%s)", (user_id, friend_id, friend_id, user_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Friend removed'})
    except Exception as e:
        print('Error removing friend:', e)
        return jsonify({'status': 'error', 'message': 'Failed to remove friend'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# List all friends for a user
@app.route('/api/friends/list/<int:user_id>', methods=['GET'])
def list_friends(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.email, u.phone, u.status
            FROM friends f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = %s AND f.status = 'accepted'
        """, (user_id,))
        friends = cursor.fetchall()
        return jsonify(friends)
    except Exception as e:
        print('Error listing friends:', e)
        return jsonify({'status': 'error', 'message': 'Failed to list friends'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# List all incoming friend requests for a user
@app.route('/api/friends/requests/incoming/<int:user_id>', methods=['GET'])
def incoming_requests(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT f.user_id as requester_id, u.name, u.email
            FROM friends f
            JOIN users u ON u.id = f.user_id
            WHERE f.friend_id = %s AND f.status = 'pending'
        """, (user_id,))
        requests = cursor.fetchall()
        return jsonify(requests)
    except Exception as e:
        print('Error fetching incoming requests:', e)
        return jsonify({'status': 'error', 'message': 'Failed to fetch incoming requests'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# List all outgoing friend requests for a user
@app.route('/api/friends/requests/outgoing/<int:user_id>', methods=['GET'])
def outgoing_requests(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT f.friend_id as requested_id, u.name, u.email
            FROM friends f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = %s AND f.status = 'pending'
        """, (user_id,))
        requests = cursor.fetchall()
        return jsonify(requests)
    except Exception as e:
        print('Error fetching outgoing requests:', e)
        return jsonify({'status': 'error', 'message': 'Failed to fetch outgoing requests'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Search users to add as friends (excluding already friends and self)
@app.route('/api/friends/search', methods=['GET'])
def search_users():
    user_id = request.args.get('user_id')
    query = request.args.get('q', '')
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Missing user_id'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id, name, email
            FROM users
            WHERE (name LIKE %s OR email LIKE %s)
              AND id != %s
              AND id NOT IN (
                SELECT friend_id FROM friends WHERE user_id = %s AND status IN ('pending', 'accepted')
                UNION
                SELECT user_id FROM friends WHERE friend_id = %s AND status IN ('pending', 'accepted')
              )
        """, (f'%{query}%', f'%{query}%', user_id, user_id, user_id))
        users = cursor.fetchall()
        return jsonify(users)
    except Exception as e:
        print('Error searching users:', e)
        return jsonify({'status': 'error', 'message': 'Failed to search users'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()




# Store/Send a message
@app.route('/api/friends/message', methods=['POST'])
def send_friend_message():
    data = request.json
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    message = data.get('message')
    if not sender_id or not receiver_id or not message:
        return jsonify({'status': 'error', 'message': 'Missing fields'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO friend_messages (sender_id, receiver_id, message, created_at) VALUES (%s, %s, %s, NOW())",
            (sender_id, receiver_id, message)
        )
        connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        print('Error sending message:', e)
        return jsonify({'status': 'error', 'message': 'Failed to send message'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Fetch messages between two users
@app.route('/api/friends/messages', methods=['GET'])
def get_friend_messages():
    user1 = request.args.get('user1')
    user2 = request.args.get('user2')
    if not user1 or not user2:
        return jsonify([])
    try:
        connection = get_db_connection()
        # cursor = connection.cursor(dictionary=True)
        cursor = connection.cursor()
        cursor.execute("""
            SELECT m.*, u.name as sender_name
            FROM friend_messages m
            JOIN users u ON u.id = m.sender_id
            WHERE (sender_id = %s AND receiver_id = %s)
               OR (sender_id = %s AND receiver_id = %s)
            ORDER BY m.created_at ASC
        """, (user1, user2, user2, user1))
        messages = cursor.fetchall()
        return jsonify(messages)
    except Exception as e:
        print('Error fetching messages:', {e})
        return jsonify([])
    finally:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'connection' in locals() and connection: connection.close()



# Block a user
@app.route('/api/friends/block', methods=['POST'])
def block_user():
    data = request.json
    user_id = data.get('user_id')
    blocked_user_id = data.get('blocked_user_id')
    if not user_id or not blocked_user_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("INSERT IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (%s, %s)", (user_id, blocked_user_id))
        # Remove friendship if exists
        cursor.execute("DELETE FROM friends WHERE (user_id=%s AND friend_id=%s) OR (user_id=%s AND friend_id=%s)", (user_id, blocked_user_id, blocked_user_id, user_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'User blocked'})
    except Exception as e:
        print('Error blocking user:', e)
        return jsonify({'status': 'error', 'message': 'Failed to block user'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

# Unblock a user
@app.route('/api/friends/unblock', methods=['POST'])
def unblock_user():
    data = request.json
    user_id = data.get('user_id')
    blocked_user_id = data.get('blocked_user_id')
    if not user_id or not blocked_user_id:
        return jsonify({'status': 'error', 'message': 'Invalid user IDs'}), 400
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM blocked_users WHERE user_id=%s AND blocked_user_id=%s", (user_id, blocked_user_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'User unblocked'})
    except Exception as e:
        print('Error unblocking user:', e)
        return jsonify({'status': 'error', 'message': 'Failed to unblock user'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()


# Endpoint to List Blocked Users
@app.route('/api/friends/blocked/<int:user_id>', methods=['GET'])
def get_blocked_users(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.email
            FROM blocked_users b
            JOIN users u ON u.id = b.blocked_user_id
            WHERE b.user_id = %s
        """, (user_id,))
        blocked = cursor.fetchall()
        return jsonify(blocked)
    except Exception as e:
        print('Error fetching blocked users:', e)
        return jsonify({'status': 'error', 'message': 'Failed to fetch blocked users'}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()

   

# friends end



# New: Handle friend chat messages
@socketio.on('friendChatMessage')
def handle_friend_chat_message(data):
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    message = data.get('message')
    if not sender_id or not receiver_id or not message:
        return

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO friend_messages (sender_id, receiver_id, message, created_at) VALUES (%s, %s, %s, NOW())",
            (sender_id, receiver_id, message)
        )
        connection.commit()

        # Emit the message to the specific receiver
        emit('friendChatMessage', data, room=str(receiver_id))
         # Also emit the message back to the sender's room
        if str(sender_id) != str(receiver_id): # Avoid double sending if sending to self (though unlikely in this context)
            emit('friendChatMessage', data, room=str(sender_id))

    except Exception as e:
        print('Error sending friend message:', e)
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()



# New: Join room on connection
@socketio.on('connect')
def test_connect():
    user_id = request.args.get('user_id')
    if user_id:
        join_room(str(user_id))
        join_room(f'user_{user_id}')  # this line for consistency
        print(f'User {user_id} connected and joined rooms {str(user_id)} and user_{user_id}')
    else:
        print('Anonymous client connected (no user_id provided)')







# admin start
# dashboard start
# Endpoint to get the total number of users
@app.route('/api/users/count', methods=['GET'])
def get_total_users():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM users")
        result = cursor.fetchone()
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching total users: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch total users'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Endpoint to get the number of active alerts
@app.route('/api/alerts/active', methods=['GET'])
def get_active_alerts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM emergency_alerts WHERE resolved = 0")
        result = cursor.fetchone()
        print(f"Active alerts count: {result['count']}")  # Add logging
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching active alerts: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch active alerts'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Endpoint to get the number of resolved alerts
@app.route('/api/alerts/resolved', methods=['GET'])
def get_resolved_alerts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM emergency_alerts WHERE resolved = 1")
        result = cursor.fetchone()
        print(f"Resolved alerts count: {result['count']}")  # Add logging
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching resolved alerts: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch resolved alerts'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Endpoint to get alerts over time
@app.route('/api/alerts/over-time', methods=['GET'])
def get_alerts_over_time():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM emergency_alerts
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """)
        result = cursor.fetchall()
        labels = [row['date'].strftime('%Y-%m-%d') for row in result]
        data = [row['count'] for row in result]
        return jsonify({'labels': labels, 'data': data})
    except Exception as e:
        print(f"Error fetching alerts over time: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch alerts over time'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# dashboard end


# user management start
# Endpoint to get all users with optional filters
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        # Get query parameters
        role = request.args.get('role')  # Optional role filter
        status = request.args.get('status')  # Optional status filter
        search = request.args.get('search')  # Optional search query

        connection = get_db_connection()
        cursor = connection.cursor()

        # Base query
        query = "SELECT id, name, email, phone, role, status FROM users WHERE 1=1"
        params = []

        # Add filters if provided
        if role:
            query += " AND role = %s"
            params.append(role)

        if status:
            query += " AND status = %s"
            params.append(status)

        if search:
            query += " AND (name LIKE %s OR email LIKE %s)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        # Execute query
        cursor.execute(query, params)
        users = cursor.fetchall()

        return jsonify(users)
    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch users'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Endpoint to add a new user
@app.route('/api/users', methods=['POST'])
def add_user():
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone')
        role = data.get('role')
        status = data.get('status', 'active')  # Default to active if not provided

        if not name or not email or not password or not role:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        hashed_password = generate_password_hash(password)

        connection = get_db_connection()
        cursor = connection.cursor()

        # Check if email already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        query = "INSERT INTO users (name, email, password, phone, role, status) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(query, (name, email, hashed_password, phone, role, status))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'User added successfully!'}), 201
    except Exception as e:
        print(f"Error adding user: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to add user'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Endpoint to edit a user
@app.route('/api/users/<int:user_id>', methods=['PUT'])
def edit_user(user_id):
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        role = data.get('role')
        status = data.get('status')

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            UPDATE users
            SET name = %s, email = %s, phone = %s, role = %s, status = %s
            WHERE id = %s
        """
        cursor.execute(query, (name, email, phone, role, status, user_id))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'User updated successfully!'})
    except Exception as e:
        print(f"Error editing user: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to update user'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Endpoint to delete a user
@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = "DELETE FROM users WHERE id = %s"
        cursor.execute(query, (user_id,))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'User deleted successfully!'})
    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to delete user'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()
        
# user management end

# service management start
# Endpoint to handle service creation
@app.route('/api/services', methods=['POST'])
def add_service():
    try:
        data = request.json
        company_name = data.get('company_name')
        email = data.get('email')
        password = data.get('password')  # NEW
        service_type = data.get('service_type')
        phone = data.get('phone')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not company_name or not email or not password or not service_type:
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
        
        if latitude is None or longitude is None:
            return jsonify({'status': 'error', 'message': 'Location is required'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        # Check if email already exists
        cursor.execute("SELECT * FROM services WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        hashed_password = generate_password_hash(password)

        query = "INSERT INTO services (company_name, email, password, service_type, phone, lat, lng) VALUES (%s, %s, %s, %s, %s, %s, %s)"
        cursor.execute(query, (company_name, email, hashed_password, service_type, phone, latitude, longitude))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'Service added successfully!'}), 201
    except Exception as e:
        print(f"Error adding service: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to add service'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# service management end
# admin end


# service start
#fire start
# Endpoint to handle fire service login

@app.route('/api/fire/login', methods=['POST'])
def fire_service_login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'status': 'error', 'message': 'Email and password are required.'}), 400

        connection = get_db_connection()
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT id, company_name, email, password, service_type FROM services WHERE email = %s", (email,))
        service = cursor.fetchone()

        if service and check_password_hash(service['password'], password):
            # Successful login
            return jsonify({
                'status': 'success',
                'message': 'Login successful!',
                'service': {
                    'id': service['id'],
                    'company_name': service['company_name'],
                    'email': service['email'],
                    'service_type': service['service_type']
                }
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Invalid email or password.'}), 401
    except Exception as e:
        print(f"Error during fire service login: {e}")
        return jsonify({'status': 'error', 'message': 'An error occurred. Please try again.'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()



#Fire Service Info

@app.route('/api/fire/me', methods=['POST'])
def get_fire_service_profile():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required.'}), 400

        connection = get_db_connection()
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        # Ensure your services table has lat and lng columns
        cursor.execute("SELECT id, company_name, email, service_type, phone, lat, lng FROM services WHERE email = %s", (email,))
        service = cursor.fetchone()
        cursor.close()
        connection.close()

        if service:
            return jsonify({
                'status': 'success',
                'id': service['id'],
                'company_name': service['company_name'],
                'email': service['email'],
                'service_type': service['service_type'],
                'phone': service['phone'],
                'lat': service['lat'],
                'lng': service['lng']
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Service profile not found.'}), 404
    except Exception as e:
        print(f"Error fetching fire service profile: {e}")
        return jsonify({'status': 'error', 'message': 'An error occurred fetching profile.'}), 500


#fire endpoint to return all unresolved fire alerts
@app.route('/api/fire/alerts', methods=['GET'])
def get_unresolved_fire_alerts():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT ea.id, ea.type, ea.details, ea.latitude, ea.longitude, ea.user_id, u.name as user_name
        FROM emergency_alerts ea
        LEFT JOIN users u ON ea.user_id = u.id
        WHERE ea.type = 'fire' AND (ea.resolved = 0 OR ea.resolved IS NULL)
        ORDER BY ea.id DESC
    """)
    alerts = cursor.fetchall()
    cursor.close()
    connection.close()
    # Format for frontend
    return jsonify([
        {
            'id': alert['id'],
            'type': alert['type'],
            'details': alert['details'],
            'location': {'lat': alert['latitude'], 'lng': alert['longitude']},
            'user_id': alert['user_id'],
            'user_name': alert['user_name']
        }
        for alert in alerts
    ])


#fire end





# medical start

# Medical Service Login
@app.route('/api/medical/login', methods=['POST'])
def medical_service_login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'status': 'error', 'message': 'Email and password are required.'}), 400

        connection = get_db_connection()
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM services WHERE email = %s AND service_type = 'hospital'", (email,))
        service = cursor.fetchone()
        cursor.close()
        connection.close()

        if service and check_password_hash(service['password'], password):
            return jsonify({'status': 'success', 'message': 'Login successful!'}), 200
        else:
            return jsonify({'status': 'error', 'message': 'Invalid email or password.'}), 401
    except Exception as e:
        print(f"Error during medical service login: {e}")
        return jsonify({'status': 'error', 'message': 'Login failed. Please try again.'}), 500

# Medical Service Profile
@app.route('/api/medical/me', methods=['POST'])
def get_medical_service_profile():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required.'}), 400

        connection = get_db_connection()
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT id, company_name, email, service_type, phone, lat, lng FROM services WHERE email = %s AND service_type = 'hospital'", (email,))
        service = cursor.fetchone()
        cursor.close()
        connection.close()

        if service:
            return jsonify({
                'status': 'success',
                'id': service['id'],
                'company_name': service['company_name'],
                'email': service['email'],
                'service_type': service['service_type'],
                'phone': service['phone'],
                'lat': service['lat'],
                'lng': service['lng']
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Medical service not found.'}), 404
    except Exception as e:
        print(f"Error fetching medical service profile: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch profile.'}), 500

# Medical Service Alerts (Accident alerts only)
@app.route('/api/medical/alerts', methods=['GET'])
def get_unresolved_medical_alerts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT ea.id, ea.type, ea.details, ea.latitude, ea.longitude, ea.user_id, ea.created_at, u.name as user_name
            FROM emergency_alerts ea
            LEFT JOIN users u ON ea.user_id = u.id
            WHERE ea.resolved = 0 AND (ea.type LIKE '%accident%' OR ea.type LIKE '%fire%')
            ORDER BY ea.created_at DESC
        """)
        alerts = cursor.fetchall()
        cursor.close()
        connection.close()

        # Format alerts for frontend
        formatted_alerts = []
        for alert in alerts:
            formatted_alerts.append({
                'id': alert['id'],
                'type': alert['type'],
                'details': alert['details'],
                'location': {
                    'lat': float(alert['latitude']) if alert['latitude'] else None,
                    'lng': float(alert['longitude']) if alert['longitude'] else None
                },
                'user_id': alert['user_id'],
                'user_name': alert['user_name'],
                'created_at': alert['created_at'].isoformat() if alert['created_at'] else None
            })

        return jsonify(formatted_alerts), 200
    except Exception as e:
        print(f"Error fetching medical alerts: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch alerts.'}), 500


    
# medical end


# both fire and medical start

@socketio.on('serviceResponded')
def handle_service_responded(data, callback=None):
    user_id = data.get('user_id')
    alert_id = data.get('alert_id')
    service_type = data.get('service_type')
    service_name = data.get('service_name')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Find the actual room_id for this alert from emergency_chats table
        cursor.execute("SELECT room_id FROM emergency_chats WHERE alert_id = %s", (alert_id,))
        room_result = cursor.fetchone()
        
        # Get the service phone number from the services table
        cursor.execute("SELECT phone FROM services WHERE company_name = %s AND service_type = %s", (service_name, service_type))
        service_result = cursor.fetchone()
        phone = service_result['phone'] if service_result and service_result['phone'] else 'Not available'
        
        if room_result and user_id:
            room_id = room_result['room_id']
            
            # Emit to the specific user
            socketio.emit('serviceResponded', {
                'alert_id': alert_id,
                'room_id': room_id,
                'phone': phone,  # Now includes the actual phone number
                'service_type': service_type,
                'service_name': service_name
            }, room=str(user_id))  # Changed from f'user_{user_id}' to str(user_id)
            
            # Send acknowledgment back to service
            if callback:
                callback({'status': 'success', 'message': 'Response sent to user'})
                
            print(f"Service response sent to user {user_id} for room {room_id}")
        else:
            if callback:
                callback({'status': 'error', 'message': 'Room or user not found'})
            print(f"Room not found for alert_id {alert_id} or user_id missing")
            
    except Exception as e:
        print(f"Error handling service response: {e}")
        if callback:
            callback({'status': 'error', 'message': 'Server error'})
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# both fire and medical end
# service end




# Get all alerts with filters
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        type_ = request.args.get('type')
        status = request.args.get('status')
        search = request.args.get('search')

        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT a.*, u.name as user_name
            FROM emergency_alerts a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1
        """
        params = []
        if type_:
            query += " AND a.type = %s"
            params.append(type_)
        if status:
            if status == 'active':
                query += " AND a.resolved = 0"
            elif status == 'resolved':
                query += " AND a.resolved = 1"
        if search:
            query += " AND (a.type LIKE %s OR u.name LIKE %s OR a.details LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        query += " ORDER BY a.created_at DESC"
        cursor.execute(query, params)
        alerts = cursor.fetchall()
        return jsonify(alerts)
    except Exception as e:
        print(f"Error fetching alerts: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch alerts'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Get alert details by ID
@app.route('/api/alerts/<int:alert_id>', methods=['GET'])
def get_alert(alert_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT a.*, u.name as user_name
            FROM emergency_alerts a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.id = %s
        """
        cursor.execute(query, (alert_id,))
        alert = cursor.fetchone()
        return jsonify(alert)
    except Exception as e:
        print(f"Error fetching alert: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch alert'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Mark alert as resolved
@app.route('/api/alerts/<int:alert_id>/resolve', methods=['PUT'])
def resolve_alert(alert_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = "UPDATE emergency_alerts SET resolved = 1 WHERE id = %s"
        cursor.execute(query, (alert_id,))
        connection.commit()
        # Emit resolveAlert event
        socketio.emit('resolveAlert')
        return jsonify({'status': 'success', 'message': 'Alert resolved'})
    except Exception as e:
        print(f"Error resolving alert: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to resolve alert'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

# Assign alert to a responder/service
@app.route('/api/alerts/<int:alert_id>/assign', methods=['PUT'])
def assign_alert(alert_id):
    try:
        data = request.json
        service_id = data.get('service_id')
        if not service_id:
            return jsonify({'status': 'error', 'message': 'Missing service_id'}), 400
        connection = get_db_connection()
        cursor = connection.cursor()
        query = "UPDATE emergency_alerts SET assigned_service_id = %s WHERE id = %s"
        cursor.execute(query, (service_id, alert_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Alert assigned'})
    except Exception as e:
        print(f"Error assigning alert: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to assign alert'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()




# Submit Report Endpoint
@app.route('/api/report', methods=['POST'])
def create_report():
    try:
        data = request.json
        text = data.get('text')
        user_id = data.get('user_id')  # Optional, can be null for anonymous reports

        if not text:
            return jsonify({'status': 'error', 'message': 'Report text is required'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()
        query = "INSERT INTO reports (text, user_id, status, created_at) VALUES (%s, %s, %s, NOW())"
        cursor.execute(query, (text, user_id, 'pending'))
        connection.commit()

        return jsonify({'status': 'success', 'message': 'Report submitted successfully!'}), 201
    except Exception as e:
        print(f"Error creating report: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to submit report'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Get all user reports
@app.route('/api/reports', methods=['GET'])
def get_reports():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT r.id, r.text, r.status, r.created_at, u.name as user_name
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        """
        cursor.execute(query)
        reports = cursor.fetchall()
        return jsonify(reports)
    except Exception as e:
        print(f"Error fetching reports: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to fetch reports'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()


# Update report status
@app.route('/api/reports/<int:report_id>/status', methods=['PUT'])
def update_report_status(report_id):
    try:
        data = request.json
        status = data.get('status')
        if status not in ['pending', 'reviewed', 'resolved']:
            return jsonify({'status': 'error', 'message': 'Invalid status'}), 400
        connection = get_db_connection()
        cursor = connection.cursor()
        query = "UPDATE reports SET status = %s WHERE id = %s"
        cursor.execute(query, (status, report_id))
        connection.commit()
        return jsonify({'status': 'success', 'message': 'Report status updated'})
    except Exception as e:
        print(f"Error updating report status: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to update report status'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()












# Handle chat messages
@socketio.on('chatMessage')
def handle_chat_message(data):
    message = data.get('message')
    name = data.get('name')
    if message and name:
        # Broadcast the message to all connected clients
        emit('chatMessage', {'message': message, 'name': name}, broadcast=True)

# Run the Flask app with WebSocket support
if __name__ == '__main__':
    socketio.run(app, debug=True)