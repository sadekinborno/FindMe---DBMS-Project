<div align="center">

# 🚨 FindMe
### Emergency Response & Safety Platform

*Connecting communities in times of crisis*

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com)
[![MySQL](https://img.shields.io/badge/MySQL-5.7+-orange.svg)](https://mysql.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-5.0+-red.svg)](https://socket.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[🎥 **Watch Demo**](https://youtu.be/BRii9rkKVQY?si=Sca2Nu4jVrvg_6nc) • [📖 **Documentation**](#-installation--setup) • [🐛 **Report Bug**](https://github.com/yourusername/findme/issues)

---

</div>

## 🌟 Overview

FindMe is a comprehensive emergency response and social safety platform that connects users with nearby helpers and emergency services in real-time. Built with modern web technologies, it provides instant communication, location-based alerts, and professional emergency service integration.

### ✨ Key Highlights
- 🚨 **Real-time Emergency Alerts** with 2km proximity detection
- 💬 **Instant Group Communication** between victims and helpers  
- 👥 **Professional Service Integration** for fire departments and medical services
- 📱 **Mobile-Responsive Design** for on-the-go accessibility
- 🗺️ **Interactive Mapping** with live location tracking

---

## 🎯 Features

<table>
<tr>
<td width="50%">

### 👤 **User Features**
- ✅ Emergency alert broadcasting
- ✅ Real-time location sharing
- ✅ Friends system with messaging
- ✅ Emergency group chat
- ✅ Mark safe functionality
- ✅ Report submission system

</td>
<td width="50%">

### 🚒 **Service Provider Features**
- ✅ Dedicated fire service dashboard
- ✅ Medical emergency interface
- ✅ Real-time alert monitoring
- ✅ Victim communication tools
- ✅ Response status tracking
- ✅ Service profile management

</td>
</tr>
<tr>
<td width="50%">

### 👨‍💼 **Admin Features**
- ✅ System analytics dashboard
- ✅ User management interface
- ✅ Service registration & management
- ✅ Alert monitoring & resolution
- ✅ Report review system
- ✅ Data visualization with charts

</td>
<td width="50%">

### 🔧 **Technical Features**
- ✅ Socket.IO real-time communication
- ✅ Leaflet interactive maps
- ✅ Secure authentication system
- ✅ MySQL database with relationships
- ✅ RESTful API architecture
- ✅ Responsive web design

</td>
</tr>
</table>

---

## 🛠️ Technology Stack

<div align="center">

| **Backend** | **Frontend** | **Database** | **Real-time** |
|-------------|--------------|--------------|---------------|
| ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) | ![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white) | ![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101) |
| ![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white) | ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white) | ![Database](https://img.shields.io/badge/Relational-DB-blue?style=for-the-badge) | ![Real-time](https://img.shields.io/badge/Real--time-Communication-green?style=for-the-badge) |
| ![PyMySQL](https://img.shields.io/badge/PyMySQL-Database-orange?style=for-the-badge) | ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) | | |

</div>

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

```bash
✅ Python 3.8 or higher
✅ MySQL 5.7 or higher  
✅ Modern web browser (Chrome, Firefox, Safari, Edge)
✅ Git (for cloning the repository)
```

---

## 🚀 Quick Start

### 📥 **Step 1: Clone the Repository**
```bash
git clone https://github.com/yourusername/findme.git
cd findme
```

### 🐍 **Step 2: Install Python Dependencies**
```bash
# Install required packages
pip install -r requirements.txt

# Or install manually:
pip install flask flask-cors flask-socketio pymysql werkzeug
```

### 🗄️ **Step 3: Database Setup**
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE safety_db;
exit

# Import database schema
mysql -u root -p safety_db < database_setup.sql
```

### ⚙️ **Step 4: Configure Database**
Update database credentials in `backend/app.py`:
```python
def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='your_mysql_username',      # 👈 Update this
        password='your_mysql_password',  # 👈 Update this
        database='safety_db',
        cursorclass=pymysql.cursors.DictCursor
    )
```

### 🎬 **Step 5: Run the Application**

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```
🟢 Backend running on: `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
python -m http.server 5500
```
🟢 Frontend running on: `http://localhost:5500`

### 🎉 **Step 6: Access the Application**

| **Role** | **URL** | **Purpose** |
|----------|---------|-------------|
| 👤 **Users** | `http://localhost:5500` | Main application |
| 🚒 **Fire Services** | `http://localhost:5500/services/fire/` | Fire department dashboard |
| 🏥 **Medical Services** | `http://localhost:5500/services/medical/` | Medical emergency dashboard |
| 👨‍💼 **Admin** | `http://localhost:5500/admin/` | Administrative panel |

---

## 📖 Usage Guide

### 🆘 **For Emergency Situations**

1. **🔴 Create Alert**
   - Click "Seek Help" button
   - Select emergency type (Fire, Medical, Accident, etc.)
   - Add details and confirm location
   - Alert sent to nearby users (2km radius) + friends

2. **💬 Emergency Chat**
   - Automatic group chat creation
   - Real-time communication with helpers
   - Location sharing capabilities

3. **✅ Mark Safe**
   - Click "Mark Safe" when emergency resolved
   - Automatic alert closure after 30 seconds
   - Notification sent to all helpers

### 👥 **Social Features**

1. **🤝 Friends System**
   - Search and add friends
   - Accept/decline friend requests
   - Direct messaging capabilities
   - Block/unblock functionality

2. **📱 Notifications**
   - Real-time emergency alerts
   - Friend request notifications
   - Service response updates

### 🚒 **For Emergency Services**

1. **📊 Dashboard Monitoring**
   - Real-time alert feed
   - Interactive map view
   - Alert filtering and search

2. **🚨 Emergency Response**
   - Click alerts to view details
   - Communicate with victims via chat
   - Mark alerts as resolved

---

## 📁 Project Structure

```
FindMe/
├── 📂 backend/
│   └── 🐍 app.py                    # Flask backend server
├── 📂 frontend/
│   ├── 🌐 index.html                # Main application
│   ├── ⚡ script.js                 # Main JavaScript functionality
│   ├── 🎨 styles.css               # Main stylesheet
│   ├── 📂 admin/                   # Admin panel
│   │   ├── admin.html
│   │   ├── admin.js
│   │   └── admin.css
│   ├── 📂 auth/                    # Authentication pages
│   │   ├── signin.html
│   │   ├── signup.html
│   │   ├── auth.js
│   │   └── auth.css
│   ├── 📂 services/                # Service dashboards
│   │   ├── 🚒 fire/               # Fire service
│   │   └── 🏥 medical/            # Medical service
│   └── 📂 images/                  # Application assets
├── 📄 requirements.txt              # Python dependencies
├── 🗄️ database_setup.sql          # Database schema
├── ⚙️ .gitignore                   # Git ignore rules
└── 📖 README.md                    # This file
```

---

## 🔧 Configuration

### 🌍 **Environment Variables (Recommended)**

Create a `.env` file for secure configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_secure_password
DB_NAME=safety_db

# Application Settings
SECRET_KEY=your_secret_key_here
DEBUG=True
PROXIMITY_RADIUS=2000  # meters

# Frontend URLs (if different)
FRONTEND_URL=http://localhost:5500
```

### 🎛️ **Customizable Settings**

- **Proximity Radius**: Modify in `backend/app.py` (default: 2km)
- **Emergency Chat Closure**: Adjust timeout in mark-safe functionality (default: 30s)
- **Map Center**: Update coordinates in Leaflet initialization
- **Database Connection**: Configure in `get_db_connection()` function

---

## 📊 API Documentation

### 🔐 **Authentication Endpoints**
```http
POST /signup          # User registration
POST /signin          # User login
POST /service-signin  # Service provider login
```

### 🚨 **Emergency Endpoints**
```http
POST /emergency       # Create emergency alert
POST /mark-safe       # Mark user as safe
GET  /alerts          # Get emergency alerts
```

### 👥 **Friends System**
```http
GET  /api/friends/search           # Search users
POST /api/friends/request          # Send friend request
POST /api/friends/accept           # Accept friend request
GET  /api/friends/list/<user_id>   # Get friends list
```

### 💬 **Socket.IO Events**
```javascript
// Client to Server
socket.emit('emergencyAlert', data)
socket.emit('emergencyChatMessage', message)
socket.emit('friendChatMessage', message)

// Server to Client
socket.on('emergencyAlert', handler)
socket.on('emergencyChatMessage', handler)
socket.on('serviceResponse', handler)
```

---

## 🧪 Testing

### 🔍 **Manual Testing Checklist**

- [ ] User registration and login
- [ ] Emergency alert creation and notification
- [ ] Real-time chat functionality
- [ ] Friend system operations
- [ ] Service provider dashboard
- [ ] Admin panel functionality
- [ ] Map interactions and location services

### 🚀 **Development Server**

```bash
# Backend with debug mode
cd backend
python app.py

# Frontend with live reload (using Live Server extension in VS Code)
# Or use Node.js live-server:
npx live-server frontend --port=5500
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🛠️ **Development Setup**

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
6. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### 📋 **Contribution Guidelines**

- Follow existing code style and conventions
- Add comments for complex functionality
- Test your changes thoroughly
- Update documentation if needed
- Ensure no security vulnerabilities

---

## 🆘 Troubleshooting

### ❌ **Common Issues**

<details>
<summary><strong>🐍 "pip is not recognized" Error</strong></summary>

**Solution:**
```bash
# Use Python module instead
python -m pip install flask flask-cors flask-socketio pymysql werkzeug

# Or add Python to PATH and restart terminal
```
</details>

<details>
<summary><strong>🗄️ Database Connection Failed</strong></summary>

**Solution:**
1. Verify MySQL is running
2. Check database credentials in `app.py`
3. Ensure `safety_db` database exists
4. Run the database setup script
</details>

<details>
<summary><strong>🌐 CORS Policy Errors</strong></summary>

**Solution:**
- Ensure Flask-CORS is installed
- Check that frontend and backend URLs match
- Verify CORS configuration in `app.py`
</details>

<details>
<summary><strong>📍 Location Services Not Working</strong></summary>

**Solution:**
- Enable location permissions in browser
- Use HTTPS for production (required for geolocation)
- Check browser console for geolocation errors
</details>

---

## 📈 Roadmap

### 🔮 **Planned Features**

- [ ] 📱 Mobile app (React Native)
- [ ] 🌍 Multi-language support
- [ ] 🔔 Push notifications
- [ ] 📊 Advanced analytics
- [ ] 🚁 Drone integration
- [ ] 🤖 AI-powered risk assessment
- [ ] ☁️ Cloud deployment guides

### 🎯 **Version 2.0 Goals**

- Enhanced UI/UX design
- Advanced mapping features
- Integration with government emergency services
- Machine learning for emergency prediction
- IoT device compatibility

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License - Feel free to use, modify, and distribute
```

---

## 🙏 Acknowledgments

### 🎨 **Design & Assets**
- [Leaflet](https://leafletjs.com/) - Interactive maps
- [Font Awesome](https://fontawesome.com/) - Beautiful icons
- [OpenStreetMap](https://openstreetmap.org/) - Map data

### 🛠️ **Technology Partners**
- [Flask](https://flask.palletsprojects.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [MySQL](https://mysql.com/) - Database management

### 👥 **Community**
- All contributors and beta testers
- Emergency service professionals who provided feedback
- Open source community for inspiration and support

---

## 📞 Support & Contact

<div align="center">

### Need Help? We're Here! 

[![📧 Email](https://img.shields.io/badge/Email-Support-blue?style=for-the-badge&logo=gmail)](mailto:support@findme.com)
[![💬 Issues](https://img.shields.io/badge/GitHub-Issues-red?style=for-the-badge&logo=github)](https://github.com/yourusername/findme/issues)
[![📖 Docs](https://img.shields.io/badge/Read-Documentation-green?style=for-the-badge&logo=gitbook)](https://github.com/yourusername/findme/wiki)

**Response Time: Usually within 24 hours**

</div>

---

<div align="center">

### ⭐ Star this project if it helped you!

**Made with ❤️ for safer communities**

*FindMe - Because every second counts in an emergency*

---

**[⬆️ Back to Top](#-findme)**

</div>